"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Cabecalho, Vazio } from "@/components/Cabecalho";
import { cancelarPedido } from "./acoes";
import { reais, dataHora, numeroPedido, telefone } from "@/lib/formato";
import type { Pedido, StatusPedido } from "@/lib/tipos";

const COR: Record<StatusPedido, string> = {
  PENDENTE: "bg-madeira text-creme-suave",
  "EM PREPARO": "bg-preparo/20 text-preparo",
  PRONTO: "bg-pronto/20 text-pronto",
  "SAIU PARA ENTREGA": "bg-ouro/20 text-ouro",
  CONCLUIDO: "bg-pronto/15 text-pronto",
  CANCELADO: "bg-cancelado/20 text-cancelado",
};

const FILTROS = ["Todos", "Em andamento", "Concluídos", "Cancelados"] as const;

export function ListaPedidos({ pedidos }: { pedidos: Pedido[] }) {
  const [filtro, setFiltro] = useState<(typeof FILTROS)[number]>("Todos");
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [, iniciar] = useTransition();

  const lista = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return pedidos.filter((p) => {
      if (filtro === "Em andamento" && ["CONCLUIDO", "CANCELADO"].includes(p.status))
        return false;
      if (filtro === "Concluídos" && p.status !== "CONCLUIDO") return false;
      if (filtro === "Cancelados" && p.status !== "CANCELADO") return false;
      if (!t) return true;
      return (
        p.cliente_nome.toLowerCase().includes(t) ||
        String(p.numero_dia ?? "").includes(t) ||
        (p.cliente_telefone ?? "").includes(t.replace(/\D/g, ""))
      );
    });
  }, [pedidos, filtro, busca]);

  const faturado = lista
    .filter((p) => p.status !== "CANCELADO")
    .reduce((s, p) => s + Number(p.total), 0);

  function cancelar(p: Pedido) {
    if (!confirm(`Cancelar o pedido ${numeroPedido(p.numero_dia)} de ${p.cliente_nome}?`))
      return;
    setErro(null);
    iniciar(async () => {
      const r = await cancelarPedido(p.id);
      if (!r.ok) setErro(r.erro);
    });
  }

  return (
    <div className="p-4 lg:p-8">
      <Cabecalho
        fita="Histórico"
        titulo="Pedidos"
        descricao="Os últimos 7 dias. Clique num pedido para ver o que foi pedido, ou reimprima o cupom."
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex gap-2">
          {FILTROS.map((f) => (
            <button
              key={f}
              onClick={() => setFiltro(f)}
              aria-pressed={filtro === f}
              className={
                "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors " +
                (filtro === f
                  ? "border-ouro bg-ouro/15 text-ouro"
                  : "border-borda text-creme-suave hover:border-borda-forte")
              }
            >
              {f}
            </button>
          ))}
        </div>
        <input
          className="campo max-w-xs"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Número, cliente ou telefone…"
          aria-label="Buscar pedido"
        />
        <p className="ml-auto text-sm text-creme-suave">
          {lista.length} pedido(s) ·{" "}
          <strong className="tabular text-ouro">{reais(faturado)}</strong>
        </p>
      </div>

      {erro && (
        <p role="alert" className="mb-4 rounded-lg border border-cancelado/40 bg-cancelado/10 px-3 py-2 text-sm text-cancelado">
          {erro}
        </p>
      )}

      {lista.length === 0 ? (
        <Vazio
          titulo="Nenhum pedido"
          texto={
            pedidos.length === 0
              ? "Ainda não houve pedido nos últimos 7 dias."
              : "Nenhum pedido com esse filtro."
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-borda">
          <table className="w-full min-w-[42rem] text-sm">
            <thead className="bg-carvao text-left text-xs uppercase tracking-wide text-creme-suave">
              <tr>
                <th className="px-4 py-3 font-semibold">#</th>
                <th className="px-4 py-3 font-semibold">Cliente</th>
                <th className="px-4 py-3 font-semibold">Tipo</th>
                <th className="px-4 py-3 font-semibold">Pagamento</th>
                <th className="px-4 py-3 font-semibold">Quando</th>
                <th className="px-4 py-3 text-right font-semibold">Total</th>
                <th className="px-4 py-3 font-semibold">Situação</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {lista.map((p) => (
                <>
                  <tr
                    key={p.id}
                    onClick={() => setAberto(aberto === p.id ? null : p.id)}
                    className="cursor-pointer border-t border-borda/60 hover:bg-carvao/60"
                  >
                    <td className="tabular px-4 py-3 font-display text-lg text-ouro">
                      {numeroPedido(p.numero_dia)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-creme">{p.cliente_nome}</span>
                      {p.cliente_telefone && (
                        <span className="block text-xs text-creme-fraco">
                          {telefone(p.cliente_telefone)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-creme-suave">
                      {p.tipo_entrega === "ENTREGA" ? "Entrega" : "Retirada"}
                    </td>
                    <td className="px-4 py-3 text-creme-suave">
                      {p.forma_pagamento ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-creme-suave">{dataHora(p.criado_em)}</td>
                    <td className="tabular px-4 py-3 text-right font-medium text-creme">
                      {reais(Number(p.total))}
                    </td>
                    <td className="px-4 py-3">
                      <span className={"rounded-full px-2.5 py-1 text-xs font-semibold " + COR[p.status]}>
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <Link
                        href={`/imprimir/${p.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs text-creme-suave underline hover:text-ouro"
                      >
                        Imprimir
                      </Link>
                      {!["CONCLUIDO", "CANCELADO"].includes(p.status) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            cancelar(p);
                          }}
                          className="ml-4 text-xs text-creme-fraco underline hover:text-cancelado"
                        >
                          Cancelar
                        </button>
                      )}
                    </td>
                  </tr>

                  {aberto === p.id && (
                    <tr key={`${p.id}-detalhe`} className="border-t border-borda/60 bg-breu">
                      <td colSpan={8} className="px-6 py-4">
                        {p.tipo_entrega === "ENTREGA" && p.endereco_entrega && (
                          <p className="mb-3 text-sm text-creme-suave">
                            <span className="text-creme-fraco">Entregar em: </span>
                            {p.endereco_entrega}
                          </p>
                        )}
                        <ul className="space-y-1.5 text-sm">
                          {(p.itens_pedido ?? []).map((item) => (
                            <li key={item.id}>
                              <span className="font-bold text-ouro">
                                {Number(item.quantidade)}x{" "}
                              </span>
                              <span className="text-creme">
                                {item.produto_nome}
                                {item.variacao_nome && ` (${item.variacao_nome})`}
                              </span>
                              {(item.item_adicionais ?? []).length > 0 && (
                                <span className="text-creme-suave">
                                  {" — "}
                                  {(item.item_adicionais ?? []).map((a) => a.nome).join(", ")}
                                </span>
                              )}
                              {item.observacao && (
                                <span className="ml-2 italic text-preparo">
                                  obs: {item.observacao}
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                        {Number(p.taxa_entrega) > 0 && (
                          <p className="mt-3 text-sm text-creme-suave">
                            Taxa de entrega: {reais(Number(p.taxa_entrega))}
                          </p>
                        )}
                        {p.forma_pagamento === "Dinheiro" && Number(p.troco_para) > 0 && (
                          <p className="text-sm text-creme-suave">
                            Troco para {reais(Number(p.troco_para))} — levar{" "}
                            {reais(Math.max(Number(p.troco_para) - Number(p.total), 0))}
                          </p>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
