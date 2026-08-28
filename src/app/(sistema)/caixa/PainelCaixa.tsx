"use client";

import { useState, useTransition } from "react";
import { Cabecalho } from "@/components/Cabecalho";
import { abrirCaixa, fecharCaixa } from "./acoes";
import { reais, paraNumero, dataHora } from "@/lib/formato";
import type { Caixa, FormaPagamento } from "@/lib/tipos";
import type { ResumoPagamento } from "./page";

const ROTULO: Record<FormaPagamento, string> = {
  Dinheiro: "Dinheiro",
  Pix: "Pix",
  "Cartao Debito": "Cartão débito",
  "Cartao Credito": "Cartão crédito",
};

export function PainelCaixa({
  aberto,
  resumo,
  quantidade,
  historico,
}: {
  aberto: Caixa | null;
  resumo: ResumoPagamento;
  quantidade: number;
  historico: Caixa[];
}) {
  const [valorAbertura, setValorAbertura] = useState("");
  const [valorContado, setValorContado] = useState("");
  const [observacao, setObservacao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();

  const vendas = Object.values(resumo).reduce((s, v) => s + v, 0);
  const esperadoNaGaveta = Number(aberto?.valor_abertura ?? 0) + resumo.Dinheiro;
  const contado = paraNumero(valorContado);
  const diferenca = valorContado ? contado - esperadoNaGaveta : null;

  function acao(fn: () => Promise<{ ok: boolean; erro?: string }>) {
    setErro(null);
    iniciar(async () => {
      const r = await fn();
      if (!r.ok) setErro(r.erro ?? "Não deu certo.");
    });
  }

  return (
    <div className="p-8">
      <Cabecalho
        fita={aberto ? "Caixa aberto" : "Caixa fechado"}
        titulo="Caixa"
        descricao="Todo pedido fica amarrado ao caixa do dia. É por isso que o fechamento bate."
      />

      {erro && (
        <p
          role="alert"
          className="mb-5 rounded-lg border border-cancelado/40 bg-cancelado/10 px-3 py-2 text-sm text-cancelado"
        >
          {erro}
        </p>
      )}

      {!aberto ? (
        <div className="max-w-md rounded-2xl border border-borda bg-carvao p-7">
          <h2 className="mb-1 font-display text-xl uppercase tracking-wide text-creme">
            Abrir o caixa
          </h2>
          <p className="mb-5 text-sm text-creme-suave">
            Quanto tem de troco na gaveta agora?
          </p>

          <label className="rotulo" htmlFor="abertura">
            Valor de abertura
          </label>
          <input
            id="abertura"
            className="campo mb-4"
            inputMode="decimal"
            autoFocus
            value={valorAbertura}
            onChange={(e) => setValorAbertura(e.target.value)}
            placeholder="100,00"
          />

          <button
            className="btn btn-ouro w-full py-3"
            disabled={ocupado}
            onClick={() => acao(() => abrirCaixa(paraNumero(valorAbertura)))}
          >
            {ocupado ? "Abrindo…" : "Abrir caixa e começar a vender"}
          </button>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
          {/* movimento */}
          <div className="rounded-2xl border border-borda bg-carvao p-6">
            <div className="mb-5 flex items-baseline justify-between">
              <h2 className="font-display text-xl uppercase tracking-wide text-creme">
                Movimento
              </h2>
              <span className="text-sm text-creme-suave">
                aberto {dataHora(aberto.aberto_em)}
              </span>
            </div>

            <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {(Object.keys(ROTULO) as FormaPagamento[]).map((f) => (
                <div key={f} className="rounded-xl border border-borda p-4">
                  <p className="text-xs uppercase tracking-wide text-creme-fraco">
                    {ROTULO[f]}
                  </p>
                  <p className="tabular mt-1 font-display text-xl text-creme">
                    {reais(resumo[f])}
                  </p>
                </div>
              ))}
            </div>

            <dl className="space-y-2 text-sm">
              <Linha rotulo={`Vendas do caixa (${quantidade} pedidos)`} valor={vendas} />
              <Linha rotulo="Abertura (troco inicial)" valor={Number(aberto.valor_abertura)} />
              <div className="flex items-baseline justify-between border-t border-borda pt-3">
                <dt className="font-display text-lg uppercase tracking-wide text-creme">
                  Esperado na gaveta
                </dt>
                <dd className="tabular font-display text-2xl text-ouro">
                  {reais(esperadoNaGaveta)}
                </dd>
              </div>
              <p className="text-xs text-creme-fraco">
                Só dinheiro entra nessa conta. Pix e cartão não passam pela gaveta.
              </p>
            </dl>
          </div>

          {/* fechamento */}
          <div className="h-fit rounded-2xl border border-borda bg-carvao p-6">
            <h2 className="mb-1 font-display text-xl uppercase tracking-wide text-creme">
              Fechar o caixa
            </h2>
            <p className="mb-5 text-sm text-creme-suave">
              Conte o dinheiro da gaveta e informe o total.
            </p>

            <label className="rotulo" htmlFor="contado">
              Dinheiro contado
            </label>
            <input
              id="contado"
              className="campo mb-3"
              inputMode="decimal"
              value={valorContado}
              onChange={(e) => setValorContado(e.target.value)}
              placeholder="0,00"
            />

            {diferenca !== null && (
              <p
                className={
                  "mb-3 rounded-lg px-3 py-2 text-sm " +
                  (Math.abs(diferenca) < 0.01
                    ? "bg-pronto/10 text-pronto"
                    : "bg-preparo/10 text-preparo")
                }
              >
                {Math.abs(diferenca) < 0.01
                  ? "Bateu certinho."
                  : diferenca > 0
                    ? `Sobrando ${reais(diferenca)} na gaveta.`
                    : `Faltando ${reais(Math.abs(diferenca))} na gaveta.`}
              </p>
            )}

            <label className="rotulo" htmlFor="obs-caixa">
              Observação
            </label>
            <input
              id="obs-caixa"
              className="campo mb-4"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Ex: sangria de R$ 50 às 12h"
            />

            <button
              className="btn btn-ouro w-full py-3"
              disabled={ocupado || !valorContado}
              onClick={() =>
                acao(() => fecharCaixa(aberto.id, contado, observacao))
              }
            >
              {ocupado ? "Fechando…" : "Fechar caixa"}
            </button>
          </div>
        </div>
      )}

      {historico.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 font-display text-lg uppercase tracking-wide text-creme-suave">
            Fechamentos anteriores
          </h2>
          <div className="overflow-hidden rounded-2xl border border-borda">
            <table className="w-full text-sm">
              <thead className="bg-carvao text-left text-xs uppercase tracking-wide text-creme-suave">
                <tr>
                  <th className="px-4 py-3 font-semibold">Aberto</th>
                  <th className="px-4 py-3 font-semibold">Fechado</th>
                  <th className="px-4 py-3 text-right font-semibold">Abertura</th>
                  <th className="px-4 py-3 text-right font-semibold">Contado</th>
                  <th className="px-4 py-3 font-semibold">Observação</th>
                </tr>
              </thead>
              <tbody>
                {historico.map((c) => (
                  <tr key={c.id} className="border-t border-borda/60">
                    <td className="px-4 py-3 text-creme-suave">{dataHora(c.aberto_em)}</td>
                    <td className="px-4 py-3 text-creme-suave">
                      {c.fechado_em ? dataHora(c.fechado_em) : "—"}
                    </td>
                    <td className="tabular px-4 py-3 text-right text-creme-suave">
                      {reais(Number(c.valor_abertura))}
                    </td>
                    <td className="tabular px-4 py-3 text-right font-medium text-creme">
                      {reais(Number(c.valor_fechamento ?? 0))}
                    </td>
                    <td className="px-4 py-3 text-creme-fraco">{c.observacao ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: number }) {
  return (
    <div className="flex justify-between text-creme-suave">
      <dt>{rotulo}</dt>
      <dd className="tabular">{reais(valor)}</dd>
    </div>
  );
}
