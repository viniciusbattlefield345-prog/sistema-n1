"use client";

/**
 * Ponte com o QZ Tray — o programinha que roda no PC do balcão e conversa
 * com a impressora USB. O site (mesmo na Vercel) fala com ele via
 * WebSocket no localhost, então imprimir não depende de servidor.
 */

import type { QzTray } from "qz-tray";

let qz: QzTray | null = null;

/** Carrega o qz-tray só no navegador — ele depende de WebSocket. */
async function carregar(): Promise<QzTray> {
  if (!qz) {
    const modulo = await import("qz-tray");
    const carregado = modulo.default ?? (modulo as unknown as QzTray);
    configurarAssinatura(carregado);
    qz = carregado;
  }
  return qz;
}

/**
 * Sem assinatura, o QZ Tray pergunta "permitir?" antes de CADA cupom — e a
 * impressão nunca fica automática. Com o certificado do General Burguer
 * instalado no QZ do PC (impressao/override.crt) e a chave privada no
 * servidor (QZ_CHAVE_PRIVADA), cada impressão sai assinada e o QZ imprime
 * sem perguntar.
 *
 * Enquanto o servidor não tiver a chave, o certificado não é entregue e o QZ
 * volta ao modo antigo: imprime, mas pergunta.
 */
function configurarAssinatura(q: QzTray) {
  q.security.setCertificatePromise((resolve) => {
    fetch("/api/qz/certificado", { cache: "no-store" })
      .then(async (r) => resolve(r.ok ? await r.text() : undefined))
      .catch(() => resolve(undefined));
  });

  q.security.setSignatureAlgorithm("SHA512");
  q.security.setSignaturePromise((mensagem) => (resolve) => {
    fetch("/api/qz/assinar", { method: "POST", body: mensagem, cache: "no-store" })
      .then(async (r) => resolve(r.ok ? await r.text() : ""))
      .catch(() => resolve(""));
  });
}

export class ImpressoraIndisponivel extends Error {
  constructor() {
    super(
      "O QZ Tray não está aberto neste computador. Abra o programa na bandeja do Windows e tente de novo.",
    );
    this.name = "ImpressoraIndisponivel";
  }
}

export async function conectar(): Promise<void> {
  const q = await carregar();
  if (q.websocket.isActive()) return;
  try {
    await q.websocket.connect({ retries: 2, delay: 1 });
  } catch {
    throw new ImpressoraIndisponivel();
  }
}

export async function estaConectado(): Promise<boolean> {
  const q = await carregar();
  return q.websocket.isActive();
}

/** Manda bytes ESC/POS já em base64 pra uma impressora nomeada. */
export async function imprimirCru(
  nomeImpressora: string,
  base64: string,
  vias = 1,
): Promise<void> {
  if (!nomeImpressora) {
    throw new Error("Nenhuma impressora escolhida. Escolha na tela Impressão.");
  }
  const q = await carregar();
  await conectar();

  const config = q.configs.create(nomeImpressora, { copies: Math.max(1, vias) });
  await q.print(config, [{ type: "raw", format: "base64", data: base64 }]);
}

/** Lista as impressoras instaladas no Windows. */
export async function listarImpressoras(): Promise<string[]> {
  const q = await carregar();
  await conectar();
  const lista = await q.printers.find();
  return Array.isArray(lista) ? lista : [lista];
}
