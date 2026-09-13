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
# Autoridade certificadora do General Burguer (chave PUBLICA). E o que faz o
# QZ reconhecer o site e imprimir sem perguntar "Allow?" a cada cupom.
# Pode ficar em texto puro: ela nao assina nada sozinha. Quem assina e o
# servidor, com a chave privada da folha, que nao esta aqui.
$CERTIFICADO = @'
-----BEGIN CERTIFICATE-----
MIIDeTCCAmGgAwIBAgIUV0P7StvnVO32QBUbzG12zl7jeTIwDQYJKoZIhvcNAQEL
BQAwRDELMAkGA1UEBhMCQlIxGDAWBgNVBAoMD0dlbmVyYWwgQnVyZ3VlcjEbMBkG
A1UEAwwSR2VuZXJhbCBCdXJndWVyIENBMB4XDTI2MDkxMzE2Mjg0N1oXDTQ2MDkw
ODE2Mjg0N1owRDELMAkGA1UEBhMCQlIxGDAWBgNVBAoMD0dlbmVyYWwgQnVyZ3Vl
cjEbMBkGA1UEAwwSR2VuZXJhbCBCdXJndWVyIENBMIIBIjANBgkqhkiG9w0BAQEF
AAOCAQ8AMIIBCgKCAQEAoPNJ1dBmfF06AMzGzOODwUngxAembLVttaFFXu17ZHYc
vzMdkVWLQY8AjhtaVABYsl7AiNOKbfeqkfGV+DBpyxdMkflhr0ovBsY29e784Ll2
bdkpAMGB3zgRUwpLuNcfnmT6D5P06Ng2d6O0EX9quUvqCmbvSrwwfam3t4UvrXCE
IhRJ4kN8hQOXTUnH1gCNUY90LITTiTxCWVi6WT/c+XKgeweBqZn32Ymp5T6QsTbw
J7zWl0rDX1f98Ij8L0iJT2SuAC9Ls/qF7G6d71iXxku70581uFJ9lE/w0edRCPEZ
9AfbfLCt5U51M9AUMjPhiVEoOJZf2lgeTyYZM4LmHwIDAQABo2MwYTAdBgNVHQ4E
FgQUBNKSsEXYkdnAwzAxj3su4E4VUxAwHwYDVR0jBBgwFoAUBNKSsEXYkdnAwzAx
j3su4E4VUxAwDwYDVR0TAQH/BAUwAwEB/zAOBgNVHQ8BAf8EBAMCAQYwDQYJKoZI
hvcNAQELBQADggEBAASSmIje78Rhw3l29k7WTu2n6UqlcdLkYaCrZ2iizDXVdc9j
3hozeiqwjpW1EMtutXGH3PvYFMD6BAElq4UIRKwY6AJdT4vhh8X5QpAlvL4aMmhh
uGIb5rkYYS58dW1e4mfevW6WaWTvCQbzc/nEFxxM5yvECuAUQMvLtcNPix7zRwgC
OufKpHAc8O2KskPJ1GbBQgBL+UX/cRNxlgmI8oTdN7v2GnTd7epzyWb9yp31y832
YSD6ZiEYuWS+iWehqqWQwQsw1Q4HCUiD6cGOnDhYP3MjKiseNnNuqOjxQ36MhpKq
tO3+IcDRE/S/lbIQMqEmSwQU8hRrk7z4YojLlow=
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
