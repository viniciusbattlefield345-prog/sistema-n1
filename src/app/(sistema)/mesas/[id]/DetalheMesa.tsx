"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Vazio } from "@/components/Cabecalho";
import { CartaoAprovacao } from "../CartaoAprovacao";
import {
  fecharConta,
  imprimirConta,
  liberarMesa,
  mandarPraCozinha,
  reabrirConta,
  reimprimirPedido,
  tentarImpressaoDeNovo,
} from "../acoes";
import { cancelarPedido, descancelarPedido, removerItem } from "../../pedidos/acoes";
import { useAoVivo } from "@/lib/aoVivo";
import { FORMAS_PAGAMENTO, centavos, duracao, extraComVezes, hora, minutosDesde, nomePagamento, numero, numeroPedido, paraNumero, reais, rotuloPedido } from "@/lib/formato";
import type {
  Comanda,
  FormaPagamento,
  ItemPedido,
  Mesa,
  Pedido,
  StatusPedido,
  TrabalhoImpressao,
} from "@/lib/tipos";

const SITUACAO: Record<StatusPedido, { texto: string; cor: string }> = {
  AGUARDANDO: { texto: "Esperando aprovação", cor: "bg-ouro/20 text-ouro" },
  PENDENTE: { texto: "Na fila da cozinha", cor: "bg-madeira text-creme-suave" },
  "EM PREPARO": { texto: "Preparando", cor: "bg-preparo/20 text-preparo" },
  PRONTO: { texto: "Pronto", cor: "bg-pronto/20 text-pronto" },
  "SAIU PARA ENTREGA": { texto: "Saiu", cor: "bg-pronto/20 text-pronto" },
  CONCLUIDO: { texto: "Servido", cor: "bg-pronto/15 text-pronto" },
  CANCELADO: { texto: "Cancelado", cor: "bg-cancelado/20 text-cancelado" },
};

export function DetalheMesa({
  mesa,
  comanda,
  ultimaFechada,
  ehDono,
  caixaAberto,
  impressoes,
}: {
  mesa: Mesa;
  comanda: Comanda | null;
  ultimaFechada: Comanda | null;
  ehDono: boolean;
  caixaAberto: boolean;
  impressoes: TrabalhoImpressao[];
}) {
  useAoVivo(["pedidos", "comandas", "fila_impressao"]);

  const [fechando, setFechando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();

  // A lista vem da conta; aqui cada pedido ganha o número da mesa pro rótulo.
  const pedidos = useMemo(
    () =>
      ((comanda?.pedidos ?? []) as Pedido[])
        .map((p) => ({ ...p, mesas: { numero: mesa.numero } }))
        .sort((a, b) => b.criado_em.localeCompare(a.criado_em)),
    [comanda, mesa.numero],
  );

  /**
   * Quem ainda não foi pra chapa. Pedido só de bebida não entra: não há o que
   * a cozinha faça com ele, e mandar seria papel em branco.
   */
  const aMandar = useMemo(
    () =>
      pedidos.filter(
        (p) =>
          p.status !== "AGUARDANDO" &&
          p.status !== "CANCELADO" &&
          (p.itens_pedido ?? []).some((i) => i.vai_pra_cozinha !== false) &&
          !impressoes.some((t) => t.pedido_id === p.id),
      ),
    [pedidos, impressoes],
  );

  const esperando = pedidos.filter((p) => p.status === "AGUARDANDO");
  const outros = pedidos.filter((p) => p.status !== "AGUARDANDO");
  const semPedidoValido = pedidos.every((p) => p.status === "CANCELADO");
  const validos = pedidos.filter((p) => p.status !== "CANCELADO");
  const naCozinha = outros.filter(
    (p) => p.status === "PENDENTE" || p.status === "EM PREPARO",
  ).length;
  const prontos = outros.filter((p) => p.status === "PRONTO").length;
  const servidos = outros.filter((p) => p.status === "CONCLUIDO").length;
  const impressaoConta = impressoes.find((t) => t.tipo === "CONTA");

  function acao(fn: () => Promise<{ ok: boolean; erro?: string }>, sucesso?: string) {
    setErro(null);
    setAviso(null);
    iniciar(async () => {
      const r = await fn();
      if (!r.ok) setErro(r.erro ?? "Não deu certo.");
      else if (sucesso) setAviso(sucesso);
    });
  }

  return (
    <div className="p-4 lg:p-8">
      <Link href="/mesas" className="text-sm text-creme-suave hover:text-ouro">
        ← Todas as mesas
      </Link>

      <header className="mb-6 mt-3 flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="fita mb-2">{comanda ? "Conta aberta" : "Mesa livre"}</span>
          <h1 className="font-display text-4xl font-extrabold uppercase leading-none">
            Mesa {mesa.numero}
          </h1>
          {comanda && (
            <p className="mt-1 text-sm text-creme-suave">
              Aberta às {hora(comanda.aberta_em)} · há{" "}
              {duracao(minutosDesde(comanda.aberta_em))} ·{" "}
              <span className="tabular font-bold text-ouro">
                {reais(Number(comanda.total))}
              </span>{" "}
              · {validos.length === 1 ? "1 pedido" : `${validos.length} pedidos`}
            </p>
          )}
        </div>
        <Link href={`/pdv?mesa=${mesa.id}`} className="btn btn-quieto">
          Lançar pedido
        </Link>
      </header>

      <FaixaSituacao
        comanda={comanda}
        esperando={esperando}
        naCozinha={naCozinha}
        prontos={prontos}
        servidos={servidos}
      />

      {erro && (
        <p
          role="alert"
          className="mb-4 rounded-xl border border-cancelado/40 bg-cancelado/10 px-4 py-3 text-sm text-cancelado"
        >
          {erro}
        </p>
      )}
      {aviso && (
        <p
          role="status"
          className="mb-4 rounded-xl border border-pronto/40 bg-pronto/10 px-4 py-3 text-sm text-pronto"
        >
          {aviso}
        </p>
      )}

      {aMandar.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ouro bg-ouro/10 px-4 py-3.5">
          <div className="min-w-0">
            <p className="font-display text-base font-extrabold uppercase leading-tight text-ouro">
              {aMandar.length === 1
                ? "1 pedido ainda não foi pra cozinha"
                : `${aMandar.length} pedidos ainda não foram pra cozinha`}
            </p>
            <p className="mt-0.5 text-xs text-creme-suave">
              Nada sai na chapa até você mandar. Lance tudo que o cliente pedir e mande de uma vez.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-ouro shrink-0"
            disabled={ocupado}
            onClick={() =>
              acao(
                () => mandarPraCozinha(aMandar.map((p) => p.id)),
                "Mandado pra cozinha.",
              )
            }
          >
            Mandar pra cozinha
          </button>
        </div>
      )}

      {!comanda ? (
        <>
          <Vazio
            titulo="Mesa livre"
            texto="A conta abre sozinha quando o cliente pede pelo QR ou quando alguém da equipe lança um pedido."
          >
            <Link href={`/pdv?mesa=${mesa.id}`} className="btn btn-ouro">
              Lançar pedido
            </Link>
          </Vazio>

          {ultimaFechada && (
            <ContaPaga
              conta={ultimaFechada}
              ehDono={ehDono}
              ocupado={ocupado}
              aoReabrir={() => {
                const pago = (ultimaFechada.pagamentos ?? []).reduce(
                  (s, p) => s + Number(p.valor),
                  0,
                );
                const desconto = Number(ultimaFechada.desconto);
                const aviso =
                  `Reabrir a conta da mesa ${mesa.numero}?\n\nOs ${reais(pago)} saem do caixa do dia e a conta volta pra aberta, com os mesmos pedidos. Corrija o que está errado e feche de novo no fim.` +
                  (desconto > 0
                    ? `\n\nO desconto de ${reais(desconto)} volta pra zero — digite de novo ao fechar.`
                    : "");
                if (!confirm(aviso)) return;
                acao(
                  () => reabrirConta(ultimaFechada.id),
                  "Conta reaberta. Corrija e feche de novo no fim.",
                );
              }}
            />
          )}
        </>
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[1fr_22rem]">
          <div className="space-y-3">
            {esperando.map((p) => (
              <CartaoAprovacao key={p.id} pedido={p} />
            ))}

            {outros.length === 0 && esperando.length === 0 && (
              <p className="rounded-2xl border border-dashed border-borda px-4 py-10 text-center text-sm text-creme-fraco">
                Nenhum pedido nesta conta.
              </p>
            )}

            {outros.map((p) => (
              <CartaoPedido
                key={p.id}
                pedido={p}
                impressao={impressoes.find((t) => t.pedido_id === p.id) ?? null}
                ocupado={ocupado}
                aoReimprimir={() => acao(() => reimprimirPedido(p.id), "Mandado pra impressora.")}
                aoMandarPraCozinha={() =>
                  acao(() => mandarPraCozinha([p.id]), "Mandado pra cozinha.")
                }
                aoTentarDeNovo={(id) => acao(() => tentarImpressaoDeNovo(id))}
                aoCancelar={() => {
                  if (!confirm(`Cancelar o pedido ${numeroPedido(p.numero_dia)}? Ele sai da conta da mesa.`)) return;
                  acao(() => cancelarPedido(p.id));
                }}
                aoDescancelar={() => {
                  if (
                    !confirm(
                      `Reabrir o pedido ${numeroPedido(p.numero_dia)}? Ele volta a valer ${reais(Number(p.total))} na conta da mesa e entra na fila da cozinha.`,
                    )
                  )
                    return;
                  acao(() => descancelarPedido(p.id), "Pedido reaberto.");
                }}
                aoRemoverItem={(item) => {
                  // Se a cozinha já está com o papel na mão, o sistema não
                  // alcança ela: quem avisa é quem está tirando o item.
                  const naChapa = p.status === "PENDENTE" || p.status === "EM PREPARO";
                  const texto =
                    `Tirar ${Number(item.quantidade)}x ${item.produto_nome} da conta?` +
                    (naChapa ? " A cozinha já recebeu esse pedido — avise lá também." : "");
                  if (!confirm(texto)) return;
                  acao(() => removerItem(item.id), "Item tirado da conta.");
                }}
              />
            ))}
          </div>

          {/* resumo e fechamento */}
          <aside className="space-y-3 lg:sticky lg:top-6">
            <div className="rounded-2xl border border-borda bg-carvao p-5">
              <p className="text-xs uppercase tracking-wide text-creme-fraco">Total da mesa</p>
              <p className="tabular font-display text-4xl font-extrabold text-ouro">
                {reais(Number(comanda.total))}
              </p>
              {esperando.length > 0 && (
                <p className="mt-1 text-xs text-ouro">
                  + {esperando.length} pedido(s) esperando aprovação (ainda não somados)
                </p>
              )}

              <div className="mt-4 grid gap-2">
                <button
                  type="button"
                  className="btn btn-quieto"
                  disabled={ocupado}
                  onClick={() => acao(() => imprimirConta(comanda.id), "Conta mandada pra impressora.")}
                >
                  Imprimir conta
                </button>
                {impressaoConta && <SituacaoImpressao trabalho={impressaoConta} aoTentarDeNovo={(id) => acao(() => tentarImpressaoDeNovo(id))} />}

                {semPedidoValido ? (
                  <button
                    type="button"
                    className="btn btn-quieto"
                    disabled={ocupado}
                    onClick={() => acao(() => liberarMesa(comanda.id))}
                  >
                    Liberar mesa
                  </button>
                ) : (
                  !fechando && (
                    <button
                      type="button"
                      className="btn btn-ouro py-3.5 text-base"
                      onClick={() => setFechando(true)}
                    >
                      Fechar conta
                    </button>
                  )
                )}
              </div>
            </div>

            {fechando && !semPedidoValido && (
              <FecharConta
                comanda={comanda}
                caixaAberto={caixaAberto}
                temEsperando={esperando.length > 0}
                aoCancelar={() => setFechando(false)}
              />
            )}
          </aside>
        </div>
      )}
    </div>
  );
}

/**
 * A conta que acabou de ser paga nesta mesa.
 *
 * Fica logo abaixo do "mesa livre" porque é aqui que a reclamação chega: o
 * cliente já pagou, olhou o papel na calçada e voltou dizendo que tem coisa
 * ali que ele não pediu. Em vez de deixar errado no relatório do dia, a conta
 * volta pra aberta e é corrigida.
 */
function ContaPaga({
  conta,
  ehDono,
  ocupado,
  aoReabrir,
}: {
  conta: Comanda;
  ehDono: boolean;
  ocupado: boolean;
  aoReabrir: () => void;
}) {
  const pagamentos = conta.pagamentos ?? [];
  const pago = pagamentos.reduce((s, p) => s + Number(p.valor), 0);
  const desconto = Number(conta.desconto);

  return (
    <div className="mt-4 rounded-2xl border border-borda bg-carvao p-5">
      <p className="text-xs uppercase tracking-wide text-creme-fraco">
        Última conta desta mesa
      </p>
      <p className="mt-1 font-display text-2xl font-extrabold">
        <span className="tabular">{reais(pago || Number(conta.total) - desconto)}</span>
        {conta.fechada_em && (
          <span className="ml-2 text-sm font-normal text-creme-suave">
            paga às {hora(conta.fechada_em)}
          </span>
        )}
      </p>
      {pagamentos.length > 0 && (
        <p className="mt-0.5 text-sm text-creme-suave">
          {pagamentos
            .map((p) => `${nomePagamento(p.forma)} ${reais(Number(p.valor))}`)
            .join(" · ")}
        </p>
      )}
      {desconto > 0 && (
        <p className="text-sm text-creme-suave">Com desconto de {reais(desconto)}</p>
      )}

      {ehDono ? (
        <>
          <button
            type="button"
            className="btn btn-quieto mt-4"
            disabled={ocupado}
            onClick={aoReabrir}
          >
            Reabrir pra corrigir
          </button>
          <p className="mt-2 text-xs text-creme-fraco">
            Reabrir devolve esta conta pra aberta e tira o pagamento do caixa.
          </p>
        </>
      ) : (
        <p className="mt-3 text-xs text-creme-fraco">
          Cobrou errado? Só a dona reabre uma conta já paga.
        </p>
      )}
    </div>
  );
}

/** Quem fez o pedido. Pedido antigo pode não ter nome: era opcional. */
function quemPediu(p: Pedido): string {
  const rotulo = rotuloPedido(p);
  return p.cliente_nome && p.cliente_nome !== rotulo ? p.cliente_nome : "sem nome";
}

/**
 * O estado da mesa em uma frase, no topo da tela.
 *
 * É o que o atendente lê de longe, sem precisar contar cartões: mostra um
 * estado só, o mais urgente primeiro. Aprovação pendente ganha de tudo.
 */
function FaixaSituacao({
  comanda,
  esperando,
  naCozinha,
  prontos,
  servidos,
}: {
  comanda: Comanda | null;
  esperando: Pedido[];
  naCozinha: number;
  prontos: number;
  servidos: number;
}) {
  const base = "mb-5 rounded-2xl border px-4 py-3.5";

  if (esperando.length > 0) {
    return (
      <div role="status" className={`${base} border-ouro bg-ouro/15`}>
        <p className="flex items-center gap-2 font-display text-lg font-extrabold uppercase leading-tight text-ouro">
          <span className="relative flex size-2.5 shrink-0">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-ouro opacity-75" />
            <span className="relative inline-flex size-2.5 rounded-full bg-ouro" />
          </span>
          {esperando.length === 1
            ? "1 pedido esperando sua aprovação"
            : `${esperando.length} pedidos esperando sua aprovação`}
        </p>
        <p className="mt-1.5 text-sm text-creme-suave">
          {esperando
            .map((p) => `${quemPediu(p)}, há ${duracao(minutosDesde(p.criado_em))}`)
            .join(" · ")}
        </p>
      </div>
    );
  }

  if (!comanda) {
    return (
      <div className={`${base} border-borda bg-carvao`}>
        <p className="font-display text-lg font-extrabold uppercase text-creme-suave">
          Mesa livre
        </p>
        <p className="mt-1 text-sm text-creme-fraco">
          Nenhum pedido. A conta abre sozinha no primeiro.
        </p>
      </div>
    );
  }

  const andando = [
    naCozinha > 0 ? `${naCozinha} na cozinha` : null,
    prontos > 0 ? `${prontos} pronto${prontos > 1 ? "s" : ""} pra levar` : null,
    servidos > 0 ? `${servidos} servido${servidos > 1 ? "s" : ""}` : null,
  ].filter(Boolean);

  if (andando.length === 0) {
    return (
      <div className={`${base} border-borda bg-carvao`}>
        <p className="font-display text-lg font-extrabold uppercase text-creme-suave">
          Conta aberta, sem pedido
        </p>
        <p className="mt-1 text-sm text-creme-fraco">
          Nada pra aprovar e nada na cozinha.
        </p>
      </div>
    );
  }

  return (
    <div className={`${base} border-pronto/40 bg-pronto/10`}>
      <p className="font-display text-lg font-extrabold uppercase text-pronto">
        Em andamento
      </p>
      <p className="mt-1 text-sm text-creme-suave">{andando.join(" · ")}</p>
    </div>
  );
}

function SituacaoImpressao({
  trabalho,
  aoTentarDeNovo,
}: {
  trabalho: TrabalhoImpressao;
  aoTentarDeNovo: (id: number) => void;
}) {
  if (trabalho.status === "ERRO") {
    return (
      <p className="text-xs text-cancelado">
        Não imprimiu{trabalho.erro ? `: ${trabalho.erro}` : "."}{" "}
        <button type="button" onClick={() => aoTentarDeNovo(trabalho.id)} className="font-semibold underline">
          Tentar de novo
        </button>
      </p>
    );
  }
  const texto = {
    PENDENTE: "Na fila da impressora…",
    IMPRIMINDO: "Imprimindo…",
    IMPRESSO: "Impresso ✓",
  }[trabalho.status];
  return (
    <p className={"text-xs " + (trabalho.status === "IMPRESSO" ? "text-pronto" : "text-creme-suave")}>
      {texto}
    </p>
  );
}

function CartaoPedido({
  pedido,
  impressao,
  ocupado,
  aoReimprimir,
  aoMandarPraCozinha,
  aoTentarDeNovo,
  aoCancelar,
  aoDescancelar,
  aoRemoverItem,
}: {
  pedido: Pedido;
  impressao: TrabalhoImpressao | null;
  ocupado: boolean;
  aoReimprimir: () => void;
  aoMandarPraCozinha: () => void;
  aoTentarDeNovo: (id: number) => void;
  aoCancelar: () => void;
  aoDescancelar: () => void;
  aoRemoverItem: (item: ItemPedido) => void;
}) {
  const cancelado = pedido.status === "CANCELADO";
  const itens = pedido.itens_pedido ?? [];
  const temCozinha = itens.some((i) => i.vai_pra_cozinha !== false);
  const nome =
    pedido.cliente_nome && !pedido.cliente_nome.startsWith("Mesa ") ? pedido.cliente_nome : null;

  return (
    <article
      className={
        "rounded-2xl border bg-carvao p-4 " + (cancelado ? "border-borda opacity-55" : "border-borda")
      }
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-lg font-bold">
            Pedido {numeroPedido(pedido.numero_dia)}
            <span className="ml-2 text-sm font-normal text-creme-suave">
              {hora(pedido.criado_em)} · {pedido.origem === "CLIENTE" ? "pelo QR" : "equipe"}
            </span>
          </p>
          {nome && <p className="text-sm text-creme-suave">{nome}</p>}
        </div>
        <div className="shrink-0 text-right">
          <p className="tabular font-bold">{reais(Number(pedido.total))}</p>
          <span
            className={
              "mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-semibold " +
              SITUACAO[pedido.status].cor
            }
          >
            {SITUACAO[pedido.status].texto}
          </span>
        </div>
      </header>

      <ul className="mt-3 space-y-1 border-t border-borda pt-3 text-sm">
        {itens.map((item) => (
          <li key={item.id} className="flex items-start justify-between gap-2">
            <span className="min-w-0">
              <span className="font-bold text-ouro">{Number(item.quantidade)}x </span>
              {item.produto_nome}
              {item.variacao_nome && ` (${item.variacao_nome})`}
              {(item.item_adicionais ?? []).length > 0 && (
                <span className="text-creme-suave">
                  {" "}
                  + {(item.item_adicionais ?? []).map(extraComVezes).join(", ")}
                </span>
              )}
              {item.observacao && (
                <span className="ml-1 text-xs font-semibold text-preparo">({item.observacao})</span>
              )}
            </span>
            {/*
              Tirar uma linha sem derrubar o pedido inteiro: lançou a coca
              errada, tira a coca. A última linha não some — aí é o pedido
              todo que está errado, e quem faz isso é o Cancelar.
            */}
            {!cancelado && itens.length > 1 && (
              <button
                type="button"
                onClick={() => aoRemoverItem(item)}
                disabled={ocupado}
                title="Tirar este item da conta"
                aria-label={`Tirar ${item.produto_nome} da conta`}
                className="shrink-0 rounded px-1.5 text-xs leading-5 text-creme-fraco hover:text-cancelado"
              >
                ✕
              </button>
            )}
          </li>
        ))}
      </ul>

      {cancelado && pedido.motivo_recusa && (
        <p className="mt-2 text-xs text-cancelado">Motivo: {pedido.motivo_recusa}</p>
      )}

      {/*
        Cancelado não é o fim da linha: cancelar só marca o pedido, nada é
        apagado. Quem cancelou a linha errada volta daqui, e o valor retorna
        pra conta da mesa.
      */}
      {cancelado && (
        <footer className="mt-3 flex items-center justify-between gap-2 border-t border-borda pt-3">
          <span className="text-xs text-creme-fraco">Fora da conta</span>
          <button
            type="button"
            onClick={aoDescancelar}
            disabled={ocupado}
            className="text-xs text-pronto underline hover:text-pronto"
          >
            Reabrir pedido
          </button>
        </footer>
      )}

      {!cancelado && (
        <footer className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-borda pt-3">
          {impressao ? (
            <SituacaoImpressao trabalho={impressao} aoTentarDeNovo={aoTentarDeNovo} />
          ) : temCozinha ? (
            <span className="text-xs font-semibold text-ouro">Não foi pra cozinha ainda</span>
          ) : (
            <span className="text-xs text-creme-fraco">Só bebida — não vai pra cozinha</span>
          )}
          <span className="flex items-center gap-3">
            {/*
              Enquanto não foi, o botão é o da chapa e aparece inteiro: é a
              ação que falta. Depois vira "Reimprimir", discreto, porque
              mandar duas vezes a mesma comanda é o erro a evitar.
            */}
            {!impressao && temCozinha ? (
              <button
                type="button"
                onClick={aoMandarPraCozinha}
                disabled={ocupado}
                className="btn btn-ouro px-3 py-1.5 text-xs"
              >
                Mandar pra cozinha
              </button>
            ) : (
              <button
                type="button"
                onClick={aoReimprimir}
                disabled={ocupado}
                className="text-xs text-creme-suave underline hover:text-ouro"
              >
                Reimprimir
              </button>
            )}
            {/* Acrescentar no pedido que já existe, em vez de abrir outro. */}
            <Link
              href={`/pdv?pedido=${pedido.id}`}
              className="text-xs text-creme-suave underline hover:text-ouro"
            >
              Editar
            </Link>
            <button
              type="button"
              onClick={aoCancelar}
              disabled={ocupado}
              className="text-xs text-creme-fraco underline hover:text-cancelado"
            >
              Cancelar
            </button>
          </span>
        </footer>
      )}
    </article>
  );
}

type LinhaPagamento = { forma: FormaPagamento; valor: string };

/** Fechamento: desconto opcional e uma ou mais formas de pagamento. */
function FecharConta({
  comanda,
  caixaAberto,
  temEsperando,
  aoCancelar,
}: {
  comanda: Comanda;
  caixaAberto: boolean;
  temEsperando: boolean;
  aoCancelar: () => void;
}) {
  const total = Number(comanda.total);
  const [desconto, setDesconto] = useState("");
  const [linhas, setLinhas] = useState<LinhaPagamento[]>([{ forma: "Pix", valor: numero(total) }]);
  const [recebido, setRecebido] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();

  const valorDesconto = Math.min(Math.max(paraNumero(desconto), 0), total);
  const aPagar = centavos(total - valorDesconto);
  const pago = centavos(linhas.reduce((s, l) => s + paraNumero(l.valor), 0));
  const falta = centavos(aPagar - pago);
  const emDinheiro = centavos(
    linhas.filter((l) => l.forma === "Dinheiro").reduce((s, l) => s + paraNumero(l.valor), 0),
  );
  const troco = recebido ? centavos(paraNumero(recebido) - emDinheiro) : 0;

  function mudar(i: number, parte: Partial<LinhaPagamento>) {
    setLinhas((atual) => atual.map((l, j) => (j === i ? { ...l, ...parte } : l)));
  }

  function confirmar() {
    setErro(null);
    iniciar(async () => {
      const r = await fecharConta(comanda.id, {
        desconto: valorDesconto,
        pagamentos: linhas.map((l) => ({ forma: l.forma, valor: paraNumero(l.valor) })),
      });
      if (!r.ok) setErro(r.erro);
    });
  }

  return (
    <div className="rounded-2xl border border-ouro/50 bg-carvao p-5">
      <h2 className="mb-4 font-display text-lg font-extrabold uppercase">Fechar conta</h2>

      {!caixaAberto && (
        <p className="mb-3 rounded-lg bg-cancelado/10 px-3 py-2 text-sm text-cancelado">
          O caixa está fechado. <Link href="/caixa" className="underline">Abra o caixa</Link> para receber.
        </p>
      )}
      {temEsperando && (
        <p className="mb-3 rounded-lg bg-ouro/10 px-3 py-2 text-sm text-ouro">
          Aprove ou recuse os pedidos que estão esperando antes de fechar.
        </p>
      )}

      <label className="rotulo" htmlFor="desconto">
        Desconto (opcional)
      </label>
      <input
        id="desconto"
        className="campo mb-4"
        inputMode="decimal"
        value={desconto}
        onChange={(e) => {
          setDesconto(e.target.value);
          // Com uma forma só, o valor dela acompanha o desconto.
          if (linhas.length === 1) {
            const d = Math.min(Math.max(paraNumero(e.target.value), 0), total);
            setLinhas([{ ...linhas[0], valor: numero(centavos(total - d)) }]);
          }
        }}
        placeholder="0,00"
      />

      <span className="rotulo">Pagamento</span>
      <div className="space-y-2">
        {linhas.map((l, i) => (
          <div key={i} className="flex items-center gap-2">
            <select
              className="campo"
              value={l.forma}
              onChange={(e) => mudar(i, { forma: e.target.value as FormaPagamento })}
              aria-label={`Forma de pagamento ${i + 1}`}
            >
              {FORMAS_PAGAMENTO.map((f) => (
                <option key={f} value={f}>
                  {nomePagamento(f)}
                </option>
              ))}
            </select>
            <input
              className="campo w-28 shrink-0"
              inputMode="decimal"
              value={l.valor}
              onChange={(e) => mudar(i, { valor: e.target.value })}
              aria-label={`Valor ${i + 1}`}
            />
            {linhas.length > 1 && (
              <button
                type="button"
                onClick={() => setLinhas((a) => a.filter((_, j) => j !== i))}
                className="shrink-0 text-xs text-creme-fraco underline"
                aria-label={`Remover pagamento ${i + 1}`}
              >
                ✕
              </button>
            )}
          </div>
        ))}
      </div>
      <button
        type="button"
        className="mt-2 text-xs text-ouro underline"
        onClick={() =>
          setLinhas((a) => [...a, { forma: "Dinheiro", valor: falta > 0 ? numero(falta) : "" }])
        }
      >
        Dividir em outra forma
      </button>

      {emDinheiro > 0 && (
        <div className="mt-4">
          <label className="rotulo" htmlFor="recebido">
            Recebido em dinheiro
          </label>
          <input
            id="recebido"
            className="campo"
            inputMode="decimal"
            value={recebido}
            onChange={(e) => setRecebido(e.target.value)}
            placeholder={numero(emDinheiro)}
          />
          {troco > 0 && (
            <p className="mt-1 text-sm text-creme-suave">
              Troco: <strong className="tabular text-ouro">{reais(troco)}</strong>
            </p>
          )}
        </div>
      )}

      <dl className="mt-4 space-y-1 border-t border-borda pt-3 text-sm">
        <div className="flex justify-between text-creme-suave">
          <dt>A pagar</dt>
          <dd className="tabular">{reais(aPagar)}</dd>
        </div>
        <div className={"flex justify-between " + (Math.abs(falta) < 0.01 ? "text-pronto" : "text-ouro")}>
          <dt>{falta > 0 ? "Falta" : falta < 0 ? "Passou" : "Fechou"}</dt>
          <dd className="tabular">{reais(Math.abs(falta))}</dd>
        </div>
      </dl>

      {erro && (
        <p role="alert" className="mt-3 rounded-lg bg-cancelado/10 px-3 py-2 text-sm text-cancelado">
          {erro}
        </p>
      )}

      <div className="mt-4 flex gap-2">
        <button type="button" className="btn btn-quieto" onClick={aoCancelar}>
          Voltar
        </button>
        <button
          type="button"
          className="btn btn-ouro flex-1"
          disabled={ocupado || !caixaAberto || temEsperando || Math.abs(falta) >= 0.01}
          onClick={confirmar}
        >
          {ocupado ? "Fechando…" : "Confirmar pagamento"}
        </button>
      </div>
    </div>
  );
}
