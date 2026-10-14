"use client";

import { Fragment, useState, useTransition } from "react";
import { Cabecalho } from "@/components/Cabecalho";
import { useMensagens } from "@/components/Mensagens";
import { abrirCaixa, editarCaixa, fecharCaixa } from "./acoes";
import { reais, reaisQuebravel, numero, paraNumero, dataHora } from "@/lib/formato";
import type { Caixa, FormaPagamento } from "@/lib/tipos";
import type { ResumoPagamento } from "./page";

const ROTULO: Record<FormaPagamento, string> = {
  Dinheiro: "Dinheiro",
  Pix: "Pix",
  "Cartao Debito": "Cartão débito",
  "Cartao Credito": "Cartão crédito",
};

type Recados = {
  pedir: (p: { titulo: string; texto?: string; confirmar?: string; perigo?: boolean }, aoConfirmar: () => void) => void;
  sucesso: (t: string) => void;
  falha: (t: string) => void;
};

export function PainelCaixa({
  aberto,
  resumo,
  quantidade,
  mesasAbertas,
  historico,
  ehDono,
}: {
  aberto: Caixa | null;
  resumo: ResumoPagamento;
  quantidade: number;
  mesasAbertas: { quantidade: number; total: number };
  historico: Caixa[];
  ehDono: boolean;
}) {
  const { pedir, sucesso, falha, painel } = useMensagens();
  const [valorAbertura, setValorAbertura] = useState("");
  const [valorContado, setValorContado] = useState("");
  const [observacao, setObservacao] = useState("");
  const [ocupado, iniciar] = useTransition();
  /** Qual caixa está com o formulário de correção aberto. */
  const [corrigindo, setCorrigindo] = useState<number | null>(null);

  const recados: Recados = { pedir, sucesso, falha };

  const vendas = Object.values(resumo).reduce((s, v) => s + v, 0);
  const esperadoNaGaveta = Number(aberto?.valor_abertura ?? 0) + resumo.Dinheiro;
  const contado = paraNumero(valorContado);
  const diferenca = valorContado ? contado - esperadoNaGaveta : null;

  function acao(fn: () => Promise<{ ok: boolean; erro?: string }>) {
    iniciar(async () => {
      const r = await fn();
      if (!r.ok) falha(r.erro ?? "Não deu certo.");
    });
  }

  return (
    <div className="p-4 lg:p-8">
      <Cabecalho
        fita={aberto ? "Caixa aberto" : "Caixa fechado"}
        titulo="Caixa"
        descricao="Todo pedido fica amarrado ao caixa do dia. É por isso que o fechamento bate."
      />

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
          <p className="mt-3 text-xs text-creme-fraco">
            Errou o troco? Dá pra corrigir depois, sem fechar o caixa.
          </p>
        </div>
      ) : (
        /*
          Duas colunas so a partir de xl. Em lg (1024px) o cartao da esquerda
          ficava com ~370px uteis — e o PC do balcao, a 125% de zoom, cai
          justamente ai. Era pouco pra qualquer coisa, e o movimento do caixa
          saia escrito por cima de si mesmo.
        */
        <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
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

            {/*
              Quatro lado a lado so quando CABEM quatro. Quem manda aqui e a
              largura do CARTAO, nao a da janela — por isso @container e nao
              sm:. Medido na fonte real: "R$ 1.258,00" ocupa 114px em text-lg e
              102px em text-base, e o rotulo "CARTAO CREDITO" 100px. Com 44rem
              de cartao cada caixinha fica com 135px uteis; abaixo disso, duas
              por linha, que dao 130px ou mais. Sempre com folga, em qualquer
              largura, porque numero de dinheiro nao pode sair cortado.
            */}
            <div className="@container mb-6">
              <div className="grid grid-cols-2 gap-3 @[44rem]:grid-cols-4">
                {(Object.keys(ROTULO) as FormaPagamento[]).map((f) => (
                  <div
                    key={f}
                    className="flex min-w-0 flex-col rounded-xl border border-borda p-3 @[44rem]:p-4"
                  >
                    <p className="text-xs uppercase tracking-wide text-creme-fraco">
                      {ROTULO[f]}
                    </p>
                    {/* mt-auto: rotulo de duas linhas nao pode desalinhar o dinheiro */}
                    <p className="tabular mt-auto pt-1 font-display text-base leading-tight text-creme @[20rem]:text-lg @[52rem]:text-xl">
                      {reaisQuebravel(resumo[f])}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <dl className="space-y-2 text-sm">
              <Linha rotulo={`Recebido neste caixa (${quantidade} vendas)`} valor={vendas} />
              <div className="flex items-baseline justify-between gap-3 text-creme-suave">
                <dt>
                  Abertura (troco inicial)
                  {/*
                    O troco é digitado às pressas na hora de abrir, e um zero
                    a mais deixa o "esperado na gaveta" errado o dia inteiro.
                    Por isso a correção está aqui, do lado do número errado,
                    e não escondida numa tela de configuração.
                  */}
                  {ehDono && corrigindo !== aberto.id && (
                    <button
                      type="button"
                      onClick={() => setCorrigindo(aberto.id)}
                      className="ml-2 text-xs text-creme-fraco underline hover:text-ouro"
                    >
                      corrigir
                    </button>
                  )}
                </dt>
                <dd className="tabular shrink-0">{reais(Number(aberto.valor_abertura))}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3 border-t border-borda pt-3">
                <dt className="font-display text-lg uppercase tracking-wide text-creme">
                  Esperado na gaveta
                </dt>
                <dd className="tabular shrink-0 font-display text-2xl text-ouro">
                  {reais(esperadoNaGaveta)}
                </dd>
              </div>
              <p className="text-xs text-creme-fraco">
                Só dinheiro entra nessa conta. Pix e cartão não passam pela gaveta.
              </p>
            </dl>

            {corrigindo === aberto.id && (
              <Correcao
                caixa={aberto}
                recados={recados}
                aoFechar={() => setCorrigindo(null)}
              />
            )}

            {!ehDono && (
              <p className="mt-4 text-xs text-creme-fraco">
                Valor de caixa errado? Só a dona corrige. Chame ela.
              </p>
            )}

            {mesasAbertas.quantidade > 0 && (
              <p className="mt-5 rounded-xl border border-ouro/40 bg-ouro/10 px-4 py-3 text-sm text-ouro">
                {mesasAbertas.quantidade} mesa(s) com conta aberta ·{" "}
                <strong className="tabular">{reais(mesasAbertas.total)}</strong> ainda a receber.
                Esse valor entra aqui quando a conta de cada mesa for fechada.
              </p>
            )}
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
            <p className="mt-3 text-xs text-creme-fraco">
              Contou errado? Depois de fechado o valor ainda pode ser corrigido
              em “Fechamentos anteriores”.
            </p>
          </div>
        </div>
      )}

      {historico.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 font-display text-lg uppercase tracking-wide text-creme-suave">
            Fechamentos anteriores
          </h2>
          <div className="overflow-x-auto rounded-2xl border border-borda">
            <table className="w-full min-w-[42rem] text-sm">
              <thead className="bg-carvao text-left text-xs uppercase tracking-wide text-creme-suave">
                <tr>
                  <th className="px-4 py-3 font-semibold">Aberto</th>
                  <th className="px-4 py-3 font-semibold">Fechado</th>
                  <th className="px-4 py-3 text-right font-semibold">Abertura</th>
                  <th className="px-4 py-3 text-right font-semibold">Contado</th>
                  <th className="px-4 py-3 font-semibold">Observação</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {historico.map((c) => (
                  <Fragment key={c.id}>
                    <tr className="border-t border-borda/60 align-top">
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
                      <td className="whitespace-pre-line px-4 py-3 text-xs leading-relaxed text-creme-fraco">
                        {c.observacao ?? "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        {ehDono && corrigindo !== c.id && (
                          <button
                            type="button"
                            onClick={() => setCorrigindo(c.id)}
                            className="text-xs text-creme-suave underline hover:text-ouro"
                          >
                            Corrigir
                          </button>
                        )}
                      </td>
                    </tr>
                    {corrigindo === c.id && (
                      <tr className="border-t border-borda/60">
                        <td colSpan={6} className="px-4 pb-4">
                          <Correcao
                            caixa={c}
                            recados={recados}
                            aoFechar={() => setCorrigindo(null)}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {painel}
    </div>
  );
}

/**
 * Corrigir os valores de um caixa.
 *
 * Mexer em dinheiro depois do fato pede duas coisas: dizer em voz alta o que
 * vai mudar (o diálogo repete de quanto pra quanto) e deixar rastro — cada
 * troca assina embaixo da observação, com quem e quando.
 *
 * A frase sobre venda não é consolo: abertura e contagem não entram em
 * faturamento nenhum. Quem não sabe disso hesita em corrigir, e fica com o
 * número errado na tela por medo de "estragar o relatório".
 */
function Correcao({
  caixa,
  recados,
  aoFechar,
}: {
  caixa: Caixa;
  recados: Recados;
  aoFechar: () => void;
}) {
  const fechado = caixa.status === "FECHADO";
  const [abertura, setAbertura] = useState(numero(Number(caixa.valor_abertura)));
  const [contado, setContado] = useState(
    caixa.valor_fechamento === null ? "" : numero(Number(caixa.valor_fechamento)),
  );
  const [observacao, setObservacao] = useState(caixa.observacao ?? "");
  const [ocupado, iniciar] = useTransition();

  const novaAbertura = paraNumero(abertura);
  const novoContado = paraNumero(contado);
  const mudouAbertura = Math.abs(novaAbertura - Number(caixa.valor_abertura)) >= 0.01;
  const mudouContado =
    fechado && Math.abs(novoContado - Number(caixa.valor_fechamento ?? 0)) >= 0.01;
  const mudouObs = observacao.trim() !== (caixa.observacao ?? "").trim();
  const mudouAlgo = mudouAbertura || mudouContado || mudouObs;
  /**
   * Campo em branco não vira zero por conta própria.
   *
   * Apagar o conteúdo pra digitar de novo é o gesto mais comum do mundo, e
   * "" lido como número dá 0 — o troco da gaveta sumiria porque alguém parou
   * no meio da digitação. Pra zerar, digita-se zero.
   */
  const emBranco = abertura.trim() === "" || (fechado && contado.trim() === "");

  function salvar() {
    const trocas: string[] = [];
    if (mudouAbertura)
      trocas.push(
        `Abertura: ${reais(Number(caixa.valor_abertura))} → ${reais(novaAbertura)}`,
      );
    if (mudouContado)
      trocas.push(
        `Dinheiro contado: ${reais(Number(caixa.valor_fechamento ?? 0))} → ${reais(novoContado)}`,
      );

    const gravar = () =>
      iniciar(async () => {
        const r = await editarCaixa(caixa.id, {
          valor_abertura: novaAbertura,
          ...(fechado ? { valor_fechamento: novoContado } : {}),
          observacao,
        });
        if (!r.ok) return recados.falha(r.erro);
        recados.sucesso("Caixa corrigido.");
        aoFechar();
      });

    // Mudar só a observação é escrever um bilhete; mudar valor é dinheiro.
    if (trocas.length === 0) return gravar();

    recados.pedir(
      {
        titulo: "Corrigir os valores deste caixa?",
        texto: `${trocas.join(". ")}. A correção fica assinada na observação, com seu nome e a hora. Nenhuma venda muda — abertura e contagem só servem pra conferir a gaveta.`,
        confirmar: "Corrigir",
      },
      gravar,
    );
  }

  return (
    <div className="mt-4 rounded-xl border border-ouro/40 bg-ouro/5 p-4">
      <p className="rotulo text-ouro">Corrigir valores</p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="rotulo" htmlFor={`ab-${caixa.id}`}>
            Abertura (troco inicial)
          </label>
          <input
            id={`ab-${caixa.id}`}
            className="campo"
            inputMode="decimal"
            value={abertura}
            onChange={(e) => setAbertura(e.target.value)}
          />
        </div>

        {fechado && (
          <div>
            <label className="rotulo" htmlFor={`ct-${caixa.id}`}>
              Dinheiro contado no fechamento
            </label>
            <input
              id={`ct-${caixa.id}`}
              className="campo"
              inputMode="decimal"
              value={contado}
              onChange={(e) => setContado(e.target.value)}
            />
          </div>
        )}
      </div>

      <label className="rotulo mt-3" htmlFor={`ob-${caixa.id}`}>
        Observação
      </label>
      <textarea
        id={`ob-${caixa.id}`}
        className="campo min-h-20 resize-y"
        value={observacao}
        onChange={(e) => setObservacao(e.target.value)}
        placeholder="Ex: sangria de R$ 50 às 12h"
      />

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className="btn btn-ouro px-4 py-2 text-sm"
          disabled={ocupado || !mudouAlgo || emBranco}
          onClick={salvar}
        >
          {ocupado ? "Salvando…" : "Salvar correção"}
        </button>
        <button
          type="button"
          className="btn btn-quieto px-4 py-2 text-sm"
          disabled={ocupado}
          onClick={aoFechar}
        >
          Cancelar
        </button>
      </div>

      {emBranco ? (
        <p className="mt-2 text-xs text-ouro">
          Campo em branco não vale zero. Pra zerar de verdade, digite 0.
        </p>
      ) : (
        !fechado && (
          <p className="mt-2 text-xs text-creme-fraco">
            O dinheiro contado só existe depois que o caixa fecha — por isso ele
            não aparece aqui.
          </p>
        )
      )}
    </div>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: number }) {
  return (
    <div className="flex justify-between gap-3 text-creme-suave">
      <dt className="min-w-0">{rotulo}</dt>
      <dd className="tabular shrink-0">{reais(valor)}</dd>
    </div>
  );
}
