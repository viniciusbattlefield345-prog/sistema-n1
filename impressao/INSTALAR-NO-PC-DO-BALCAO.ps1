# =====================================================================
#  GENERAL BURGUER - preparar o computador da impressora
#  Rode UMA VEZ, no PC onde a impressora termica esta ligada.
#  Sem acentos de proposito: PowerShell 5.1 quebra em UTF-8 sem BOM.
# =====================================================================

$ErrorActionPreference = "Stop"
$SITE = "https://arinete.vercel.app/impressao"   # trocar se o dominio mudar
$PASTA_QZ = "C:\Program Files\QZ Tray"

# --- 1. Precisa de administrador pra escrever em Program Files ---------
$eu = [Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
if (-not $eu.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  Write-Host "Pedindo permissao de administrador..." -ForegroundColor Yellow
  Start-Process powershell.exe -Verb RunAs -ArgumentList @(
    "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "`"$PSCommandPath`""
  )
  exit
}

Write-Host ""
Write-Host "  GENERAL BURGUER - computador da impressora" -ForegroundColor Cyan
Write-Host "  ------------------------------------------"
Write-Host ""

# --- 2. QZ Tray --------------------------------------------------------
if (Test-Path "$PASTA_QZ\qz-tray.exe") {
  Write-Host "[1/4] QZ Tray ja esta instalado." -ForegroundColor Green
} else {
  Write-Host "[1/4] Instalando o QZ Tray (pode demorar alguns minutos)..."
  if (Get-Command winget -ErrorAction SilentlyContinue) {
    # Sem --disable-interactivity: com ela o winget cancela sozinho no UAC.
    winget install --id QZIndustries.QZTray -e `
      --accept-package-agreements --accept-source-agreements | Out-Host
  }
  if (-not (Test-Path "$PASTA_QZ\qz-tray.exe")) {
    Write-Host ""
    Write-Host "  Nao consegui instalar sozinho." -ForegroundColor Red
    Write-Host "  Baixe em  https://qz.io/download/  (Windows), instale,"
    Write-Host "  e rode este arquivo de novo."
    Read-Host "  Enter pra fechar"
    exit 1
  }
  Write-Host "      QZ Tray instalado." -ForegroundColor Green
}

# --- 3. Certificado ----------------------------------------------------
# Chave PUBLICA do General Burguer. E o que faz o QZ confiar no sistema e
# imprimir sem perguntar "Allow?" a cada cupom. Pode ficar em texto puro:
# quem assina e o servidor, com a chave privada, que nao esta aqui.
$CERTIFICADO = @'
-----BEGIN CERTIFICATE-----
MIIDYzCCAkugAwIBAgIUPuslClUcxfSBFrD3AcnokmWfRakwDQYJKoZIhvcNAQEL
BQAwQTELMAkGA1UEBhMCQlIxGDAWBgNVBAoMD0dlbmVyYWwgQnVyZ3VlcjEYMBYG
A1UEAwwPR2VuZXJhbCBCdXJndWVyMB4XDTI2MDkxMTE1MzM1NFoXDTQ2MDkwNjE1
MzM1NFowQTELMAkGA1UEBhMCQlIxGDAWBgNVBAoMD0dlbmVyYWwgQnVyZ3VlcjEY
MBYGA1UEAwwPR2VuZXJhbCBCdXJndWVyMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A
MIIBCgKCAQEAxZ7ZNwHl8HWl4WBCjn+4pjP8IuEA4mGIWwSHQXXFDgZRb2wjY3Pi
7ZkBRrkCGn4KyOPbobhclnjumtusg6PODvzm+za+UHo+jW7X/Mu+eeletdRU9rFh
XIjVGte7+zIwDoq5agHB1wQYigYe88p4ErAiW4zgZxNR/k/02U5yOI07A2vd9Xws
1lZiMlQYnKjB/R+0Dp/3Q1jmV2uNPAh/IKs22/U9SBAZ0byvFjxg/pX2PUbxFEp5
w87SxAWOkuiFOkeseoPQqg0IO3GVsY9fFRfoNBBPifs/tX0A+c2tHtzoSTqqnyd7
v9ubp70FoQIu8KI8B/tbLVN3nVNyYTJIIQIDAQABo1MwUTAdBgNVHQ4EFgQU7/2m
ydQjbKVSmlrcHh23jgDbXLYwHwYDVR0jBBgwFoAU7/2mydQjbKVSmlrcHh23jgDb
XLYwDwYDVR0TAQH/BAUwAwEB/zANBgkqhkiG9w0BAQsFAAOCAQEADyokkd7f5gKv
5zbPq/Edhs3lRfI+s62+I3BQ2kgeXOJehRMev0gMqCjM64/xnUPx35zPC+tqRdnD
p2/axP/2uG+WrVHfd+6GC91ql1wZ4a5QvpPflKAQGXXib4dUsLIr0h9e773qU342
dLgmR2T7+hENr+CRzvGKEwkAMzNjOE0c8+qTDeTNOzqAiZDbyFOLDi1FcZogQF9Z
VFmtbcEfNxt36QKEfRiFNWFPgm+QgavuNRcMX/pvIW5HbyzNmKsjbdmG3BkjT2gY
tboXolaYyOkf3eJmGqsLBsfQCGj3/3kwMigLeJ6RQOyxeNTT1ttW+DZD5d09TRcl
C7yx+1FQvg==
-----END CERTIFICATE-----
'@

Write-Host "[2/4] Colocando o certificado no QZ Tray..."
Set-Content -Path "$PASTA_QZ\override.crt" -Value $CERTIFICADO -Encoding ascii
Write-Host "      override.crt no lugar." -ForegroundColor Green

# --- 4. Reiniciar o QZ pra ele ler o certificado -----------------------
Write-Host "[3/4] Reiniciando o QZ Tray..."
Get-CimInstance Win32_Process -Filter "Name = 'javaw.exe'" |
  Where-Object { $_.ExecutablePath -like "$PASTA_QZ*" } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
Get-Process -Name "qz-tray*" -ErrorAction SilentlyContinue |
  Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
Start-Process "$PASTA_QZ\qz-tray.exe"

# O QZ demora uns segundos pra abrir a porta. Espera ele aparecer.
$ligado = $false
foreach ($tentativa in 1..20) {
  Start-Sleep -Seconds 2
  if (Get-NetTCPConnection -State Listen -LocalPort 8181 -ErrorAction SilentlyContinue) {
    $ligado = $true
    break
  }
}
if ($ligado) {
  Write-Host "      QZ Tray no ar." -ForegroundColor Green
} else {
  Write-Host "      O QZ nao respondeu ainda. Abra ele pelo menu Iniciar." -ForegroundColor Yellow
}

# --- 5. Impressoras deste PC + abrir o sistema -------------------------
Write-Host "[4/4] Impressoras encontradas neste computador:"
Get-Printer | Where-Object { $_.PrinterStatus -ne "Offline" } |
  ForEach-Object { Write-Host ("      - " + $_.Name) }

Start-Process $SITE

Write-Host ""
Write-Host "  FALTA SO ISTO, na janela do navegador que abriu:" -ForegroundColor Cyan
Write-Host "  1. Entre com seu usuario e senha."
Write-Host "  2. Escolha a impressora termica na lista."
Write-Host "  3. Clique em 'Imprimir um teste' e veja se sai papel."
Write-Host "  4. Se o QZ perguntar 'Allow?', marque 'Remember this decision'."
Write-Host "  5. DEIXE ESSA ABA ABERTA. Pode minimizar, so nao feche."
Write-Host ""
Write-Host "  Todo pedido aprovado no celular sai sozinho nessa impressora."
Write-Host ""
Read-Host "  Enter pra fechar"
