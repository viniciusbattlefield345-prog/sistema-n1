"use client";

import { useTransition } from "react";
import { editarItem, removerItem } from "../pedidos/acoes";
import { extraComVezes, reais } from "@/lib/formato";
import type { ItemPedido } from "@/lib/tipos";

/** O que a linha vale: o item com os adicionais dele, pela quantidade. */
function valorDaLinha(item: ItemPedido): number {
  const extras = (item.item_adicionais ?? []).reduce(
    (s, a) => s + Number(a.preco) * Number(a.quantidade),
    0,
  );
  return (Number(item.preco_unitario) + extras) * Number(item.quantidade);
}

/**
 * O que JÁ está no pedido, enquanto o atendente acrescenta o resto.
 *
 * Aqui cada toque vale na hora: não é carrinho, é o pedido de verdade. O −
 * e o + mudam a quantidade no banco e o ✕ tira a linha, e o preço unitário
 * nunca é recalculado — o que foi combinado com o cliente fica valendo,
 * mesmo que o cardápio tenha mudado de preço depois.
 *
 * A última linha não sai: pedido sem item nenhum valeria zero e continuaria
 * na conta. Quem quer tirar tudo está cancelando o pedido, e isso tem botão
 * próprio na tela de Pedidos.
 */
export function ItensDoPedido({
  itens,
  aoFalhar,
  aoMudar,
}: {
  itens: ItemPedido[];
  aoFalhar: (erro: string) => void;
  aoMudar: () => void;
}) {
  const [ocupado, iniciar] = useTransition();

  function mandar(fn: () => Promise<{ ok: boolean; erro?: string }>) {
    iniciar(async () => {
      const r = await fn();
      if (!r.ok) aoFalhar(r.erro ?? "Não deu certo.");
      else aoMudar();
    });
  }

  if (itens.length === 0)
    return <p className="text-sm text-creme-fraco">Esse pedido está sem itens.</p>;

  return (
    <ul className="space-y-2">
      {itens.map((item) => (
        <li
          key={item.id}
          className="flex items-start gap-2 rounded-lg border border-borda bg-breu px-2.5 py-2"
        >
          <span className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() =>
                mandar(() => editarItem(item.id, { quantidade: Number(item.quantidade) - 1 }))
              }
              disabled={ocupado || Number(item.quantidade) <= 1}
              aria-label={`Diminuir ${item.produto_nome}`}
              className="size-6 rounded border border-borda text-sm leading-none text-creme-suave disabled:opacity-30 hover:border-borda-forte"
            >
              −
            </button>
            <span className="tabular w-6 text-center text-sm font-bold text-ouro">
              {Number(item.quantidade)}
            </span>
            <button
              type="button"
              onClick={() =>
                mandar(() => editarItem(item.id, { quantidade: Number(item.quantidade) + 1 }))
              }
              disabled={ocupado}
              aria-label={`Aumentar ${item.produto_nome}`}
              className="size-6 rounded border border-borda text-sm leading-none text-creme-suave disabled:opacity-30 hover:border-borda-forte"
            >
              +
            </button>
          </span>

          <span className="min-w-0 flex-1 text-sm">
            <span className="text-creme">
              {item.produto_nome}
              {item.variacao_nome && ` (${item.variacao_nome})`}
            </span>
            {(item.item_adicionais ?? []).length > 0 && (
              <span className="block text-xs text-creme-suave">
                + {(item.item_adicionais ?? []).map(extraComVezes).join(", ")}
              </span>
            )}
            {item.observacao && (
              <span className="block text-xs font-semibold text-preparo">{item.observacao}</span>
            )}
          </span>

          <span className="tabular shrink-0 text-sm text-creme-suave">
            {reais(valorDaLinha(item))}
          </span>

          <button
            type="button"
            onClick={() => mandar(() => removerItem(item.id))}
            disabled={ocupado || itens.length <= 1}
            title={
              itens.length <= 1
                ? "É o único item. Cancele o pedido na tela de Pedidos."
                : "Tirar este item do pedido"
            }
            aria-label={`Tirar ${item.produto_nome} do pedido`}
            className="shrink-0 rounded px-1 text-xs leading-5 text-creme-fraco disabled:opacity-30 hover:text-cancelado"
          >
            ✕
          </button>
        </li>
      ))}
    </ul>
  );
}
