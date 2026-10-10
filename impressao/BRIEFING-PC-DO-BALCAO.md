# Briefing — PC do balcão da General Burguer

Você está rodando **no computador da lanchonete**. Este arquivo é o repasse
de outra sessão do Claude, que construiu o sistema e conhece o banco. Leia
tudo antes de agir.

---

## O que é o sistema

**General Burguer** — lanchonete em Cachoeiro de Itapemirim (ES). Sistema web
em Next.js 16 + Supabase, **publicado na Vercel**:

- Sistema (precisa de login): **https://generalburguer.vercel.app**
- Cardápio da mesa (público, pelo QR): `/m/<codigo-da-mesa>`
- Link de tele-entrega (público): **https://generalburguer.vercel.app/pedir**
- Tela da impressora: **https://generalburguer.vercel.app/impressao**

> **Não rode o projeto localmente neste PC.** Não clone, não `npm install`,
> não suba servidor de desenvolvimento. O sistema já está no ar e este
> computador é só um cliente dele. O código só é alterado na outra máquina.

Como o pedido anda: cliente pede pelo QR da mesa (ou pelo link de entrega)
→ nasce com status `AGUARDANDO` → atendente aprova no celular → vai pra
cozinha **e cai na fila de impressão** → a aba `/impressao` aberta neste PC
pega da fila e manda pra impressora térmica via **QZ Tray**.

**Por isso a aba `/impressao` precisa ficar aberta neste computador. Se ela
fechar, nada imprime.** Esse é o ponto mais frágil de toda a operação, e
resolver isso é o seu trabalho principal aqui.

---

## Login

- Usuário: `admin@n1restaurante.com` (papel: dono)
- A senha **o Vinicius sabe** — peça pra ele digitar. Não tente adivinhar,
  não tente resetar.
- Existem também `arinete@n1restaurante.com` (atendente, é a dona da loja)
  e `vinicius@n1restaurante.com` (dono, nunca usado).

---

## O que já se sabe deste PC

- A impressora térmica **já está conectada e instalada** no Windows.
- No banco, a impressora está gravada como **`MP-4200 TH`** (Bematech, 80mm),
  com **42 colunas**, corte automático ligado, 1 via.
- O QZ Tray **pode ou não** estar instalado — confira.

---

## Tarefas, em ordem

### 1. QZ Tray + certificado

O QZ Tray é o programinha que conversa com a impressora USB. Sem o
certificado da General Burguer dentro dele, ele pergunta "Allow?" a **cada
cupom** — e a impressão nunca fica automática.

Já existe um script pronto que faz isso tudo. Baixe e rode **como
administrador**:

```powershell
irm https://raw.githubusercontent.com/viniciusbattlefield345-prog/sistema-n1/main/impressao/INSTALAR-NO-PC-DO-BALCAO.ps1 -OutFile "$env:TEMP\gb-qz.ps1"; powershell -NoProfile -ExecutionPolicy Bypass -File "$env:TEMP\gb-qz.ps1"
```

Ele instala o QZ pelo winget, grava o `override.crt` em
`C:\Program Files\QZ Tray\`, reinicia o QZ e espera a porta **8181** abrir.

Confira depois:

- `Test-Path "C:\Program Files\QZ Tray\override.crt"` → tem que ser `True`
- `Get-NetTCPConnection -State Listen -LocalPort 8181` → tem que retornar algo

### 2. Conferir o nome exato da impressora

```powershell
Get-Printer | Select-Object Name, PrinterStatus, PortName, DriverName
```

O nome tem que bater **letra por letra** com o que está no banco:
`MP-4200 TH`. Se estiver diferente (ex.: `MP-4200 TH (cópia 1)`), **não
renomeie no Windows** — avise o Vinicius com o nome exato, que ele acerta no
banco. Nome errado = o QZ não acha a impressora e nada sai.

### 3. Teste de impressão e largura do cupom

Abra `https://generalburguer.vercel.app/impressao`, faça login, escolha a
impressora na lista e clique em **"Imprimir um teste"**.

Se o QZ abrir uma janelinha perguntando, marque **"Remember this decision"**
e clique em **Allow**. Isso só pode acontecer uma vez; se continuar
perguntando a cada cupom, o certificado não está no lugar — volte ao passo 1.

**Depois que sair papel, meça a largura.** O sistema está em 42 colunas, mas
uma MP-4200 TH com papel de 80mm costuma caber **48**. Olhe o cupom de teste:

- Se as linhas de `=====` **não chegam até a borda** do papel, está estreito
  → avise que deve ir pra 48.
- Se o texto **quebra ou corta** na borda, está largo demais → avise.
- Se o papel for de 58mm, o número certo é **32**.

A troca é feita na tela Impressão, no campo de colunas, e vale pra todos os
cupons.

### 4. Windows: o PC não pode dormir

Esse é o erro clássico — a loja enche, o PC dorme, e os pedidos param de
imprimir sem ninguém entender por quê.

```powershell
powercfg /change standby-timeout-ac 0
powercfg /change hibernate-timeout-ac 0
powercfg /change disk-timeout-ac 0
powercfg /hibernate off
```

A tela pode apagar à vontade (`monitor-timeout-ac`), isso não atrapalha.

Desligue também o desligamento automático da porta USB, que derruba
impressora térmica no meio do movimento:

```powershell
powercfg /setacvalueindex SCHEME_CURRENT 2a737441-1930-4402-8d77-b2bebba308a3 48e6b7a6-50f5-4782-a5d4-53bb8f07e226 0
powercfg /setactive SCHEME_CURRENT
```

### 5. A aba tem que voltar sozinha depois de queda de luz

Crie um atalho na pasta de inicialização do Windows que abre a tela de
impressão em janela própria. Use o Chrome se existir; senão, o Edge.

```powershell
$inicio = [Environment]::GetFolderPath("Startup")
$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
if (-not (Test-Path $chrome)) { $chrome = "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" }
if (-not (Test-Path $chrome)) { $chrome = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" }

$ws = New-Object -ComObject WScript.Shell
$lnk = $ws.CreateShortcut((Join-Path $inicio "General Burguer - Impressao.lnk"))
$lnk.TargetPath = $chrome
$lnk.Arguments = '--app=https://generalburguer.vercel.app/impressao --disable-background-timer-throttling'
$lnk.Description = "Tela que imprime os pedidos. NAO FECHAR."
$lnk.Save()
```

O `--app` abre sem barra de endereço, o que reduz a chance de alguém fechar
por engano. O `--disable-background-timer-throttling` impede o navegador de
atrasar a conferência da fila quando a janela está minimizada.

Confirme que o QZ Tray também sobe sozinho (ele costuma se instalar assim):

```powershell
Get-CimInstance Win32_StartupCommand | Where-Object { $_.Command -like "*qz*" }
```

Se o login do Windows pedir senha, vale combinar com o Vinicius ligar o
login automático — senão, depois de queda de luz o PC volta na tela de senha
e nada imprime até alguém digitar.

### 6. Teste de verdade, de ponta a ponta

Peça pro Vinicius fazer um pedido pelo celular (link de entrega ou QR de
mesa) e aprovar. O cupom tem que sair **sozinho**, sem ninguém clicar nada
neste PC.

Se não sair, olhe nesta ordem:

1. A aba `/impressao` está aberta e logada?
2. O quadro "Impressão automática" nela diz **"Sem perguntar"**?
3. O QZ Tray está na bandeja, perto do relógio?
4. A fila na própria tela mostra o trabalho como `Não imprimiu`? A mensagem
   de erro aparece ali.

---

## O que NÃO fazer

- Não altere código, não faça deploy, não mexa no Supabase. Isso é feito na
  outra máquina, pela sessão que tem as credenciais.
- Não renomeie a impressora no Windows.
- Não troque a senha de ninguém.
- Não feche a aba `/impressao` ao terminar — ela é o serviço.

---

## No fim, relate ao Vinicius

1. Nome exato da impressora, como o Windows mostra.
2. QZ Tray: versão e se a porta 8181 respondeu.
3. O cupom de teste saiu? A largura ficou certa em 42 colunas, ou precisa
   mudar?
4. O atalho de inicialização foi criado?
5. O PC pede senha ao ligar?

---

## Pendências que não são deste PC (só pra você saber do contexto)

- O caixa **2 está aberto desde 01/10** — tem que ser fechado e um novo
  aberto no dia que a loja abrir, senão o relatório vem misturado com testes.
- A categoria **Bebidas está vazia** (zero produtos) — a lanchonete não
  vende bebida pelo sistema hoje.
- Dos **81 bairros** de Cachoeiro cadastrados, só **2 estão ativos** com
  taxa definida. O link de entrega só atende esses dois até alguém definir
  as taxas.
- Os QR codes das 10 mesas se imprimem em `/mesas/qr`, direto do site
  publicado (nunca de localhost, senão o QR aponta pro lugar errado).
