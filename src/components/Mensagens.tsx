"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * As perguntas e os recados do sistema, com a cara do sistema.
 *
 * Antes isto era `confirm()` e `alert()` do navegador: uma caixinha branca
 * do Windows, com fonte do Windows, dizendo "localhost:3000 diz". Num lugar
 * onde o atendente confirma cancelamento de pedido e estorno de conta no
 * meio do movimento, essa caixinha é o oposto do que precisa ser — não dá
 * pra ler de relance, não diz o que vai acontecer e não parece do sistema.
 *
 * Um gancho só por tela: `pedir` pergunta antes de agir, `sucesso` e `falha`
 * mostram o recado, e `painel` é renderizado uma vez no fim do JSX.
 */

export interface Pergunta {
  titulo: string;
  /** O que acontece se confirmar. É aqui que vai o valor, a mesa, o aviso. */
  texto?: string;
  /** O que o botão diz. "Sim" é resposta; o botão tem que dizer a ação. */
  confirmar?: string;
  /** Ação que não volta atrás: o botão fica vermelho e o foco vai pro cancelar. */
  perigo?: boolean;
}

type Recado = { id: number; tom: "ok" | "erro"; texto: string };

export function useMensagens() {
  const [pergunta, setPergunta] = useState<(Pergunta & { aoConfirmar: () => void }) | null>(
    null,
  );
  const [recados, setRecados] = useState<Recado[]>([]);
  const proximo = useRef(1);

  const dispensar = useCallback((id: number) => {
    setRecados((atual) => atual.filter((r) => r.id !== id));
  }, []);

  const recado = useCallback(
    (tom: "ok" | "erro", texto: string) => {
      const id = proximo.current++;
      setRecados((atual) => [...atual, { id, tom, texto }]);
      /**
       * Sucesso se apaga sozinho; erro fica até alguém fechar.
       * Recado de erro em cima de dinheiro não pode sumir da tela antes de
       * ser lido — e quem está no balcão não está olhando a tela inteira.
       */
      if (tom === "ok") setTimeout(() => dispensar(id), 4500);
    },
    [dispensar],
  );

  const sucesso = useCallback((texto: string) => recado("ok", texto), [recado]);
  const falha = useCallback((texto: string) => recado("erro", texto), [recado]);

  const pedir = useCallback((p: Pergunta, aoConfirmar: () => void) => {
    setPergunta({ ...p, aoConfirmar });
  }, []);

  const painel = (
    <>
      {pergunta && (
        <Dialogo
          pergunta={pergunta}
          aoFechar={() => setPergunta(null)}
          aoConfirmar={() => {
            setPergunta(null);
            pergunta.aoConfirmar();
          }}
        />
      )}
      <Pilha recados={recados} aoFechar={dispensar} />
    </>
  );

  return { pedir, sucesso, falha, painel };
}

function Dialogo({
  pergunta,
  aoFechar,
  aoConfirmar,
}: {
  pergunta: Pergunta;
  aoFechar: () => void;
  aoConfirmar: () => void;
}) {
  const confirmar = useRef<HTMLButtonElement>(null);
  const cancelar = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // Ação perigosa começa com o foco no cancelar: quem bate Enter no
    // automático não cancela um pedido sem ler.
    (pergunta.perigo ? cancelar : confirmar).current?.focus();
  }, [pergunta.perigo]);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") aoFechar();
    };
    document.addEventListener("keydown", tecla);
    return () => document.removeEventListener("keydown", tecla);
  }, [aoFechar]);

  return (
    <div
      className="anim-fundo fixed inset-0 z-[60] grid place-items-center bg-black/70 p-4"
      onClick={aoFechar}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pergunta-titulo"
        onClick={(e) => e.stopPropagation()}
        className={
          "anim-folha w-full max-w-md rounded-2xl border bg-carvao p-6 shadow-2xl " +
          (pergunta.perigo ? "border-cancelado/50" : "border-ouro/50")
        }
      >
        <h2
          id="pergunta-titulo"
          className="font-display text-xl font-extrabold uppercase leading-tight tracking-wide text-creme"
        >
          {pergunta.titulo}
        </h2>

        {pergunta.texto && (
          <p className="mt-2 text-sm leading-relaxed text-creme-suave">{pergunta.texto}</p>
        )}

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            ref={cancelar}
            type="button"
            onClick={aoFechar}
            className="btn btn-quieto sm:px-6"
          >
            Deixa pra lá
          </button>
          <button
            ref={confirmar}
            type="button"
            onClick={aoConfirmar}
            className={"btn sm:px-6 " + (pergunta.perigo ? "btn-perigo" : "btn-ouro")}
          >
            {pergunta.confirmar ?? "Confirmar"}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Os recados, empilhados num canto.
 *
 * No celular descem do topo, porque o dedo fica no rodapé e taparia; no
 * computador sobem do canto de baixo, longe do que está sendo lido.
 */
function Pilha({
  recados,
  aoFechar,
}: {
  recados: Recado[];
  aoFechar: (id: number) => void;
}) {
  if (recados.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed inset-x-3 top-3 z-[70] flex flex-col gap-2 sm:inset-x-auto sm:bottom-5 sm:right-5 sm:top-auto sm:w-96 sm:flex-col-reverse"
    >
      {recados.map((r) => (
        <button
          key={r.id}
          type="button"
          onClick={() => aoFechar(r.id)}
          title="Fechar"
          className={
            "anim-aviso flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left shadow-xl backdrop-blur-sm " +
            (r.tom === "ok"
              ? "border-pronto/50 bg-pronto/15 text-pronto"
              : "border-cancelado/50 bg-cancelado/15 text-cancelado")
          }
        >
          <span
            aria-hidden
            className={
              "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-xs font-bold " +
              (r.tom === "ok" ? "bg-pronto text-black" : "bg-cancelado text-black")
            }
          >
            {r.tom === "ok" ? "✓" : "!"}
          </span>
          <span className="min-w-0 flex-1 text-sm font-medium leading-snug">{r.texto}</span>
        </button>
      ))}
    </div>
  );
}
