"use client";

import { useState, useTransition } from "react";
import { mudarStatus } from "../cozinha/acoes";
import { reimprimirPedido } from "../mesas/acoes";
import {
  duracao,
  hora,
  minutosDesde,
  nomePagamento,
  numeroPedido,
  reais,
  telefone,
} from "@/lib/formato";
import type { Pedido, StatusPedido } from "@/lib/tipos";

const COR: Partial<Record<StatusPedido, string>> = {
  PENDENTE: "border-borda",
  "EM PREPARO": "border-preparo/50",
  PRONTO: "border-pronto/60",
  "SAIU PARA ENTREGA": "border-pronto/60",
  CONCLUIDO: "border-borda",
};

/**
 * Um pedido de entrega ou retirada depois de aprovado.
 *
 * O que importa aqui é diferente da mesa: endereço, telefone e troco. O botão
 * grande é sempre o próximo passo do pedido — nunca uma lista de opções.
 */
export function CartaoEntrega({ pedido, indice = 0 }: { pedido: Pedido; indice?: number }) {
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();

  const ehEntrega = pedido.tipo === "ENTREGA";
  const troco = Number(pedido.troco_para);
  const taxa = Number(pedido.taxa_entrega);

  function acao(fn: () => Promise<{ ok: boolean; erro?: string }>) {
    setErro(null);
    iniciar(async () => {
      const r = await fn();
      if (!r.ok) setErro(r.erro ?? "Não deu certo.");
    });
  }

  /** O próximo passo, e só ele. Retirada pula a rua: vai de pronto a entregue. */
  const proximo: { rotulo: string; status: StatusPedido } | null =
    pedido.status === "PRONTO"
      ? ehEntrega
        ? { rotulo: "Saiu para entrega", status: "SAIU PARA ENTREGA" }
        : { rotulo: "Cliente retirou", status: "CONCLUIDO" }
      : pedido.status === "SAIU PARA ENTREGA"
        ? { rotulo: "Entregue", status: "CONCLUIDO" }
        : null;

  return (
    <article
      style={{ "--i": Math.min(indice, 4) } as React.CSSProperties}
      className={
        "anim-entrar rounded-2xl border bg-carvao p-4 " + (COR[pedido.status] ?? "border-borda")
      }
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-xl font-extrabold uppercase leading-none text-ouro">
            {ehEntrega ? "Entrega" : "Retirada"}
          </p>
          <p className="mt-1 text-sm text-creme-suave">
            Pedido {numeroPedido(pedido.numero_dia)} · {hora(pedido.criado_em)} · há{" "}
            {duracao(minutosDesde(pedido.criado_em))}
          </p>
          <p className="text-sm font-semibold text-creme">{pedido.cliente_nome}</p>
        </div>
        <span className="tabular shrink-0 font-display text-xl font-bold">
          {reais(Number(pedido.total))}
        </span>
      </header>

      <div className="mt-3 space-y-1 rounded-xl border border-borda bg-breu/60 px-3 py-2.5 text-sm">
        {pedido.cliente_telefone && (
          <a
            href={`tel:${pedido.cliente_telefone}`}
            className="block font-semibold text-ouro underline underline-offset-2"
          >
            {telefone(pedido.cliente_telefone)}
          </a>
        )}
        {ehEntrega && pedido.endereco_entrega && (
          <p className="leading-snug text-creme-suave">{pedido.endereco_entrega}</p>
        )}
        <p className="text-creme-suave">
          {pedido.forma_pagamento ? nomePagamento(pedido.forma_pagamento) : "Pagamento a combinar"}
          {taxa > 0 && ` · entrega ${reais(taxa)}`}
          {pedido.forma_pagamento === "Dinheiro" && troco > 0 && (
            <span className="font-semibold text-preparo">
              {" "}
              · levar {reais(Math.max(troco - Number(pedido.total), 0))} de troco
            </span>
          )}
        </p>
      </div>

      <ul className="mt-3 space-y-1 border-t border-borda pt-3 text-sm">
        {(pedido.itens_pedido ?? []).map((item) => (
          <li key={item.id}>
            <span className="font-bold text-ouro">{Number(item.quantidade)}x </span>
            <span className="font-medium">
              {item.produto_nome}
              {item.variacao_nome && ` (${item.variacao_nome})`}
            </span>
            {(item.item_adicionais ?? []).length > 0 && (
              <p className="pl-6 text-xs text-creme-suave">
                + {(item.item_adicionais ?? []).map((a) => a.nome).join(", ")}
              </p>
            )}
            {item.observacao && (
              <p className="pl-6 text-xs font-semibold text-preparo">{item.observacao}</p>
            )}
          </li>
        ))}
      </ul>

      {pedido.observacao && (
        <p className="mt-2 text-sm text-preparo">
          <strong>Obs.:</strong> {pedido.observacao}
        </p>
      )}

      {erro && (
        <p
          role="alert"
          className="mt-3 rounded-lg border border-cancelado/40 bg-cancelado/10 px-3 py-2 text-sm text-cancelado"
        >
          {erro}
        </p>
      )}

      <div className="mt-4 flex gap-2">
        {proximo && (
          <button
            type="button"
            disabled={ocupado}
            onClick={() => acao(() => mudarStatus(pedido.id, proximo.status))}
            className="btn btn-ouro flex-1 py-3"
          >
            {proximo.rotulo}
          </button>
        )}
        <button
          type="button"
          disabled={ocupado}
          onClick={() => acao(() => reimprimirPedido(pedido.id))}
          className={"btn btn-quieto py-3 " + (proximo ? "" : "flex-1")}
        >
          Reimprimir
        </button>
      </div>
    </article>
  );
}
