# =====================================================================
#  GENERAL BURGUER - ligar so o SSH
#
#  O ABRIR-ACESSO-PRO-SUPORTE.ps1 ja fez a parte do Tailscale e o PC
#  entrou na rede. Ele morreu no passo do SSH, que tentava primeiro o
#  recurso do proprio Windows (Add-WindowsCapability) - e esse depende
#  do Windows Update, que neste PC nao colaborou.
#
#  Este script pula esse caminho: baixa o OpenSSH oficial da Microsoft
#  em .zip e instala a mao. Nao depende de Windows Update, nem de loja,
#  nem de winget.
#
#  Como se sabe que foi o passo do SSH que falhou: a porta 22 daquele PC
#  dava TIMEOUT, enquanto as portas 135 e 445 respondiam. Timeout em vez
#  de "recusada" significa que nem a regra de firewall da porta 22 foi
#  criada - e ela e o ultimo passo do outro script.
#
#  Sem acentos de proposito: PowerShell 5.1 quebra em UTF-8 sem BOM.
# =====================================================================

$ErrorActionPreference = "Continue"
$ProgressPreference = "SilentlyContinue"

$CHAVE = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAILdWBxL58Vbp8pglV7JitAW/1KDdZIpMQiZYC3xtmpI3 IT@TI"
$ZIP   = "https://github.com/PowerShell/Win32-OpenSSH/releases/latest/download/OpenSSH-Win64.zip"
$AREA  = [Environment]::GetFolderPath("Desktop")
$LOG   = Join-Path $AREA "GENERAL-BURGUER-ssh.txt"

# --- Precisa de administrador ------------------------------------------
$eu = [Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
if (-not $eu.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  if ([string]::IsNullOrWhiteSpace($PSCommandPath)) {
    Write-Host "  PRECISO DE ADMINISTRADOR. Abra 'Terminal (Administrador)'." -ForegroundColor Red
    Read-Host "  Enter pra fechar"; exit 1
  }
  Start-Process powershell.exe -Verb RunAs -ArgumentList @(
    "-NoProfile","-ExecutionPolicy","Bypass","-NoExit","-File","`"$PSCommandPath`""
  )
  exit
}

try { Start-Transcript -Path $LOG -Force | Out-Null } catch {}

function Bom($t)     { Write-Host "      $t" -ForegroundColor Green }
function Ruim($t)    { Write-Host "      $t" -ForegroundColor Red }
function Atencao($t) { Write-Host "      $t" -ForegroundColor Yellow }
function TemSshd     { $null -ne (Get-Service sshd -ErrorAction SilentlyContinue) }

Write-Host ""
Write-Host "  GENERAL BURGUER - ligar o SSH" -ForegroundColor Cyan
Write-Host "  -----------------------------"
Write-Host "  PC: $env:COMPUTERNAME   Usuario: $env:USERNAME"
Write-Host ""

# =====================================================================
# 1. INSTALAR O OPENSSH PELO ZIP OFICIAL
# =====================================================================
Write-Host "[1/4] Servidor SSH..." -ForegroundColor Cyan

if (TemSshd) {
  Bom "Ja existe neste PC - vou so configurar."
} else {
  # Pasta nova e vazia: conteudo baixado nunca se mistura com outra coisa.
  $tmp = Join-Path $env:TEMP ("gb-openssh-" + (Get-Date -Format "yyyyMMddHHmmss"))
  New-Item -ItemType Directory -Path $tmp -Force | Out-Null
  $arq = Join-Path $tmp "OpenSSH-Win64.zip"

  Write-Host "      baixando o OpenSSH oficial da Microsoft (uns 18 MB)..."
  try {
    Invoke-WebRequest -Uri $ZIP -OutFile $arq -UseBasicParsing -ErrorAction Stop
  } catch {
    Ruim "Falhou o download: $($_.Exception.Message)"
    try { Stop-Transcript | Out-Null } catch {}
    Read-Host "  Enter pra fechar"; exit 1
  }

  $tam = [math]::Round((Get-Item $arq).Length / 1MB, 1)
  Bom "baixado ($tam MB)"

  try {
    Expand-Archive -Path $arq -DestinationPath $tmp -Force -ErrorAction Stop
    $origem = Join-Path $tmp "OpenSSH-Win64"
    if (-not (Test-Path $origem)) {
      $origem = (Get-ChildItem $tmp -Directory | Select-Object -First 1).FullName
    }
    $destino = "C:\Program Files\OpenSSH"
    if (-not (Test-Path $destino)) {
      New-Item -ItemType Directory -Path $destino -Force | Out-Null
    }
    Copy-Item "$origem\*" $destino -Recurse -Force -ErrorAction Stop
    Bom "copiado pra $destino"

    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$destino\install-sshd.ps1" | Out-Host

    # Sem isso o resto do Windows nao acha o ssh/sshd pelo nome.
    $caminho = [Environment]::GetEnvironmentVariable("Path", "Machine")
    if ($caminho -notlike "*$destino*") {
      [Environment]::SetEnvironmentVariable("Path", "$caminho;$destino", "Machine")
    }
  } catch {
    Ruim "Falhou a instalacao: $($_.Exception.Message)"
  }
}

if (-not (TemSshd)) {
  Ruim ""
  Ruim "O servico sshd nao foi criado. Manda o arquivo"
  Ruim "GENERAL-BURGUER-ssh.txt (Area de Trabalho) pro Vinicius."
  try { Stop-Transcript | Out-Null } catch {}
  Read-Host "  Enter pra fechar"; exit 1
}

Set-Service -Name sshd -StartupType Automatic
Start-Service sshd -ErrorAction SilentlyContinue
Set-Service -Name ssh-agent -StartupType Manual -ErrorAction SilentlyContinue
Bom "sshd ligado e marcado pra subir sozinho com o Windows."

# =====================================================================
# 2. AUTORIZAR SO A CHAVE DO VINICIUS
# =====================================================================
Write-Host "[2/4] Autorizando a chave..." -ForegroundColor Cyan

$pastaSsh = "C:\ProgramData\ssh"
if (-not (Test-Path $pastaSsh)) { New-Item -ItemType Directory -Path $pastaSsh -Force | Out-Null }

# Conta de administrador le a chave DESTE arquivo, e nao da pasta do
# usuario. E o detalhe que derruba 9 de 10 tentativas.
$arquivoChaves = Join-Path $pastaSsh "administrators_authorized_keys"
$impressao = $CHAVE.Split(' ')[1]
$jaTem = $false
if (Test-Path $arquivoChaves) {
  $jaTem = (Get-Content $arquivoChaves -Raw -ErrorAction SilentlyContinue) -like "*$impressao*"
}
if ($jaTem) { Bom "A chave ja estava autorizada." }
else { Add-Content -Path $arquivoChaves -Value $CHAVE -Encoding ascii; Bom "Chave autorizada." }

# ACL por SID pra funcionar em Windows de qualquer idioma:
#   S-1-5-32-544 = Administradores     S-1-5-18 = SISTEMA
# Se qualquer outro usuario puder escrever aqui, o sshd IGNORA o arquivo,
# calado, sem erro nenhum.
icacls $arquivoChaves /inheritance:r /grant "*S-1-5-32-544:F" /grant "*S-1-5-18:F" | Out-Null
Bom "Permissoes no jeito que o sshd exige."

# =====================================================================
# 3. FIREWALL: SO PELO TAILSCALE
# =====================================================================
Write-Host "[3/4] Firewall..." -ForegroundColor Cyan

# A regra que o Windows cria abre a porta 22 pra rede toda. Desliga.
Get-NetFirewallRule -Name "OpenSSH-Server-In-TCP" -ErrorAction SilentlyContinue |
  Set-NetFirewallRule -Enabled False
Get-NetFirewallRule -DisplayName "*OpenSSH SSH Server*" -ErrorAction SilentlyContinue |
  Set-NetFirewallRule -Enabled False

Remove-NetFirewallRule -Name "GB-SSH-Tailscale" -ErrorAction SilentlyContinue
New-NetFirewallRule -Name "GB-SSH-Tailscale" `
  -DisplayName "General Burguer - suporte por SSH (so Tailscale)" `
  -Direction Inbound -Protocol TCP -LocalPort 22 `
  -RemoteAddress 100.64.0.0/10 -Action Allow -Profile Any | Out-Null
Bom "So entra pelo Tailscale. Da internet a porta 22 esta fechada."

# =====================================================================
# 4. CONFERIR
# =====================================================================
Write-Host "[4/4] Conferindo..." -ForegroundColor Cyan

Restart-Service sshd -ErrorAction SilentlyContinue
Start-Sleep -Seconds 3

$estado = (Get-Service sshd -ErrorAction SilentlyContinue).Status
$escuta = Get-NetTCPConnection -State Listen -LocalPort 22 -ErrorAction SilentlyContinue
$ipTs = ""
try { $ipTs = (& "C:\Program Files\Tailscale\tailscale.exe" ip -4 2>$null | Select-Object -First 1) } catch {}

Write-Host ""
if ($estado -eq "Running" -and $escuta) {
  Write-Host "  PRONTO - O SUPORTE JA CONSEGUE ENTRAR." -ForegroundColor Green
} else {
  Write-Host "  AINDA NAO ESTA NO AR." -ForegroundColor Red
}
Write-Host ""
Write-Host "      sshd ............ $estado"
Write-Host "      escutando na 22 . $(if ($escuta) { 'sim' } else { 'NAO' })"
Write-Host "      Tailscale ....... $(if ($ipTs) { $ipTs } else { 'NAO ENTROU NA REDE' })"
Write-Host ""
Write-Host "  Pode fechar esta janela. Deixe o computador LIGADO."
Write-Host ""
try { Stop-Transcript | Out-Null } catch {}
Read-Host "  Enter pra fechar"
