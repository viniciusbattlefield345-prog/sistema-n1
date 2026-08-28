"use client";

/**
 * Ponte com o QZ Tray — o programinha que roda no PC do caixa e conversa
 * com a impressora USB. O site (mesmo na Vercel) fala com ele via
 * WebSocket no localhost, então imprimir não depende de servidor.
 */

import type { QzTray } from "qz-tray";

let qz: QzTray | null = null;

/** Carrega o qz-tray só no navegador — ele depende de WebSocket. */
async function carregar(): Promise<QzTray> {
  if (!qz) {
    const modulo = await import("qz-tray");
    qz = modulo.default ?? (modulo as unknown as QzTray);
  }
  return qz;
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

/** Manda bytes ESC/POS já em base64 pra uma impressora nomeada. */
export async function imprimirCru(
  nomeImpressora: string,
  base64: string,
  vias = 1,
): Promise<void> {
  const q = await carregar();
  await conectar();

  const config = q.configs.create(nomeImpressora, { copies: Math.max(1, vias) });
  await q.print(config, [
    { type: "raw", format: "base64", data: base64 },
  ]);
}

/** Lista as impressoras instaladas — usado na tela de Configurações. */
export async function listarImpressoras(): Promise<string[]> {
  const q = await carregar();
  await conectar();
  const lista = await q.printers.find();
  return Array.isArray(lista) ? lista : [lista];
}
