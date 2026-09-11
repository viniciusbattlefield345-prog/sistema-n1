"use client";

import { useState, useTransition } from "react";
import { aprovarPedido, recusarPedido } from "./acoes";
import { duracao, hora, minutosDesde, numeroPedido, reais, rotuloPedido } from "@/lib/formato";
import type { Pedido } from "@/lib/tipos";

const MOTIVOS = ["Item acabou", "Pedido repetido", "Cozinha fechando", "Fale com o atendente"];

/** Pedido feito pelo QR, esperando alguém da equipe dizer sim ou não. */
export function CartaoAprovacao({ pedido }: { pedido: Pedido }) {
  const [recusando, setRecusando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();

  const rotulo = rotuloPedido(pedido);
  const nome = pedido.cliente_nome !== rotulo ? pedido.cliente_nome : null;

  function aprovar() {
    setErro(null);
    iniciar(async () => {
      const r = await aprovarPedido(pedido.id);
      if (!r.ok) setErro(r.erro);
    });
  }

  function recusar() {
    setErro(null);
    iniciar(async () => {
      const r = await recusarPedido(pedido.id, motivo);
      if (!r.ok) setErro(r.erro);
    });
  }

  return (
    <article className="rounded-2xl border-2 border-ouro/70 bg-carvao p-4">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-2xl font-extrabold uppercase leading-none text-ouro">
            {rotulo}
          </p>
          <p className="mt-1 text-sm text-creme-suave">
            Pedido {numeroPedido(pedido.numero_dia)} · {hora(pedido.criado_em)} · há{" "}
            {duracao(minutosDesde(pedido.criado_em))}
          </p>
          {nome && <p className="text-sm font-semibold text-creme">{nome}</p>}
        </div>
        <span className="tabular shrink-0 font-display text-xl font-bold">
          {reais(Number(pedido.total))}
        </span>
      </header>

      <ul className="mt-3 space-y-1.5 border-t border-borda pt-3 text-sm">
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

      {recusando ? (
        <div className="mt-4 space-y-2.5">
          <div className="flex flex-wrap gap-1.5">
            {MOTIVOS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMotivo(m)}
                aria-pressed={motivo === m}
                className={
                  "rounded-full border px-3 py-1.5 text-xs font-medium " +
                  (motivo === m
                    ? "border-cancelado bg-cancelado/15 text-cancelado"
                    : "border-borda text-creme-suave")
                }
              >
                {m}
              </button>
            ))}
          </div>
          <input
            className="campo"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            maxLength={120}
            placeholder="Motivo — o cliente vê no celular"
            aria-label="Motivo da recusa"
          />
          <div className="flex gap-2">
            <button type="button" className="btn btn-quieto" onClick={() => setRecusando(false)}>
              Voltar
            </button>
            <button type="button" className="btn btn-perigo flex-1" onClick={recusar} disabled={ocupado}>
              {ocupado ? "Recusando…" : "Recusar pedido"}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            className="btn btn-quieto"
            onClick={() => setRecusando(true)}
            disabled={ocupado}
          >
            Recusar
          </button>
          <button
            type="button"
            className="btn btn-ouro flex-1 py-3.5 text-base"
            onClick={aprovar}
            disabled={ocupado}
          >
            {ocupado ? "Aprovando…" : "Aprovar e imprimir"}
          </button>
        </div>
      )}
    </article>
  );
}
