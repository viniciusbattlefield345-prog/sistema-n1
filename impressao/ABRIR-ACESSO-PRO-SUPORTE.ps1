# =====================================================================
#  GENERAL BURGUER - abrir acesso pro suporte
#
#  Rode UMA VEZ, no computador da lanchonete (o da impressora).
#  Depois disso o suporte entra por aqui e configura o resto sozinho,
#  de longe: QZ Tray, impressora, energia, teste de cupom.
#
#  O que ele faz:
#    1. Instala o Tailscale  (rede privada, so entre os SEUS aparelhos)
#    2. Liga o servidor SSH do Windows
#    3. Autoriza UMA chave: a do PC do Vinicius. Mais ninguem entra.
#    4. Fecha a porta 22 pra internet. So abre dentro do Tailscale.
#
#  Sem acentos de proposito: PowerShell 5.1 quebra em UTF-8 sem BOM.
# =====================================================================

$ErrorActionPreference = "Stop"

# Chave publica do PC do Vinicius (IT@TI). E so a METADE publica: com ela
# ninguem entra em lugar nenhum, ela so reconhece quem tem a outra metade,
# que nunca sai daquele PC.
$CHAVE = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAILdWBxL58Vbp8pglV7JitAW/1KDdZIpMQiZYC3xtmpI3 IT@TI"

$TAILSCALE = "C:\Program Files\Tailscale\tailscale.exe"
$RELATORIO = "$env:USERPROFILE\Desktop\GENERAL-BURGUER-acesso.txt"

# --- Precisa de administrador ------------------------------------------
$eu = [Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
if (-not $eu.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  Write-Host "Pedindo permissao de administrador..." -ForegroundColor Yellow
  Start-Process powershell.exe -Verb RunAs -ArgumentList @(
    "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "`"$PSCommandPath`""
  )
  exit
}

function Passo($n, $texto) { Write-Host ""; Write-Host "[$n] $texto" -ForegroundColor Cyan }
function Bom($texto)       { Write-Host "      $texto" -ForegroundColor Green }
function Ruim($texto)      { Write-Host "      $texto" -ForegroundColor Red }
function Atencao($texto)   { Write-Host "      $texto" -ForegroundColor Yellow }

Write-Host ""
Write-Host "  GENERAL BURGUER - abrir acesso pro suporte" -ForegroundColor Cyan
Write-Host "  ------------------------------------------"
Write-Host "  PC: $env:COMPUTERNAME   Usuario: $env:USERNAME"

# =====================================================================
# 1. SERVIDOR SSH DO WINDOWS
# =====================================================================
Passo "1/5" "Ligando o servidor SSH do Windows..."

if (-not (Get-Service sshd -ErrorAction SilentlyContinue)) {
  $instalou = $false
  try {
    $cap = Get-WindowsCapability -Online -Name "OpenSSH.Server*" |
           Select-Object -First 1
    if ($cap -and $cap.State -ne "Installed") {
      Add-WindowsCapability -Online -Name $cap.Name | Out-Null
    }
    $instalou = $null -ne (Get-Service sshd -ErrorAction SilentlyContinue)
  } catch {
    Atencao "O Windows Update recusou. Tentando pelo winget..."
  }

  if (-not $instalou -and (Get-Command winget -ErrorAction SilentlyContinue)) {
    winget install --id Microsoft.OpenSSH.Beta -e `
      --accept-package-agreements --accept-source-agreements | Out-Host
  }
}

if (-not (Get-Service sshd -ErrorAction SilentlyContinue)) {
  Ruim "Nao consegui instalar o servidor SSH neste PC."
  Ruim "Manda print desta tela pro Vinicius."
  Read-Host "  Enter pra fechar"
  exit 1
}

Set-Service -Name sshd -StartupType Automatic
Start-Service sshd
# ssh-agent nao e obrigatorio, mas evita aviso chato no log.
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
# 2. AUTORIZAR SO A CHAVE DO VINICIUS
# =====================================================================
Passo "2/5" "Autorizando a chave do PC do Vinicius..."

$pastaSsh = "C:\ProgramData\ssh"
if (-not (Test-Path $pastaSsh)) { New-Item -ItemType Directory -Path $pastaSsh -Force | Out-Null }

# Conta de administrador no Windows le a chave DESTE arquivo, nao do
# .ssh do usuario. E o detalhe que faz 9 de 10 tentativas falharem.
$arquivoChaves = Join-Path $pastaSsh "administrators_authorized_keys"
$jaTem = $false
if (Test-Path $arquivoChaves) {
  $jaTem = (Get-Content $arquivoChaves -Raw) -like "*$($CHAVE.Split(' ')[1])*"
}
if ($jaTem) {
  Bom "A chave ja estava autorizada."
} else {
  Add-Content -Path $arquivoChaves -Value $CHAVE -Encoding ascii
  Bom "Chave autorizada."
}

# ACL por SID pra funcionar em Windows em qualquer idioma:
#   S-1-5-32-544 = Administradores     S-1-5-18 = SISTEMA
# Se qualquer outro usuario puder escrever neste arquivo, o sshd IGNORA ele.
icacls $arquivoChaves /inheritance:r /grant "*S-1-5-32-544:F" /grant "*S-1-5-18:F" | Out-Null
Bom "Permissoes do arquivo de chaves no jeito que o sshd exige."

# Senha desligada: so entra quem tem a chave. Nem forca bruta serve.
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

Restart-Service sshd
Start-Sleep -Seconds 2
if ((Get-Service sshd).Status -eq "Running") {
  Bom "sshd reiniciado e no ar."
} else {
  Ruim "O sshd nao voltou. Devolvendo a configuracao anterior..."
  if (Test-Path "$cfg.antes-do-general-burguer") {
    Copy-Item "$cfg.antes-do-general-burguer" $cfg -Force
    Restart-Service sshd
  }
}

# =====================================================================
# 3. TAILSCALE - a rede privada entre os seus aparelhos
# =====================================================================
Passo "3/5" "Instalando o Tailscale..."

if (Test-Path $TAILSCALE) {
  Bom "Tailscale ja esta instalado."
} else {
  if (Get-Command winget -ErrorAction SilentlyContinue) {
    winget install --id Tailscale.Tailscale -e `
      --accept-package-agreements --accept-source-agreements | Out-Host
  }
  if (-not (Test-Path $TAILSCALE)) {
    Ruim "Nao consegui instalar sozinho."
    Ruim "Baixe em https://tailscale.com/download/windows , instale,"
    Ruim "e rode este arquivo de novo."
    Read-Host "  Enter pra fechar"
    exit 1
  }
  Bom "Tailscale instalado."
}

# =====================================================================
# 4. ENTRAR NA REDE (aqui VOCE clica: tem que fazer login)
# =====================================================================
Passo "4/5" "Entrando na rede..."

$ip = ""
try { $ip = (& $TAILSCALE ip -4 2>$null | Select-Object -First 1) } catch {}

if ([string]::IsNullOrWhiteSpace($ip)) {
  Write-Host ""
  Write-Host "  >>> VAI ABRIR O NAVEGADOR PRA VOCE FAZER LOGIN." -ForegroundColor Yellow
  Write-Host "  >>> Entre com a MESMA conta que voce usou no outro PC" -ForegroundColor Yellow
  Write-Host "  >>> (o Google do viniciusbattlefield345@gmail.com)." -ForegroundColor Yellow
  Write-Host ""
  # --unattended: o Tailscale sobe mesmo antes de alguem logar no Windows.
  Start-Process -FilePath $TAILSCALE -ArgumentList "up","--unattended" -NoNewWindow
  foreach ($tentativa in 1..60) {
    Start-Sleep -Seconds 3
    try { $ip = (& $TAILSCALE ip -4 2>$null | Select-Object -First 1) } catch {}
    if (-not [string]::IsNullOrWhiteSpace($ip)) { break }
    if ($tentativa % 5 -eq 0) { Write-Host "      esperando o login..." }
  }
}

if ([string]::IsNullOrWhiteSpace($ip)) {
  Atencao "Ainda nao entrou na rede. Clique no icone do Tailscale perto do"
  Atencao "relogio, faca login, e rode este arquivo de novo."
} else {
  Bom "Na rede. Endereco deste PC: $ip"
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
Write-Host "  Manda isto pro Vinicius:" -ForegroundColor Cyan
Write-Host ""
Write-Host "      PC .......... $env:COMPUTERNAME"
Write-Host "      Usuario ..... $env:USERNAME"
Write-Host "      Tailscale ... $(if ($ip) { $ip } else { 'NAO ENTROU NA REDE' })" -ForegroundColor Yellow
Write-Host ""
Write-Host "  (tambem salvei isso num arquivo na sua Area de Trabalho:"
Write-Host "   GENERAL-BURGUER-acesso.txt)"
Write-Host ""
Write-Host "  Deixe este computador LIGADO. O resto o suporte faz de longe."
Write-Host ""
Read-Host "  Enter pra fechar"
