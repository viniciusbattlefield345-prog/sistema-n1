"use client";

import { numero, totalItem } from "@/lib/formato";
import type { ItemCarrinho, TipoPedido } from "@/lib/tipos";

/**
 * A comanda e o cupom.
 * O que aparece aqui é o que sai na impressora — mesma fonte, mesmas
 * linhas tracejadas, mesma coluna de valor. Dá pra conferir antes de lançar.
 */
export function Comanda({
  itens,
  tipo,
  mesaNumero,
  clienteNome,
  endereco,
  taxa,
  desconto,
  aoRemover,
  aoMudarQuantidade,
}: {
  itens: ItemCarrinho[];
  tipo: TipoPedido;
  mesaNumero: number | null;
  clienteNome: string;
  endereco: string;
  taxa: number;
  desconto: number;
  aoRemover: (chave: string) => void;
  aoMudarQuantidade: (chave: string, delta: number) => void;
}) {
  const subtotal = itens.reduce((s, i) => s + totalItem(i), 0);
  const total = Math.max(subtotal + taxa - desconto, 0);
  const rotulo =
    tipo === "MESA" ? (mesaNumero ? `MESA ${mesaNumero}` : "MESA —") : tipo;

  return (
    <div className="cupom flex min-h-0 flex-1 flex-col bg-carvao px-4 py-3 text-creme">
      {/* cabecalho do cupom */}
      <div className="text-center">
        <p className="font-display text-base font-extrabold uppercase tracking-[0.1em] text-ouro">
          General Burguer
        </p>
      </div>

      <div className="cupom-linha my-2" />

      <div className="flex justify-between text-[0.72rem] text-creme-suave">
        <span className="font-bold text-creme">{rotulo}</span>
        <span>Pedido #—</span>
      </div>

      {clienteNome.trim() ? (
        <p className="mt-1 truncate font-bold uppercase">{clienteNome}</p>
      ) : (
        tipo !== "MESA" && <p className="mt-1 text-creme-fraco">Sem cliente</p>
      )}
      {tipo === "ENTREGA" && endereco.trim() && (
        <p className="text-[0.72rem] leading-snug text-creme-suave">{endereco}</p>
      )}

      <div className="cupom-linha-forte my-2" />

      {/* itens */}
      <div className="-mr-2 min-h-0 flex-1 overflow-y-auto pr-2">
        {itens.length === 0 ? (
          <p className="py-10 text-center text-[0.75rem] text-creme-fraco">
            Toque num produto para começar o pedido.
          </p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {itens.map((item) => (
              <li key={item.chave} className="group">
                <div className="flex items-start gap-2">
                  <span className="w-7 shrink-0 font-bold text-ouro">
                    {item.quantidade}x
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium leading-snug">
                      {item.produto_nome}
                      {item.variacao_nome && (
                        <span className="text-creme-suave"> · {item.variacao_nome}</span>
                      )}
                    </p>
                    {item.adicionais.map((a) => (
                      <p key={a.adicional_id} className="text-[0.7rem] text-creme-suave">
                        + {a.nome} ({numero(a.preco)})
                      </p>
                    ))}
                    {item.observacao && (
                      <p className="text-[0.7rem] italic text-preparo">
                        OBS: {item.observacao}
                      </p>
                    )}
                  </div>
                  <span className="w-[68px] shrink-0 text-right font-medium">
                    {numero(totalItem(item))}
                  </span>
                </div>

                {/* controles: discretos ate passar o mouse/foco; sempre visiveis no toque */}
                <div className="mt-1 flex gap-1 pl-7 transition-opacity focus-within:opacity-100 group-hover:opacity-100 [@media(hover:hover)]:opacity-0">
                  <button
                    type="button"
                    onClick={() => aoMudarQuantidade(item.chave, -1)}
                    className="rounded border border-borda px-2 py-0.5 text-xs text-creme-suave hover:border-ouro hover:text-ouro"
                    aria-label={`Tirar um ${item.produto_nome}`}
                  >
                    −
                  </button>
                  <button
                    type="button"
                    onClick={() => aoMudarQuantidade(item.chave, 1)}
                    className="rounded border border-borda px-2 py-0.5 text-xs text-creme-suave hover:border-ouro hover:text-ouro"
                    aria-label={`Somar um ${item.produto_nome}`}
                  >
                    +
                  </button>
                  <button
                    type="button"
                    onClick={() => aoRemover(item.chave)}
                    className="rounded border border-borda px-2 py-0.5 text-xs text-creme-fraco hover:border-cancelado hover:text-cancelado"
                    aria-label={`Remover ${item.produto_nome}`}
                  >
                    Remover
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* totais */}
      <div className="cupom-linha-forte my-2" />

      <div className="flex flex-col gap-1 text-[0.78rem]">
        <Linha rotulo="Subtotal" valor={subtotal} />
        {taxa > 0 && <Linha rotulo="Taxa de entrega" valor={taxa} />}
        {desconto > 0 && <Linha rotulo="Desconto" valor={-desconto} />}
      </div>

      <div className="mt-2 flex items-baseline justify-between border-t-2 border-borda-forte pt-2">
        <span className="font-display text-lg font-bold uppercase tracking-wide">Total</span>
        <span className="font-display text-3xl font-extrabold text-ouro tabular">
          {numero(total)}
        </span>
      </div>
    </div>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: number }) {
  return (
    <div className="flex justify-between text-creme-suave">
      <span>{rotulo}</span>
      <span className="tabular">{numero(valor)}</span>
    </div>
  );
}
