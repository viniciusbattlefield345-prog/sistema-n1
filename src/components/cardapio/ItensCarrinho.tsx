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
              {/*
                Tirar do pedido tem que ser tão fácil quanto colocar. Era um
                link cinza de 12px no meio dos botões redondos — quem escolheu
                errado não achava, e acabava chamando o atendente pra desfazer
                um toque. Agora é botão, do tamanho do dedo, e com a cor de
                quem desfaz.
              */}
              <button
                type="button"
                onClick={() => aoRemover(i.chave)}
                aria-label={`Tirar ${i.produto_nome} do pedido`}
                className="ml-auto rounded-lg border border-cancelado/40 px-3 py-2 text-xs font-semibold text-cancelado"
              >
                Tirar
              </button>
            </div>
          </div>
          <span className="tabular shrink-0 font-semibold">{reais(totalItem(i))}</span>
        </li>
      ))}
    </ul>
  );
}
