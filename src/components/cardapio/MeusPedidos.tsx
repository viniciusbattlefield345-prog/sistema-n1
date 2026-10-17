"use client";

import { useState } from "react";
import { MOTIVO_CLIENTE_DESISTIU, numeroPedido, reais } from "@/lib/formato";
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

/**
 * O mesmo status em duas palavras.
 *
 * A faixa fixa que fica em cima do cardápio tem uma linha e meia tela de
 * largura: "Esperando o atendente confirmar" não cabe junto com o número do
 * pedido, e cortar frase no meio é pior que dizer curto.
 */
const CURTO: Record<StatusPedido, string> = {
  AGUARDANDO: "esperando confirmar",
  PENDENTE: "na fila da cozinha",
  "EM PREPARO": "sendo preparado",
  PRONTO: "pronto!",
  "SAIU PARA ENTREGA": "saiu pra entrega",
  CONCLUIDO: "entregue",
  CANCELADO: "cancelado",
};

/**
 * O andamento resumido numa linha, pra quem está longe da lista.
 *
 * Com mais de um pedido andando, escolher um deles pra mostrar seria esconder
 * os outros — aí a linha conta quantos são e a lista completa fica a um toque.
 */
export function resumoPedidos(
  pedidos: PedidoAcompanhado[],
): { texto: string; andando: boolean } | null {
  if (pedidos.length === 0) return null;

  const andando = pedidos.filter((p) => !FINAIS.includes(p.status));
  if (andando.length === 0)
    return {
      texto: pedidos.length === 1 ? "Seu pedido" : `Seus ${pedidos.length} pedidos`,
      andando: false,
    };
  if (andando.length === 1)
    return {
      texto: `Pedido ${numeroPedido(andando[0].numero_dia)} · ${CURTO[andando[0].status]}`,
      andando: true,
    };
  return { texto: `${andando.length} pedidos em andamento`, andando: true };
}

export function MeusPedidos({
  pedidos,
  aoCancelar,
  semMoldura = false,
}: {
  pedidos: PedidoAcompanhado[];
  /**
   * Desistir de um pedido que ainda não foi confirmado.
   *
   * Opcional de propósito: onde não for passado, a lista continua sendo só o
   * acompanhamento que sempre foi.
   */
  aoCancelar?: (id: number) => Promise<{ ok: true } | { ok: false; erro: string }>;
  /**
   * Sem o cartão em volta nem o título: é a forma usada dentro da folha de
   * acompanhamento, que já tem cabeçalho e fundo próprios.
   */
  semMoldura?: boolean;
}) {
  /** Qual pedido está com a pergunta aberta. Nunca cancela no primeiro toque. */
  const [perguntando, setPerguntando] = useState<number | null>(null);
  const [cancelando, setCancelando] = useState<number | null>(null);
  const [erro, setErro] = useState<{ id: number; texto: string } | null>(null);

  if (pedidos.length === 0) return null;

  async function cancelar(id: number) {
    if (!aoCancelar) return;
    setErro(null);
    setCancelando(id);
    const r = await aoCancelar(id);
    setCancelando(null);
    setPerguntando(null);
    if (!r.ok) setErro({ id, texto: r.erro });
  }

  const lista = (
    <ul className="space-y-3">
        {pedidos.map((p, indice) => {
          /*
            Cancelado por quem? "Não foi aceito" é o recado da recusa da
            lanchonete. Quando quem desistiu foi o próprio cliente, dizer isso
            pra ele seria mentira — e das que assustam.
          */
          const desistiu =
            p.status === "CANCELADO" && p.motivo_recusa === MOTIVO_CLIENTE_DESISTIU;
          const situacao = desistiu
            ? { texto: "Você cancelou este pedido", cor: "text-creme-suave" }
            : SITUACAO[p.status];
          return (
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
              className={"mt-0.5 flex items-center gap-1.5 text-sm font-semibold " + situacao.cor}
            >
              {/* pedido ainda andando: o pontinho pisca pra mostrar que está vivo */}
              {!FINAIS.includes(p.status) && (
                <span aria-hidden className="anim-batida size-1.5 shrink-0 rounded-full bg-current" />
              )}
              {situacao.texto}
            </p>
            {p.status === "CANCELADO" && p.motivo_recusa && !desistiu && (
              <p className="text-xs text-creme-suave">Motivo: {p.motivo_recusa}</p>
            )}
            <p className="mt-1 text-xs leading-snug text-creme-fraco">
              {p.itens.map((i) => `${i.quantidade}x ${i.nome}`).join(" · ")}
            </p>

            {/*
              Desistir enquanto dá.
              Escolher errado é normal — toca no produto parecido, manda, e
              dois segundos depois percebe. Enquanto ninguém da equipe
              confirmou, nada foi impresso e nada entrou na conta: desfazer é
              só desfazer. Depois de confirmado o botão some, porque aí o
              papel já está na mão da cozinha e quem resolve é uma pessoa.
            */}
            {aoCancelar && p.status === "AGUARDANDO" && (
              <div className="mt-2.5">
                {perguntando === p.id ? (
                  <div className="rounded-xl border border-borda bg-breu/60 p-3">
                    <p className="text-xs leading-snug text-creme-suave">
                      Cancelar o pedido {numeroPedido(p.numero_dia)}? Ele não vai pra cozinha e
                      não entra na sua conta. Dá pra pedir de novo na hora.
                    </p>
                    <div className="mt-2.5 flex gap-2">
                      <button
                        type="button"
                        onClick={() => setPerguntando(null)}
                        disabled={cancelando === p.id}
                        className="btn btn-quieto flex-1 py-2.5 text-xs"
                      >
                        Deixa como está
                      </button>
                      <button
                        type="button"
                        onClick={() => void cancelar(p.id)}
                        disabled={cancelando === p.id}
                        className="btn btn-perigo flex-1 py-2.5 text-xs"
                      >
                        {cancelando === p.id ? "Cancelando…" : "Sim, cancelar"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setErro(null);
                      setPerguntando(p.id);
                    }}
                    className="rounded-lg border border-borda px-3 py-2 text-xs font-semibold text-creme-suave"
                  >
                    Cancelar este pedido
                  </button>
                )}
              </div>
            )}

            {erro?.id === p.id && (
              <p role="alert" className="mt-2 text-xs font-semibold text-cancelado">
                {erro.texto}
              </p>
            )}
          </li>
          );
        })}
    </ul>
  );

  if (semMoldura)
    return (
      <div aria-live="polite">
        {lista}
      </div>
    );

  return (
    <section aria-live="polite" className="mx-4 mt-3 rounded-2xl border border-borda bg-carvao p-4">
      <h2 className="mb-3 font-display text-xs font-bold uppercase tracking-[0.16em] text-creme-suave">
        Seus pedidos
      </h2>
      {lista}
    </section>
  );
}
