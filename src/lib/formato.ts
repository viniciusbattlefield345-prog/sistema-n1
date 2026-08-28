import type { ItemCarrinho } from "./tipos";

const MOEDA = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

/** 12.5 -> "R$ 12,50" */
export const reais = (v: number | null | undefined) => MOEDA.format(v ?? 0);

/** 12.5 -> "12,50" (sem simbolo, pra coluna do cupom) */
export const numero = (v: number | null | undefined) =>
  (v ?? 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/** Aceita "12,50" ou "12.50" e devolve 12.5. Texto invalido vira 0. */
export function paraNumero(texto: string): number {
  const limpo = texto.replace(/[^\d,.-]/g, "").replace(",", ".");
  const n = Number.parseFloat(limpo);
  return Number.isFinite(n) ? n : 0;
}

const FUSO = "America/Sao_Paulo";

/** "2026-08-28T14:32:00Z" -> "14:32" */
export const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: FUSO,
  });

/** "2026-08-28T14:32:00Z" -> "28/08 14:32" */
export const dataHora = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: FUSO,
  });

/** Minutos desde que o pedido entrou — o KDS usa pra cobrar a cozinha. */
export function minutosDesde(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
}

/** 3 -> "#03" */
export const numeroPedido = (n: number | null) =>
  "#" + String(n ?? 0).padStart(2, "0");

/** "28998839321" -> "(28) 99883-9321" */
export function telefone(bruto: string | null | undefined): string {
  const d = (bruto ?? "").replace(/\D/g, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return bruto ?? "";
}

/** Preco final de um item: base/variacao + adicionais, vezes a quantidade. */
export function totalItem(item: ItemCarrinho): number {
  const extras = item.adicionais.reduce((s, a) => s + a.preco, 0);
  return (item.preco_unitario + extras) * item.quantidade;
}

/** Soma dos itens do carrinho, sem taxa de entrega e sem desconto. */
export function subtotalCarrinho(itens: ItemCarrinho[]): number {
  return itens.reduce((s, i) => s + totalItem(i), 0);
}
