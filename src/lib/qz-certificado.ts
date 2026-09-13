/**
 * Certificado público do General Burguer para o QZ Tray.
 *
 * São dois, nesta ordem: a **folha**, que é quem assina cada pedido de
 * impressão, e — depois do marcador que o QZ entende — a **autoridade** que
 * assinou a folha. A autoridade é o mesmo `impressao/override.crt` que vai
 * pra pasta do QZ Tray no PC do balcão.
 *
 * Autoassinado não servia. Enquanto folha e raiz eram o mesmo certificado, o
 * QZ não fechava a cadeia ("Problem building certificate chain" no log dele),
 * mostrava "Untrusted website" a cada cupom e nem deixava marcar "Remember
 * this decision" — ele se recusa a confiar permanentemente em quem não tem
 * cadeia válida.
 *
 * Público de propósito: sozinho não assina nada. A chave privada da folha
 * mora em QZ_CHAVE_PRIVADA, no servidor. A da autoridade nem isso — fica só
 * em qz-ca-chave-privada.pem, fora do Git, e só é usada pra emitir folha nova.
 */
export const CERTIFICADO_QZ = `-----BEGIN CERTIFICATE-----
MIIDcDCCAligAwIBAgIUI3v+lwyjGdSczrjcNGULFJibpQwwDQYJKoZIhvcNAQEL
BQAwRDELMAkGA1UEBhMCQlIxGDAWBgNVBAoMD0dlbmVyYWwgQnVyZ3VlcjEbMBkG
A1UEAwwSR2VuZXJhbCBCdXJndWVyIENBMB4XDTI2MDkxMzE2Mjg0N1oXDTQ2MDkw
ODE2Mjg0N1owQTELMAkGA1UEBhMCQlIxGDAWBgNVBAoMD0dlbmVyYWwgQnVyZ3Vl
cjEYMBYGA1UEAwwPR2VuZXJhbCBCdXJndWVyMIIBIjANBgkqhkiG9w0BAQEFAAOC
AQ8AMIIBCgKCAQEAtbYvbl1sjsjmX6kVduQrcrPShiqYGYjoo3OAdMUoxNTk37Ec
dLNqZc/GazF/KJiPeUzShs7iJSrSY0BJQawz8cDfLdy9Xptr0jpECuaWt5AH6xKB
P692TvvUPZN3vyeEX+wqFS992zQiP2pi19xxolMca1t4f/zs/ZbrUoDED7fWkiCF
3Gi+d0ZXc381klBqDVueoFqMl/sjdd9aajQk42LuerxTFtvcLOL+jRc808XWSVgG
iC2OBeVdsuZWEkY6/4zFFQrSYn2sz/7jBRDx0DV8NYbx64NvyKHTfgH2LYiDIDPb
JEspa9QlgMA5bmF7ZoqSktzi+QHspSgL06wLZwIDAQABo10wWzAMBgNVHRMBAf8E
AjAAMAsGA1UdDwQEAwIHgDAdBgNVHQ4EFgQUgCDACkfng0eFKDZfSEjOOGCh7rgw
HwYDVR0jBBgwFoAUBNKSsEXYkdnAwzAxj3su4E4VUxAwDQYJKoZIhvcNAQELBQAD
ggEBAHIdTQQL6B50122TG5T8+thAoMkMngCCdDOBfxE3mIfAM73uH+pgMAehx1XW
cl6ycsLTRuy/l2T9Z9HflkFmQFYHsVXxt28Lg7FwYE0jjmhE4psNwxoqp3H8e89y
u8Fp/3jxqpvj7lHIAeyzXzQ7z5zrpcQSQzrkHInGR09AG3e+wRFVlQoIaCt6emK3
AptPOLm9kM45DUQX3o2asE1P3U89Sg1nEqi2urhXaF0azucPc/I1Ep/T73rAbCxI
xtpBg8+o2AcWwVvrkqRm7o8kPUzHBZuXBTMfbBqYRsuDZ4ER/qGcAMyuHc3vHnF8
9qPU3hzsCiCs8jtpoZjs6Ji4ZVQ=
-----END CERTIFICATE-----
--START INTERMEDIATE CERT--
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
`;
