# =====================================================================
#  GENERAL BURGUER - abrir acesso pro suporte
#
#  Rode UMA VEZ, no computador da lanchonete (o da impressora).
#  Depois disso o suporte entra por aqui e configura o resto de longe:
#  QZ Tray, impressora, energia, teste de cupom.
#
#  Ordem de proposito: o Tailscale vem PRIMEIRO porque e a parte que
#  quase nunca falha. Assim, mesmo que o SSH de problema, o PC ja
#  aparece pro suporte e da pra enxergar onde travou.
#
#  Sem acentos de proposito: PowerShell 5.1 quebra em UTF-8 sem BOM.
# =====================================================================

# Continue, e nao Stop: este script tem plano B e plano C em quase todo
# passo. Morrer no primeiro tropeco e exatamente o que nao pode acontecer.
$ErrorActionPreference = "Continue"
$ProgressPreference = "SilentlyContinue"   # barra de download deixa o irm lento

# Chave publica do PC do Vinicius (IT@TI). E so a METADE publica: com ela
# ninguem entra em lugar nenhum. Ela so reconhece quem tem a outra metade,
# que nunca sai daquele PC.
$CHAVE = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAILdWBxL58Vbp8pglV7JitAW/1KDdZIpMQiZYC3xtmpI3 IT@TI"

# A rede onde o PC do suporte esta. Conta errada nao da erro nenhum:
# o PC entra numa rede separada, fica tudo verde, e os dois nunca se
# enxergam. Por isso o nome esta escrito aqui.
$CONTA = "viniciuscacador2@gmail.com"

$TAILSCALE = "C:\Program Files\Tailscale\tailscale.exe"
$AREA      = [Environment]::GetFolderPath("Desktop")
$RELATORIO = Join-Path $AREA "GENERAL-BURGUER-acesso.txt"
$LOG       = Join-Path $AREA "GENERAL-BURGUER-log.txt"
$ZIP_SSH   = "https://github.com/PowerShell/Win32-OpenSSH/releases/download/10.0.0.0p2-Preview/OpenSSH-Win64.zip"

# --- Precisa de administrador ------------------------------------------
$eu = [Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
if (-not $eu.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  if ([string]::IsNullOrWhiteSpace($PSCommandPath)) {
    Write-Host ""
    Write-Host "  PRECISO DE ADMINISTRADOR." -ForegroundColor Red
    Write-Host "  Feche esta janela. Clique com o botao DIREITO no menu Iniciar,"
    Write-Host "  escolha 'Terminal (Administrador)', e cole o comando de novo."
    Write-Host ""
    Read-Host "  Enter pra fechar"
    exit 1
  }
  Write-Host "Pedindo permissao de administrador..." -ForegroundColor Yellow
  # -NoExit: a janela que abre NAO pode sumir levando o erro junto.
  Start-Process powershell.exe -Verb RunAs -ArgumentList @(
    "-NoProfile", "-ExecutionPolicy", "Bypass", "-NoExit", "-File", "`"$PSCommandPath`""
  )
  exit
}

# Tudo que aparecer na tela fica gravado tambem. Se a janela fechar, o
# erro nao se perde: esta no arquivo da Area de Trabalho.
try { Start-Transcript -Path $LOG -Force | Out-Null } catch {}

function Passo($n, $texto) { Write-Host ""; Write-Host "[$n] $texto" -ForegroundColor Cyan }
function Bom($texto)       { Write-Host "      $texto" -ForegroundColor Green }
function Ruim($texto)      { Write-Host "      $texto" -ForegroundColor Red }
function Atencao($texto)   { Write-Host "      $texto" -ForegroundColor Yellow }

Write-Host ""
Write-Host "  GENERAL BURGUER - abrir acesso pro suporte" -ForegroundColor Cyan
Write-Host "  ------------------------------------------"
Write-Host "  PC: $env:COMPUTERNAME   Usuario: $env:USERNAME"

$temInternet = Test-Connection -ComputerName "8.8.8.8" -Count 1 -Quiet -ErrorAction SilentlyContinue
if (-not $temInternet) {
  Atencao "Atencao: este PC parece estar SEM INTERNET. Quase tudo aqui"
  Atencao "precisa baixar alguma coisa. Confira a rede antes de seguir."
}

# =====================================================================
# 1. TAILSCALE - a rede privada entre os seus aparelhos
# =====================================================================
Passo "1/5" "Instalando o Tailscale..."

if (Test-Path $TAILSCALE) {
  Bom "Tailscale ja esta instalado."
} else {
  if (Get-Command winget -ErrorAction SilentlyContinue) {
    winget install --id Tailscale.Tailscale -e `
      --accept-package-agreements --accept-source-agreements | Out-Host
  } else {
    Atencao "Sem winget neste PC. Baixando o instalador direto..."
  }

  # Plano B: baixar o MSI do site do Tailscale e instalar calado.
  if (-not (Test-Path $TAILSCALE)) {
    try {
      $msi = Join-Path $env:TEMP "tailscale-setup.msi"
      Invoke-WebRequest -Uri "https://pkgs.tailscale.com/stable/tailscale-setup-latest-amd64.msi" `
        -OutFile $msi -UseBasicParsing
      Start-Process msiexec.exe -ArgumentList "/i","`"$msi`"","/quiet","/norestart" -Wait
    } catch {
      Ruim "Falhou o download do Tailscale: $($_.Exception.Message)"
    }
  }

  if (Test-Path $TAILSCALE) {
    Bom "Tailscale instalado."
  } else {
    Ruim "Nao consegui instalar o Tailscale de jeito nenhum."
    Ruim "Baixe a mao em https://tailscale.com/download/windows"
    Ruim "e rode este arquivo de novo."
    try { Stop-Transcript | Out-Null } catch {}
    Read-Host "  Enter pra fechar"
    exit 1
  }
}

# =====================================================================
# 2. ENTRAR NA REDE
#
#    Aqui moram os dois jeitos de falhar CALADO, e os dois agora estao
#    tratados. Foi o que derrubou as tentativas de 10/10:
#
#    a) 'tailscale up' imprime um link e FICA PARADO esperando alguem
#       abrir. Antes o script so mandava rodar e ia conferir o resultado:
#       ninguem via o link, ninguem logava, e a tela parecia normal.
#       Agora o script LE o link da saida e abre o navegador sozinho.
#
#    b) Login na conta errada deixa tudo verde e os dois PCs nunca se
#       enxergam. Agora a conta e conferida; se estiver errada, o script
#       sai dela sozinho.
# =====================================================================
Passo "2/5" "Entrando na rede..."

# O servico tem que estar de pe antes de qualquer pergunta ao Tailscale.
$svcTs = Get-Service Tailscale -ErrorAction SilentlyContinue
if ($svcTs) {
  Set-Service Tailscale -StartupType Automatic -ErrorAction SilentlyContinue
  if ($svcTs.Status -ne "Running") { Start-Service Tailscale -ErrorAction SilentlyContinue }
  Start-Sleep -Seconds 3
}

# A conta tem id numerico, entao a chave do objeto nao da pra escrever
# com ponto: tem que procurar na lista de propriedades.
function ContaAtual {
  try {
    $j = & $TAILSCALE status --json 2>$null | ConvertFrom-Json
    $id = "$($j.Self.UserID)"
    $u = $j.User.PSObject.Properties | Where-Object { $_.Name -eq $id }
    if ($u) { return $u.Value.LoginName }
  } catch {}
  return ""
}
function IpAtual {
  try { return (& $TAILSCALE ip -4 2>$null | Select-Object -First 1) } catch { return "" }
}

$contaJa = ContaAtual
if ($contaJa -and $contaJa -ne $CONTA) {
  Atencao "Este PC estava logado como '$contaJa' - conta ERRADA."
  Atencao "Saindo dela pra entrar na certa..."
  & $TAILSCALE logout 2>&1 | Out-Host
  Start-Sleep -Seconds 3
}

$ip = IpAtual
if ([string]::IsNullOrWhiteSpace($ip)) {
  Write-Host ""
  Write-Host "  >>> VOU ABRIR O NAVEGADOR AGORA." -ForegroundColor Yellow
  Write-Host "  >>> Clique em 'Sign in with Google' e escolha a conta:" -ForegroundColor Yellow
  Write-Host ""
  Write-Host "         $CONTA" -ForegroundColor White
  Write-Host ""
  Write-Host "  >>> Tem que ser ESSA. Com outra conta este PC cai numa rede" -ForegroundColor Yellow
  Write-Host "  >>> separada, fica tudo verde, e o suporte nao alcanca ele." -ForegroundColor Yellow
  Write-Host ""

  $fOut = Join-Path $env:TEMP "gb-ts-out.txt"
  $fErr = Join-Path $env:TEMP "gb-ts-err.txt"
  Remove-Item $fOut, $fErr -Force -ErrorAction SilentlyContinue

  # Roda escondido e com a saida em arquivo justamente pra eu poder LER
  # o link. --unattended: a rede sobe mesmo antes de alguem logar no
  # Windows (depois de queda de luz, por exemplo).
  Start-Process -FilePath $TAILSCALE -ArgumentList "up","--unattended" `
    -RedirectStandardOutput $fOut -RedirectStandardError $fErr `
    -WindowStyle Hidden | Out-Null

  # O link pode sair na saida normal ou na de erro. Leio as duas.
  $link = ""
  foreach ($i in 1..40) {
    Start-Sleep -Milliseconds 1500
    $txt = ""
    foreach ($f in @($fOut, $fErr)) {
      if (Test-Path $f) { $txt += (Get-Content $f -Raw -ErrorAction SilentlyContinue) }
    }
    $m = [regex]::Match($txt, 'https://login\.tailscale\.com/[^\s"]+')
    if ($m.Success) { $link = $m.Value.TrimEnd('.', ',', ')'); break }
    # Ja estava logado na conta certa: nao vem link nenhum, e esta tudo bem.
    if (-not [string]::IsNullOrWhiteSpace((IpAtual))) { break }
  }

  if ($link) {
    Write-Host "      link: $link" -ForegroundColor White
    # Rede de seguranca: se o navegador nao abrir sozinho (acontece em
    # janela de administrador), o atalho na Area de Trabalho resolve.
    try {
      $atalho = Join-Path $AREA "ENTRAR-NA-REDE-DO-SUPORTE.url"
      Set-Content -Path $atalho -Value "[InternetShortcut]`r`nURL=$link" -Encoding ascii
    } catch {}
    $abriu = $true
    try { Start-Process $link } catch { $abriu = $false }
    if ($abriu) {
      Bom "Navegador aberto. Faca o login nele."
    } else {
      Atencao "Nao consegui abrir o navegador daqui. Na Area de Trabalho tem"
      Atencao "um atalho ENTRAR-NA-REDE-DO-SUPORTE - clique nele."
    }
  } elseif ([string]::IsNullOrWhiteSpace((IpAtual))) {
    Atencao "O Tailscale nao me deu link nenhum. Clique no icone dele perto"
    Atencao "do relogio e escolha 'Log in'."
  }

  Write-Host ""
  Write-Host "      esperando voce terminar o login (ate 6 minutos)..."
  foreach ($i in 1..120) {
    Start-Sleep -Seconds 3
    $ip = IpAtual
    if (-not [string]::IsNullOrWhiteSpace($ip)) { break }
    if ($i % 10 -eq 0) { Write-Host "      ainda esperando o login..." }
  }
}

if ([string]::IsNullOrWhiteSpace($ip)) {
  Ruim "Nao entrou na rede - e sem isso o suporte nao alcanca este PC."
  Atencao "Clique no icone do Tailscale perto do relogio, faca login com"
  Atencao "$CONTA, e rode este arquivo de novo."
} else {
  $contaFim = ContaAtual
  if ($contaFim -and $contaFim -ne $CONTA) {
    Ruim ""
    Ruim "ENTROU NA CONTA ERRADA: '$contaFim'"
    Ruim "Tinha que ser:          $CONTA"
    Ruim "Rode este arquivo DE NOVO: ele sai dessa conta sozinho."
    Ruim ""
  } else {
    Bom "Na rede, conta $contaFim. Endereco deste PC: $ip"
  }
}

# =====================================================================
# 3. SERVIDOR SSH DO WINDOWS - com tres caminhos
# =====================================================================
Passo "3/5" "Ligando o servidor SSH do Windows..."

function TemSshd { $null -ne (Get-Service sshd -ErrorAction SilentlyContinue) }

if (TemSshd) {
  Bom "Ja existe neste PC."
} else {
  # Caminho 1: recurso do proprio Windows. Depende do Windows Update, que
  # e justamente o que costuma estar bloqueado ou quebrado.
  Write-Host "      tentando pelo Windows (1 de 3)..."
  try {
    $cap = Get-WindowsCapability -Online -Name "OpenSSH.Server*" -ErrorAction Stop |
           Select-Object -First 1
    if ($cap -and $cap.State -ne "Installed") {
      Add-WindowsCapability -Online -Name $cap.Name -ErrorAction Stop | Out-Null
    }
  } catch {
    Atencao "o Windows recusou: $($_.Exception.Message)"
  }

  # Caminho 2: winget.
  if (-not (TemSshd) -and (Get-Command winget -ErrorAction SilentlyContinue)) {
    Write-Host "      tentando pelo winget (2 de 3)..."
    winget install --id Microsoft.OpenSSH.Beta -e `
      --accept-package-agreements --accept-source-agreements | Out-Host
  }

  # Caminho 3: o zip oficial da Microsoft. Nao depende de Windows Update
  # nem de loja: e so baixar e descompactar.
  if (-not (TemSshd)) {
    Write-Host "      baixando o OpenSSH oficial da Microsoft (3 de 3)..."
    try {
      $zip = Join-Path $env:TEMP "OpenSSH-Win64.zip"
      $tmp = Join-Path $env:TEMP "OpenSSH-extraido"
      Invoke-WebRequest -Uri $ZIP_SSH -OutFile $zip -UseBasicParsing
      if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
      Expand-Archive -Path $zip -DestinationPath $tmp -Force
      $origem = Join-Path $tmp "OpenSSH-Win64"
      $destino = "C:\Program Files\OpenSSH"
      if (-not (Test-Path $destino)) { New-Item -ItemType Directory -Path $destino -Force | Out-Null }
      Copy-Item "$origem\*" $destino -Recurse -Force
      & powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$destino\install-sshd.ps1" | Out-Host
      # O sshd precisa estar no PATH pra o resto do Windows achar ele.
      $caminho = [Environment]::GetEnvironmentVariable("Path", "Machine")
      if ($caminho -notlike "*$destino*") {
        [Environment]::SetEnvironmentVariable("Path", "$caminho;$destino", "Machine")
      }
    } catch {
      Ruim "falhou tambem: $($_.Exception.Message)"
    }
  }
}

if (-not (TemSshd)) {
  Ruim ""
  Ruim "Nao consegui ligar o SSH neste PC por nenhum dos tres caminhos."
  Ruim "Manda o arquivo GENERAL-BURGUER-log.txt (esta na Area de"
  Ruim "Trabalho) pro Vinicius - nele esta escrito o motivo exato."
  Ruim ""
  if ($ip) { Atencao "Mas o Tailscale entrou ($ip), entao ja da pra continuar por outro caminho." }
  try { Stop-Transcript | Out-Null } catch {}
  Read-Host "  Enter pra fechar"
  exit 1
}

Set-Service -Name sshd -StartupType Automatic
Start-Service sshd -ErrorAction SilentlyContinue
Set-Service -Name ssh-agent -StartupType Manual -ErrorAction SilentlyContinue
Bom "sshd ligado e marcado pra subir sozinho com o Windows."

# PowerShell em vez do prompt antigo: e o que o suporte usa.
if (-not (Test-Path "HKLM:\SOFTWARE\OpenSSH")) {
  New-Item -Path "HKLM:\SOFTWARE\OpenSSH" -Force | Out-Null
}
New-ItemProperty -Path "HKLM:\SOFTWARE\OpenSSH" -Name DefaultShell `
  -Value "C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe" `
  -PropertyType String -Force | Out-Null
Bom "Shell do SSH: PowerShell."

# =====================================================================
# 4. AUTORIZAR SO A CHAVE DO VINICIUS
# =====================================================================
Passo "4/5" "Autorizando a chave do PC do Vinicius..."

$pastaSsh = "C:\ProgramData\ssh"
if (-not (Test-Path $pastaSsh)) { New-Item -ItemType Directory -Path $pastaSsh -Force | Out-Null }

# Conta de administrador no Windows le a chave DESTE arquivo, e nao da
# pasta do usuario. E o detalhe que derruba 9 de 10 tentativas.
$arquivoChaves = Join-Path $pastaSsh "administrators_authorized_keys"
$jaTem = $false
if (Test-Path $arquivoChaves) {
  $jaTem = (Get-Content $arquivoChaves -Raw -ErrorAction SilentlyContinue) -like "*$($CHAVE.Split(' ')[1])*"
}
if ($jaTem) {
  Bom "A chave ja estava autorizada."
} else {
  Add-Content -Path $arquivoChaves -Value $CHAVE -Encoding ascii
  Bom "Chave autorizada."
}

# ACL por SID pra funcionar em Windows de qualquer idioma:
#   S-1-5-32-544 = Administradores     S-1-5-18 = SISTEMA
# Se qualquer outro usuario puder escrever neste arquivo, o sshd IGNORA
# ele - calado, sem erro nenhum.
icacls $arquivoChaves /inheritance:r /grant "*S-1-5-32-544:F" /grant "*S-1-5-18:F" | Out-Null
Bom "Permissoes do arquivo de chaves no jeito que o sshd exige."

# Senha desligada: so entra quem tem a chave.
$cfg = Join-Path $pastaSsh "sshd_config"
if (Test-Path $cfg) {
  Copy-Item $cfg "$cfg.antes-do-general-burguer" -Force -ErrorAction SilentlyContinue
  $texto = Get-Content $cfg -Raw
  $texto = [regex]::Replace($texto, '(?im)^\s*#?\s*PasswordAuthentication\s+\w+\s*$', 'PasswordAuthentication no')
  if ($texto -notmatch '(?im)^\s*PasswordAuthentication\s+no\s*$') {
    $texto = $texto.TrimEnd() + "`r`nPasswordAuthentication no`r`n"
  }
  Set-Content -Path $cfg -Value $texto -Encoding ascii
  Bom "Entrada por senha desligada (so a chave)."
}

Restart-Service sshd -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
if ((Get-Service sshd).Status -eq "Running") {
  Bom "sshd reiniciado e no ar."
} else {
  # Config recusada: melhor voltar pro que funcionava do que deixar o PC
  # sem SSH nenhum. Senha volta a valer, mas a porta so abre no Tailscale.
  Atencao "O sshd nao voltou. Devolvendo a configuracao anterior..."
  if (Test-Path "$cfg.antes-do-general-burguer") {
    Copy-Item "$cfg.antes-do-general-burguer" $cfg -Force
    Start-Service sshd -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
  }
  if ((Get-Service sshd).Status -eq "Running") {
    Atencao "Voltou com a configuracao antiga. Avise o Vinicius."
  } else {
    Ruim "sshd fora do ar. Manda o GENERAL-BURGUER-log.txt pro Vinicius."
  }
}

# =====================================================================
# 5. FECHAR A PORTA PRA INTERNET
# =====================================================================
Passo "5/5" "Fechando a porta 22 pra internet..."

# A regra que o Windows cria abre o SSH pra rede toda. Desliga ela.
Get-NetFirewallRule -Name "OpenSSH-Server-In-TCP" -ErrorAction SilentlyContinue |
  Set-NetFirewallRule -Enabled False
Get-NetFirewallRule -DisplayName "*OpenSSH SSH Server*" -ErrorAction SilentlyContinue |
  Set-NetFirewallRule -Enabled False

# E cria uma que so aceita quem vem de dentro do Tailscale (100.64.0.0/10).
Remove-NetFirewallRule -Name "GB-SSH-Tailscale" -ErrorAction SilentlyContinue
New-NetFirewallRule -Name "GB-SSH-Tailscale" `
  -DisplayName "General Burguer - suporte por SSH (so Tailscale)" `
  -Direction Inbound -Protocol TCP -LocalPort 22 `
  -RemoteAddress 100.64.0.0/10 -Action Allow -Profile Any | Out-Null
Bom "So entra pelo Tailscale. Da internet a porta esta fechada."

# =====================================================================
# RELATORIO
# =====================================================================
if ([string]::IsNullOrWhiteSpace($ip)) {
  try { $ip = (& $TAILSCALE ip -4 2>$null | Select-Object -First 1) } catch {}
}

$lan = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
        Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "100.*" } |
        Select-Object -First 1).IPAddress

$impressoras = @()
try {
  $impressoras = Get-Printer | ForEach-Object {
    "      - {0}   [{1}]  porta {2}" -f $_.Name, $_.PrinterStatus, $_.PortName
  }
} catch { $impressoras = @("      (nao consegui listar)") }

$linhas = @()
$linhas += "GENERAL BURGUER - acesso do suporte"
$linhas += "gerado em $(Get-Date -Format 'dd/MM/yyyy HH:mm')"
$linhas += "========================================"
$linhas += ""
$linhas += "MANDE ESTAS 3 LINHAS PRO VINICIUS:"
$linhas += ""
$linhas += "  PC .............. $env:COMPUTERNAME"
$linhas += "  Usuario ......... $env:USERNAME"
$linhas += "  Tailscale ....... $(if ($ip) { $ip } else { 'NAO ENTROU NA REDE' })"
$linhas += ""
$linhas += "----------------------------------------"
$linhas += "detalhes (o suporte usa)"
$linhas += ""
$linhas += "  sshd ............ $((Get-Service sshd -ErrorAction SilentlyContinue).Status)"
$linhas += "  IP da casa ...... $lan"
$linhas += "  Windows ......... $((Get-CimInstance Win32_OperatingSystem).Caption)"
$linhas += "  QZ Tray ......... $(if (Test-Path 'C:\Program Files\QZ Tray\qz-tray.exe') { 'instalado' } else { 'ainda nao' })"
$linhas += ""
$linhas += "  impressoras:"
$linhas += $impressoras
$linhas += ""
$linhas += "----------------------------------------"
$linhas += "pra FECHAR o acesso quando quiser, rode como administrador:"
$linhas += ""
$linhas += '  Stop-Service sshd; Set-Service sshd -StartupType Disabled'
$linhas += ""
Set-Content -Path $RELATORIO -Value $linhas -Encoding utf8

Write-Host ""
Write-Host "  PRONTO." -ForegroundColor Green
Write-Host "  ------"
Write-Host ""
Write-Host "      PC .......... $env:COMPUTERNAME"
Write-Host "      Usuario ..... $env:USERNAME"
Write-Host "      Tailscale ... $(if ($ip) { $ip } else { 'NAO ENTROU NA REDE' })" -ForegroundColor Yellow
Write-Host "      sshd ........ $((Get-Service sshd -ErrorAction SilentlyContinue).Status)" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Salvei isso na sua Area de Trabalho, em"
Write-Host "  GENERAL-BURGUER-acesso.txt (e o log completo no -log.txt)."
Write-Host ""
Write-Host "  Deixe este computador LIGADO. O resto o suporte faz de longe."
Write-Host ""
try { Stop-Transcript | Out-Null } catch {}
Read-Host "  Enter pra fechar"
