"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { montarConta, montarPedido, oQueSai } from "@/lib/cupom";
import { imprimirCru } from "@/lib/impressora";
import { useAoVivo } from "@/lib/aoVivo";
import { useMensagens } from "@/components/Mensagens";
import { imprimirConta, reimprimirPedido, tentarImpressaoDeNovo } from "../../mesas/acoes";
import { ROTULO_VIA, hora, nomePagamento, numeroPedido, rotuloPedido } from "@/lib/formato";
import type { LinhaCupom } from "@/lib/escpos";
import type {
  Comanda,
  ConfigImpressoras,
  ConfigRestaurante,
  Pedido,
  TrabalhoImpressao,
  ViaImpressao,
} from "@/lib/tipos";

/**
 * O que esta tela sabe imprimir.
 *
 * As três vias são deste pedido; CONTA é a da mesa inteira, somada. São
 * coisas diferentes e o cliente pede as duas pelo mesmo nome ("me vê a
 * conta"), então ficam lado a lado, cada uma dizendo o que é.
 */
type Escolha = Exclude<ViaImpressao, "AUTO"> | "CONTA";

/** Letra dobrada e tripla, como a impressora faz. */
const TAMANHO: Record<1 | 2 | 3, string> = { 1: "1em", 2: "2em", 3: "3em" };
const LADO: Record<0 | 1 | 2, "left" | "center" | "right"> = {
  0: "left",
  1: "center",
  2: "right",
};

/**
 * O cupom de um pedido, e a conta da mesa dele.
 *
 * A impressão normal já foi pra fila da impressora do balcão quando o pedido
 * foi lançado ou aprovado. Aqui dá pra escolher qual papel sai — a via da
 * cozinha, a do caixa, as duas, ou a conta da mesa — e mandar pro balcão ou
 * imprimir direto deste computador.
 *
 * A prévia não é um desenho parecido com o cupom: são as linhas que o
 * gerador acabou de produzir pra impressora. O que está na tela é o que sai
 * no papel, sempre, porque é o mesmo código.
 */
export function PainelImpressao({
  pedido,
  comanda,
  restaurante,
  impressoras,
  impressoes,
}: {
  pedido: Pedido;
  comanda: Comanda | null;
  restaurante: ConfigRestaurante;
  impressoras: ConfigImpressoras;
  impressoes: TrabalhoImpressao[];
}) {
  useAoVivo(["fila_impressao"]);

  const { sucesso, falha, painel } = useMensagens();
  const [ocupado, iniciar] = useTransition();

  const ultima = impressoes[0] ?? null;
  const rotulo = rotuloPedido(pedido);
  const temCozinha = oQueSai(pedido, impressoras, "COZINHA").cozinha;

  const opcoes = useMemo(() => {
    const lista: {
      valor: Escolha;
      titulo: string;
      detalhe: string;
      impedido?: string;
    }[] = [
      {
        valor: "COZINHA",
        titulo: "Via da cozinha",
        detalhe: "o que montar, em letra grande e sem nenhum preço",
        impedido: temCozinha
          ? undefined
          : "Este pedido não tem nada pra cozinha — é só bebida.",
      },
      {
        valor: "CAIXA",
        titulo: "Via do caixa",
        detalhe: "com preço, total e pagamento — é a que o cliente leva",
      },
      {
        valor: "TUDO",
        titulo: "As duas vias",
        detalhe: "cozinha e caixa num envio, separadas pela guilhotina",
      },
    ];
    if (comanda) {
      lista.push({
        valor: "CONTA",
        titulo: `Conta da mesa ${comanda.mesas?.numero ?? ""}`.trim(),
        detalhe: "tudo que a mesa consumiu, somado — o papel de pagar",
      });
    }
    return lista;
  }, [comanda, temCozinha]);

  /**
   * Começa na via do caixa: é o papel que alguém vem buscar aqui. O da
   * cozinha sai sozinho quando o pedido é lançado, e quem abre esta tela
   * quase sempre quer o que o cliente leva na mão.
   */
  const [escolha, setEscolha] = useState<Escolha>("CAIXA");
  const atual = opcoes.find((o) => o.valor === escolha) ?? opcoes[0];

  const cupom = useMemo(() => {
    if (escolha === "CONTA") {
      return comanda ? montarConta(comanda, restaurante, impressoras) : null;
    }
    return montarPedido(pedido, restaurante, impressoras, escolha);
  }, [escolha, comanda, pedido, restaurante, impressoras]);

  const linhas = cupom?.paraLinhas() ?? [];

  /** Manda pra fila: o papel sai no balcão, mesmo que isto seja um celular. */
  function mandarPraFila() {
    if (escolha === "CONTA") {
      const alvo = comanda;
      if (!alvo) return;
      iniciar(async () => {
        const r = await imprimirConta(alvo.id);
        if (!r.ok) falha(r.erro);
        else sucesso("Conta da mesa mandada pra impressora do balcão.");
      });
      return;
    }

    const via = escolha;
    iniciar(async () => {
      const r = await reimprimirPedido(pedido.id, via);
      if (!r.ok) falha(r.erro);
      else sucesso(`${ROTULO_VIA[via]} mandada pra impressora do balcão.`);
    });
  }

  /** Imprime daqui mesmo, pelo QZ Tray — serve quando a tela Impressão está fechada. */
  async function imprimirAqui() {
    if (!cupom) return;
    try {
      await imprimirCru(impressoras.impressora, cupom.paraBase64(), impressoras.vias);
      sucesso("Impresso por este computador.");
    } catch (e) {
      falha(e instanceof Error ? e.message : "Não consegui falar com a impressora.");
    }
  }

  return (
    <div className="folha-raiz mx-auto flex max-w-3xl flex-col gap-6 p-4 lg:p-8">
      <div className="nao-imprimir flex items-start justify-between gap-6">
        <div>
          <span className="fita mb-3">Pedido {numeroPedido(pedido.numero_dia)}</span>
          <h1 className="font-display text-3xl font-extrabold uppercase tracking-wide text-creme">
            {rotulo}
          </h1>
          <p className="text-sm text-creme-suave">
            {pedido.cliente_nome !== rotulo && `${pedido.cliente_nome} · `}
            {hora(pedido.criado_em)}
            {pedido.forma_pagamento && ` · ${nomePagamento(pedido.forma_pagamento)}`}
          </p>
        </div>
        <span className="flex shrink-0 gap-2">
          {/* O cliente ligou de volta pedindo mais uma coisa: entra por aqui. */}
          {pedido.status !== "CANCELADO" && (
            <Link href={`/pdv?pedido=${pedido.id}`} className="btn btn-ouro shrink-0">
              Acrescentar item
            </Link>
          )}
          {pedido.tipo === "MESA" && pedido.mesa_id ? (
            <Link href={`/mesas/${pedido.mesa_id}`} className="btn btn-quieto shrink-0">
              Voltar pra mesa
            </Link>
          ) : (
            <Link href="/pedidos" className="btn btn-quieto shrink-0">
              Pedidos
            </Link>
          )}
        </span>
      </div>

      {/* situação na fila da impressora */}
      <div
        role="status"
        className={
          "nao-imprimir rounded-xl border px-4 py-3 text-sm " +
          (ultima?.status === "ERRO"
            ? "border-cancelado/40 bg-cancelado/10 text-cancelado"
            : ultima?.status === "IMPRESSO"
              ? "border-pronto/40 bg-pronto/10 text-pronto"
              : "border-borda bg-carvao text-creme-suave")
        }
      >
        {!ultima && "Este pedido ainda não foi pra impressora."}
        {ultima?.status === "PENDENTE" &&
          "Na fila da impressora do balcão. Sai assim que a tela Impressão pegar."}
        {ultima?.status === "IMPRIMINDO" && "Imprimindo no balcão…"}
        {ultima?.status === "IMPRESSO" && (
          <>
            Impresso no balcão às {hora(ultima.atualizado_em)}
            {ultima.via && ultima.via !== "AUTO" && ` · ${ROTULO_VIA[ultima.via]}`}.
          </>
        )}
        {ultima?.status === "ERRO" && (
          <>
            <strong className="block">Não imprimiu.</strong>
            {ultima.erro}{" "}
            <button
              type="button"
              onClick={() => iniciar(async () => void (await tentarImpressaoDeNovo(ultima.id)))}
              className="underline underline-offset-2"
            >
              Tentar de novo
            </button>
          </>
        )}
      </div>

      {/* o que imprimir */}
      <fieldset className="nao-imprimir rounded-2xl border border-borda bg-carvao p-5">
        <legend className="rotulo px-1">O que imprimir</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {opcoes.map((o) => {
            const marcada = o.valor === escolha;
            return (
              <label
                key={o.valor}
                className={
                  "flex cursor-pointer gap-3 rounded-xl border px-3.5 py-3 text-sm transition-colors " +
                  (o.impedido
                    ? "cursor-not-allowed border-borda/60 opacity-50"
                    : marcada
                      ? "border-ouro bg-ouro/10"
                      : "border-borda hover:border-borda-forte")
                }
              >
                <input
                  type="radio"
                  name="via"
                  className="mt-0.5 size-4 shrink-0 accent-[var(--color-ouro)]"
                  checked={marcada}
                  disabled={Boolean(o.impedido)}
                  onChange={() => setEscolha(o.valor)}
                />
                <span className="min-w-0">
                  <span className={"block font-semibold " + (marcada ? "text-ouro" : "text-creme")}>
                    {o.titulo}
                  </span>
                  <span className="block text-xs leading-snug text-creme-suave">
                    {o.impedido ?? o.detalhe}
                  </span>
                </span>
              </label>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            className="btn btn-ouro"
            onClick={mandarPraFila}
            disabled={ocupado || !cupom}
          >
            Imprimir no balcão
          </button>
          {/*
            O caminho de reserva: imprime sem passar pela fila, direto no QZ
            deste computador. Serve quando a tela Impressão está fechada — e
            é o único caminho que funciona com o banco ainda sem a coluna da
            via, por isso ele continua aqui mesmo parecendo repetido.
          */}
          <button
            className="btn btn-quieto"
            onClick={imprimirAqui}
            disabled={!impressoras.impressora || !cupom}
            title={
              impressoras.impressora
                ? "Usa o QZ Tray deste computador, sem passar pela fila"
                : "Nenhuma impressora escolhida. Escolha na tela Impressão."
            }
          >
            Imprimir neste computador
          </button>
          <button className="btn btn-quieto" onClick={() => window.print()} disabled={!cupom}>
            Ver / salvar em PDF
          </button>
        </div>
        <p className="mt-2 text-xs text-creme-fraco">
          {cupom
            ? `Abaixo está exatamente o que sai no papel — ${atual.titulo.toLowerCase()}.`
            : "Não há nada pra imprimir nesta via."}
        </p>
      </fieldset>

      {/* a prévia: as mesmas linhas que vão pra impressora */}
      {cupom && <Papel linhas={linhas} colunas={impressoras.colunas} />}

      {painel}
    </div>
  );
}

/**
 * O cupom na tela, linha por linha, com a largura do papel em caracteres.
 *
 * A caixa tem exatamente `colunas` caracteres de largura, então o que está
 * alinhado à direita no papel aparece alinhado à direita aqui. Letra dobrada
 * fica com o dobro do tamanho, e a linha de item esticada na altura — é o
 * que a impressora faz com ela.
 */
function Papel({ linhas, colunas }: { linhas: LinhaCupom[]; colunas: number }) {
  return (
    <div className="overflow-x-auto">
      <div className="folha cupom w-fit rounded-lg border border-borda bg-carvao p-4">
        <div style={{ width: `${colunas}ch` }}>
          {linhas.map((l, i) =>
            l.corte ? (
              <div
                key={i}
                className="my-2 flex items-center gap-2 text-[0.6rem] uppercase tracking-[0.2em] text-creme-fraco"
              >
                <span className="cupom-linha flex-1" />
                <span>corte</span>
                <span className="cupom-linha flex-1" />
              </div>
            ) : (
              <div
                key={i}
                className="whitespace-pre"
                style={{
                  fontSize: TAMANHO[l.escala],
                  fontWeight: l.negrito ? 700 : 400,
                  textAlign: LADO[l.alinhar],
                  lineHeight: l.alto ? 1.9 : undefined,
                  transform: l.alto ? "scaleY(1.45)" : undefined,
                }}
              >
                {l.texto || " "}
              </div>
            ),
          )}
        </div>
      </div>
    </div>
  );
}
