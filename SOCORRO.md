# Deu problema. Comece aqui.

Guia de emergência do General Burguer. Ordem dos sintomas = ordem do que mais
acontece na vida real, não do que é mais interessante.

**Regra de ouro: não apague nada antes de olhar.** Já se jogou cupom fora aqui
por "limpar a fila" sem conferir o que tinha nela.

---

## 1. "Não está imprimindo"

De longe o mais comum. O caminho do cupom tem 5 etapas e o problema pode estar
em qualquer uma. Descubra **qual** antes de mexer.

### Primeiro: a impressora está viva?

Esse teste **não passa pelo computador** e por isso é o melhor:

> Desligue a impressora. Segure o botão **FEED** apertado e, sem soltar,
> ligue. Solte depois de 2 segundos.

- **Saiu a folha de autoteste** → impressora viva. Vá pro item "o PC não a enxerga".
- **Não saiu nada** → é a impressora, o papel ou a energia. Mexer no PC não resolve:
  - Luz acesa? Tomada funciona?
  - Abra a tampa: **papel térmico só imprime de um lado**. Rolo virado = sai
    papel em branco, ou não sai. Vire e teste.
  - Feche a tampa até ouvir o clique dos **dois** lados.

> ⚠️ **Não use o teste DLE EOT da COM3 pra decidir isso.** Ele já disse "muda"
> duas vezes com a impressora funcionando normal (23/10 e 25/10/2026). A porta
> é do driver, não é serial pura, e não devolve o status. O autoteste do FEED é
> que vale.

### A impressora está viva, mas o PC não a enxerga

Tire o cabo USB e ponha de volta, **numa porta diferente**. Se não resolver,
reinstalar a porta pelo Windows resolveu em 23/10/2026.

### A impressora está viva e o PC a enxerga, mas o cupom não chega

Olhe a janela da estação de impressão no PC do balcão. Ela diz no topo:

- **"QZ TRAY — Conectado"** em verde → o caminho está aberto
- Qualquer outra coisa → feche a janela. O vigia reabre sozinha em até 1 minuto.

**Se o vigia não reabrir:** ele pode estar preso. Depois de uma queda longa o
contador de falhas dele cresce e ele passa até **30 minutos sem nem tentar** —
e reiniciar a tarefa agendada **não resolve**, porque o contador vive num
arquivo. O destrave é:

1. Abra `C:\gb\vigia-estado.json`
2. Troque `"falhas": N` por `"falhas": 0` e `"ultima": "..."` por `"ultima": null`
3. Salve e rode a tarefa `GB-vigia-impressao` pelo Agendador de Tarefas

Em ~15 segundos o `C:\gb\vigia.log` deve escrever *"conexao de volta"*.

### Como saber se o sistema fez a parte dele

No `C:\Users\IT\AppData\Roaming\qz\debug.log`, procure a hora do pedido:

- **`Printing complete`** → o sistema entregou tudo certo. **O problema é físico.**
- **`Bad signature on request`** → problema de assinatura (veja o item 3)
- **Nada sobre aquela hora** → o cupom nem chegou no QZ: é a página/fila

---

## 2. "O site não abre" / tela preta

Abra `https://generalburguer.vercel.app` em qualquer celular e veja **o que
exatamente** aparece:

| O que aparece | O que é | O que fazer |
|---|---|---|
| "This deployment is temporarily paused" | A Vercel desligou o projeto | Painel da Vercel → o aviso vermelho no topo diz o motivo |
| Erro 404 | Deploy quebrado ou endereço solto | Ver os deploys no painel |
| Erro 500 | Erro do código ou variável faltando | Ver os logs no painel |
| Demora e não carrega | Internet da lanchonete | Testar outro site no mesmo wi-fi |

**Se for pausa:** o aviso diz se foi consumo ou cobrança. Pausa por consumo tem
data pra acabar, e o botão "Upgrade to Pro" religa na hora. Em 25/10/2026 isso
aconteceu e custou um dia.

**A loja pode continuar vendendo?** Sim, no papel, e lançar depois. O que não dá
é a mesa pedir pelo QR.

---

## 3. Janela de permissão do QZ aparecendo do nada

A janela diz uma de duas coisas, e elas têm causas diferentes:

- **"Invalid Signature"** → o servidor está assinando errado. Quase sempre a
  variável `QZ_CHAVE_PRIVADA` na Vercel. A chave certa é a do arquivo
  `qz-chave-privada.pem` (fora do Git, não suba isso em lugar nenhum).
- **"Untrusted website" / "An anonymous request"** → a janela da estação está
  com a sessão vencida e recebeu a tela de login no lugar do certificado.
  Feche a janela e deixe o vigia reabrir.

Clicar em **Allow** destrava aquele cupom e não estraga nada — é paliativo, não
conserto.

---

## 4. Antes de me chamar, tenha essas 3 respostas

Elas economizam metade do tempo:

1. **O autoteste do FEED imprime?** (separa impressora de computador)
2. **O que exatamente aparece na tela?** Foto serve. "Não funciona" não diz nada;
   "402 Payment Required" diz tudo.
3. **Parou de funcionar depois de quê?** Alguém mexeu, acabou a luz, atualizou
   alguma coisa, ou simplesmente parou?

---

## O que nunca fazer no desespero

- **Apagar linhas da `fila_impressao`** sem olhar o que são. Cupom apagado não volta.
- **Apagar o projeto na Vercel.** Pausado ele não atrapalha, e apagar é definitivo.
- **Reinstalar o QZ Tray** por cima sem matar o que já roda: fica mais de um
  aberto, cada um numa porta, e a página conversa com o errado.
- **Mudar o endereço do sistema.** Os QR das mesas estão impressos apontando pra
  `generalburguer.vercel.app`. Trocar o endereço invalida todos de uma vez.
