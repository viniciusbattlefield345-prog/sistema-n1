# General Burguer — pedidos, mesas e delivery

Sistema da lanchonete General Burguer. Next.js 16 + Supabase, publicado na Vercel.

- **Mesa com QR code:** o cliente lê o QR da mesa, monta o pedido no celular e envia.
- **Aprovação:** o atendente aprova ou recusa pelo celular (tela **Mesas**).
- **Impressão automática:** aprovou, o cupom completo sai na impressora do balcão
  (tela **Impressão** aberta no PC + QZ Tray).
- **Conta da mesa:** os pedidos somam na comanda; no fim o atendente imprime a conta
  e fecha com uma ou mais formas de pagamento.
- **Balcão e WhatsApp:** o PDV continua lançando retirada e entrega (com bairro e taxa).

## Rodar no PC

```bash
npm install
npm run dev -- --port 3400
```

Precisa do `.env.local` (não vai pro Git):

| Variável | Pra quê |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | endereço do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | chave pública (publishable) |
| `SUPABASE_SERVICE_ROLE_KEY` | chave secreta — cardápio da mesa, pedido do QR, fotos e criação de acessos |
| `QZ_CHAVE_PRIVADA` | chave privada do certificado de impressão (sem ela, o QZ pergunta a cada cupom) |

As mesmas variáveis precisam estar na Vercel (Settings → Environment Variables).

## Banco

`supabase/general-burguer.sql` monta tudo: tabelas, triggers, segurança, tempo real,
pasta de fotos, cardápio e mesas 1 a 10. Roda inteiro no SQL Editor do Supabase.
Ele recomeça do zero, mas **mantém os logins**.

Projeto novo, sem nenhum login ainda: crie o usuário em Authentication → Users e rode
`supabase/03_dono.sql` para torná-lo dono.

## Impressão

A impressora térmica recebe ESC/POS (`src/lib/escpos.ts`, `src/lib/cupom.ts`) pelo
QZ Tray, que roda no PC do balcão. O celular não alcança a impressora: aprovar coloca o
cupom na tabela `fila_impressao`, e a tela `/impressao` — aberta no PC — pega e imprime.

Para o QZ não perguntar "permitir?" a cada cupom, cada impressão é assinada
(`/api/qz/assinar`) com a chave de `QZ_CHAVE_PRIVADA`, e o PC confia no certificado
`impressao/override.crt`. Passo a passo em `impressao/COMO-INSTALAR.txt`.

## QR codes das mesas

Menu **Mesas e QR codes** → **Imprimir QR codes**. O QR leva o endereço em que o sistema
está aberto na hora de imprimir — **imprima pelo endereço definitivo do site**. Se o
domínio mudar, os QR impressos param de funcionar.
