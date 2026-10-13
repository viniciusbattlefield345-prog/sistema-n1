"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Cabecalho, Vazio } from "@/components/Cabecalho";
import { FiltroPeriodo } from "@/components/FiltroPeriodo";
import { cancelarPedido, descancelarPedido, removerItem } from "./acoes";
import { reabrirConta } from "../mesas/acoes";
import { dataHora, extraComVezes, nomePagamento, numeroPedido, reais, rotuloPedido, telefone } from "@/lib/formato";
import type { Periodo } from "@/lib/periodo";
import type { ItemPedido, Pedido, StatusPedido } from "@/lib/tipos";

const COR: Record<StatusPedido, string> = {
  AGUARDANDO: "bg-ouro/20 text-ouro",
  PENDENTE: "bg-madeira text-creme-suave",
  "EM PREPARO": "bg-preparo/20 text-preparo",
  PRONTO: "bg-pronto/20 text-pronto",
  "SAIU PARA ENTREGA": "bg-pronto/20 text-pronto",
  CONCLUIDO: "bg-pronto/15 text-pronto",
  CANCELADO: "bg-cancelado/20 text-cancelado",
};

const FILTROS = ["Todos", "Em andamento", "Concluídos", "Cancelados"] as const;

/**
 * Até onde dá pra corrigir este pedido, e o que falta fazer antes.
 *
 * É a mesma regra do servidor (`podeMexer`), repetida aqui só pra tela não
 * oferecer um botão que vai falhar. Quem decide continua sendo o servidor.
 */
function situacaoEdicao(p: Pedido): {
  pode: boolean;
  contaPaga: boolean;
  recado: string | null;
} {
  if (p.caixas && p.caixas.status === "FECHADO")
    return {
      pode: false,
      contaPaga: false,
      recado: "Caixa já fechado e conferido — este pedido não muda mais.",
    };

  if (p.comandas && p.comandas.status !== "ABERTA")
    return {
      pode: false,
      contaPaga: p.comandas.status === "FECHADA",
      recado: "A conta desta mesa já foi paga. Reabra a conta pra poder corrigir.",
    };

  return { pode: true, contaPaga: false, recado: null };
}

export function ListaPedidos({
  pedidos,
  periodo,
  ehDono,
}: {
  pedidos: Pedido[];
  periodo: Periodo;
  ehDono: boolean;
}) {
  const [filtro, setFiltro] = useState<(typeof FILTROS)[number]>("Todos");
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();

  const lista = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return pedidos.filter((p) => {
      if (filtro === "Em andamento" && ["CONCLUIDO", "CANCELADO"].includes(p.status))
        return false;
      if (filtro === "Concluídos" && p.status !== "CONCLUIDO") return false;
      if (filtro === "Cancelados" && p.status !== "CANCELADO") return false;
      if (!t) return true;
      const digitos = t.replace(/\D/g, "");
      return (
        p.cliente_nome.toLowerCase().includes(t) ||
        rotuloPedido(p).toLowerCase().includes(t) ||
        String(p.numero_dia ?? "").includes(t) ||
        (digitos.length > 0 && (p.cliente_telefone ?? "").includes(digitos))
      );
    });
  }, [pedidos, filtro, busca]);

  const faturado = lista
    .filter((p) => p.status !== "CANCELADO" && p.status !== "AGUARDANDO")
    .reduce((s, p) => s + Number(p.total), 0);

  function acao(fn: () => Promise<{ ok: boolean; erro?: string }>, sucesso?: string) {
    setErro(null);
    setAviso(null);
    iniciar(async () => {
      const r = await fn();
      if (!r.ok) setErro(r.erro ?? "Não deu certo.");
      else if (sucesso) setAviso(sucesso);
    });
  }

  function cancelar(p: Pedido) {
    if (!confirm(`Cancelar o pedido ${numeroPedido(p.numero_dia)} (${rotuloPedido(p)})?`))
      return;
    acao(() => cancelarPedido(p.id), "Pedido cancelado.");
  }

  function descancelar(p: Pedido) {
    if (
      !confirm(
        `Reabrir o pedido ${numeroPedido(p.numero_dia)} (${rotuloPedido(p)})?\n\nEle volta a valer ${reais(Number(p.total))} e entra na fila da cozinha. Se a comida já tinha sido feita, acerte a situação na tela da cozinha.`,
      )
    )
      return;
    acao(() => descancelarPedido(p.id), "Pedido reaberto, está na fila da cozinha.");
  }

  function reabrir(p: Pedido) {
    const id = p.comandas?.id;
    if (!id) return;
    if (
      !confirm(
        `Reabrir a conta da ${rotuloPedido(p)}?\n\nO pagamento sai do caixa do dia e a conta volta pra aberta, com os mesmos pedidos. Corrija o que está errado e feche de novo no fim.`,
      )
    )
      return;
    acao(() => reabrirConta(id), "Conta reaberta. Corrija e feche de novo no fim.");
  }

  function tirarItem(p: Pedido, item: ItemPedido) {
    const naChapa = p.status === "PENDENTE" || p.status === "EM PREPARO";
    const texto =
      `Tirar ${Number(item.quantidade)}x ${item.produto_nome} do pedido ${numeroPedido(p.numero_dia)}?` +
      (naChapa ? " A cozinha já recebeu esse pedido — avise lá também." : "");
    if (!confirm(texto)) return;
    acao(() => removerItem(item.id), "Item tirado do pedido.");
  }

  return (
    <div className="p-4 lg:p-8">
      <Cabecalho
        fita="Histórico"
        titulo="Pedidos"
        descricao="Escolha o período, clique num pedido pra ver o que foi pedido e corrija o que estiver errado."
      />

      <FiltroPeriodo key={`${periodo.de}:${periodo.ate}`} periodo={periodo} />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-2">
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
          placeholder="Número, mesa, cliente ou telefone…"
          aria-label="Buscar pedido"
        />
        <p className="ml-auto text-sm text-creme-suave">
          {periodo.rotulo} · {lista.length} pedido(s) ·{" "}
          <strong className="tabular text-ouro">{reais(faturado)}</strong>
        </p>
      </div>

      {erro && (
        <p role="alert" className="mb-4 rounded-lg border border-cancelado/40 bg-cancelado/10 px-3 py-2 text-sm text-cancelado">
          {erro}
        </p>
      )}
      {aviso && (
        <p role="status" className="mb-4 rounded-lg border border-pronto/40 bg-pronto/10 px-3 py-2 text-sm text-pronto">
          {aviso}
        </p>
      )}

      {lista.length === 0 ? (
        <Vazio
          titulo="Nenhum pedido"
          texto={
            pedidos.length === 0
              ? `Nenhum pedido em ${periodo.rotulo.toLowerCase()}. Escolha outro período acima.`
              : "Nenhum pedido com esse filtro."
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-borda">
          <table className="w-full min-w-[46rem] text-sm">
            <thead className="bg-carvao text-left text-xs uppercase tracking-wide text-creme-suave">
              <tr>
                <th className="px-4 py-3 font-semibold">#</th>
                <th className="px-4 py-3 font-semibold">Onde</th>
                <th className="px-4 py-3 font-semibold">Cliente</th>
                <th className="px-4 py-3 font-semibold">Pagamento</th>
                <th className="px-4 py-3 font-semibold">Quando</th>
                <th className="px-4 py-3 text-right font-semibold">Total</th>
                <th className="px-4 py-3 font-semibold">Situação</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {lista.map((p) => {
                const edicao = situacaoEdicao(p);
                return (
                  <Fragment key={p.id}>
                    <tr
                      onClick={() => setAberto(aberto === p.id ? null : p.id)}
                      className="cursor-pointer border-t border-borda/60 hover:bg-carvao/60"
                    >
                      <td className="tabular px-4 py-3 font-display text-lg font-bold text-ouro">
                        {numeroPedido(p.numero_dia)}
                      </td>
                      <td className="px-4 py-3 font-medium text-creme">
                        {p.tipo === "MESA" && p.mesa_id ? (
                          <Link
                            href={`/mesas/${p.mesa_id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="underline-offset-2 hover:text-ouro hover:underline"
                          >
                            {rotuloPedido(p)}
                          </Link>
                        ) : (
                          rotuloPedido(p)
                        )}
                        {p.origem === "CLIENTE" && (
                          <span className="block text-xs font-normal text-creme-fraco">pelo QR</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-creme-suave">{p.cliente_nome}</span>
                        {p.cliente_telefone && (
                          <span className="block text-xs text-creme-fraco">
                            {telefone(p.cliente_telefone)}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-creme-suave">
                        {p.tipo !== "MESA"
                          ? (p.forma_pagamento ? nomePagamento(p.forma_pagamento) : "—")
                          : p.comandas?.status === "FECHADA"
                            ? "Conta paga"
                            : p.comandas?.status === "CANCELADA"
                              ? "Conta cancelada"
                              : "Na conta da mesa"}
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
                        {/*
                          Conta já paga: o caminho é reabrir, e o botão fica
                          aqui mesmo pra não obrigar o dono a procurar a mesa.
                        */}
                        {edicao.contaPaga && ehDono && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              reabrir(p);
                            }}
                            disabled={ocupado}
                            className="ml-4 text-xs text-ouro underline hover:text-ouro"
                          >
                            Reabrir conta
                          </button>
                        )}
                        {p.status !== "CANCELADO" && edicao.pode && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              cancelar(p);
                            }}
                            disabled={ocupado}
                            className="ml-4 text-xs text-creme-fraco underline hover:text-cancelado"
                          >
                            Cancelar
                          </button>
                        )}
                        {/* Cancelou errado: volta. Cancelar só marca, não apaga. */}
                        {p.status === "CANCELADO" && edicao.pode && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              descancelar(p);
                            }}
                            disabled={ocupado}
                            className="ml-4 text-xs text-pronto underline hover:text-pronto"
                          >
                            Reabrir pedido
                          </button>
                        )}
                      </td>
                    </tr>

                    {aberto === p.id && (
                      <tr className="border-t border-borda/60 bg-breu">
                        <td colSpan={8} className="px-6 py-4">
                          {p.tipo === "ENTREGA" && p.endereco_entrega && (
                            <p className="mb-3 text-sm text-creme-suave">
                              <span className="text-creme-fraco">Entregar em: </span>
                              {p.endereco_entrega}
                            </p>
                          )}
                          <ul className="space-y-1.5 text-sm">
                            {(p.itens_pedido ?? []).map((item) => (
                              <li key={item.id} className="flex items-start gap-2">
                                <span className="min-w-0 flex-1">
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
                                      {(item.item_adicionais ?? []).map(extraComVezes).join(", ")}
                                    </span>
                                  )}
                                  {item.observacao && (
                                    <span className="ml-2 italic text-preparo">
                                      obs: {item.observacao}
                                    </span>
                                  )}
                                </span>
                                {/*
                                  A linha errada sai daqui. A última não: pedido
                                  sem item nenhum valeria zero e continuaria na
                                  conta — aí é o Cancelar que resolve.
                                */}
                                {p.status !== "CANCELADO" &&
                                  edicao.pode &&
                                  (p.itens_pedido ?? []).length > 1 && (
                                    <button
                                      type="button"
                                      onClick={() => tirarItem(p, item)}
                                      disabled={ocupado}
                                      title="Tirar este item do pedido"
                                      aria-label={`Tirar ${item.produto_nome} do pedido`}
                                      className="shrink-0 rounded px-1.5 text-xs leading-5 text-creme-fraco hover:text-cancelado"
                                    >
                                      ✕
                                    </button>
                                  )}
                              </li>
                            ))}
                          </ul>

                          {edicao.recado && (
                            <p className="mt-3 flex flex-wrap items-center gap-3 text-xs text-creme-fraco">
                              {edicao.recado}
                              {edicao.contaPaga && ehDono && (
                                <button
                                  type="button"
                                  onClick={() => reabrir(p)}
                                  disabled={ocupado}
                                  className="btn btn-quieto px-3 py-1 text-xs"
                                >
                                  Reabrir conta
                                </button>
                              )}
                              {edicao.contaPaga && !ehDono && (
                                <span className="text-creme-fraco">Só a dona reabre.</span>
                              )}
                            </p>
                          )}

                          {p.motivo_recusa && (
                            <p className="mt-3 text-sm text-cancelado">Motivo: {p.motivo_recusa}</p>
                          )}
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
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
