"use client";

import { Passo } from "./Passo";
import { extraComVezes, reais, totalItem } from "@/lib/formato";
import type { ItemCarrinho } from "@/lib/tipos";

/** As linhas do carrinho, com somar, tirar e remover. */
export function ItensCarrinho({
  itens,
  aoMudarQuantidade,
  aoRemover,
}: {
  itens: ItemCarrinho[];
  aoMudarQuantidade: (chave: string, delta: number) => void;
  aoRemover: (chave: string) => void;
}) {
  if (itens.length === 0) {
    return <p className="py-10 text-center text-sm text-creme-suave">Seu pedido está vazio.</p>;
  }

  return (
    <ul className="space-y-5">
      {itens.map((i) => (
        <li key={i.chave} className="flex gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-semibold leading-snug">
              {i.produto_nome}
              {i.variacao_nome && ` (${i.variacao_nome})`}
            </p>
            {i.adicionais.length > 0 && (
              <p className="text-xs text-creme-suave">
                + {i.adicionais.map(extraComVezes).join(", ")}
              </p>
            )}
            {i.observacao && <p className="text-xs italic text-preparo">“{i.observacao}”</p>}
            <div className="mt-2 flex items-center gap-2">
              <Passo
                rotulo={`Tirar um ${i.produto_nome}`}
                aoTocar={() => aoMudarQuantidade(i.chave, -1)}
              >
                −
              </Passo>
              <span className="tabular w-6 text-center font-display font-bold">{i.quantidade}</span>
              <Passo
                rotulo={`Somar um ${i.produto_nome}`}
                aoTocar={() => aoMudarQuantidade(i.chave, 1)}
              >
                +
              </Passo>
              <button
                type="button"
                onClick={() => aoRemover(i.chave)}
                className="ml-2 text-xs text-creme-fraco underline"
              >
                Remover
              </button>
            </div>
          </div>
          <span className="tabular shrink-0 font-semibold">{reais(totalItem(i))}</span>
        </li>
      ))}
    </ul>
  );
}
