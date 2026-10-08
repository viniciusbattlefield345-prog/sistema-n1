"use client";

import { numeroPedido, reais } from "@/lib/formato";
import type { StatusPedido } from "@/lib/tipos";

/** O que o cliente precisa saber do pedido dele. Nem preço de custo, nem id interno. */
export interface PedidoAcompanhado {
  id: number;
  numero_dia: number | null;
  status: StatusPedido;
  total: number;
  motivo_recusa: string | null;
  itens: { nome: string; quantidade: number }[];
}

const FINAIS: StatusPedido[] = ["CONCLUIDO", "CANCELADO"];

/**
 * O mesmo status, dito de dois jeitos: na mesa o pedido é "entregue", na
 * entrega ele "saiu" e depois "chegou". O resto do caminho é igual.
 */
const SITUACAO: Record<StatusPedido, { texto: string; cor: string }> = {
  AGUARDANDO: { texto: "Esperando o atendente confirmar", cor: "text-ouro" },
  PENDENTE: { texto: "Confirmado · na fila da cozinha", cor: "text-preparo" },
  "EM PREPARO": { texto: "Sendo preparado", cor: "text-preparo" },
  PRONTO: { texto: "Pronto!", cor: "text-pronto" },
  "SAIU PARA ENTREGA": { texto: "Saiu pra entrega", cor: "text-pronto" },
  CONCLUIDO: { texto: "Entregue", cor: "text-creme-suave" },
  CANCELADO: { texto: "Não foi aceito", cor: "text-cancelado" },
};

export function MeusPedidos({ pedidos }: { pedidos: PedidoAcompanhado[] }) {
  if (pedidos.length === 0) return null;

  return (
    <section aria-live="polite" className="mx-4 mt-3 rounded-2xl border border-borda bg-carvao p-4">
      <h2 className="mb-3 font-display text-xs font-bold uppercase tracking-[0.16em] text-creme-suave">
        Seus pedidos
      </h2>
      <ul className="space-y-3">
        {pedidos.map((p, indice) => (
          <li
            key={p.id}
            style={{ "--i": Math.min(indice, 5) } as React.CSSProperties}
            className="anim-entrar border-t border-borda pt-3 first:border-0 first:pt-0"
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-display font-bold">Pedido {numeroPedido(p.numero_dia)}</span>
              <span className="tabular text-sm text-creme-suave">{reais(p.total)}</span>
            </div>
            <p
              className={
                "mt-0.5 flex items-center gap-1.5 text-sm font-semibold " + SITUACAO[p.status].cor
              }
            >
              {/* pedido ainda andando: o pontinho pisca pra mostrar que está vivo */}
              {!FINAIS.includes(p.status) && (
                <span aria-hidden className="anim-batida size-1.5 shrink-0 rounded-full bg-current" />
              )}
              {SITUACAO[p.status].texto}
            </p>
            {p.status === "CANCELADO" && p.motivo_recusa && (
              <p className="text-xs text-creme-suave">Motivo: {p.motivo_recusa}</p>
            )}
            <p className="mt-1 text-xs leading-snug text-creme-fraco">
              {p.itens.map((i) => `${i.quantidade}x ${i.nome}`).join(" · ")}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
