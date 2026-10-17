"use client";

import { useEffect, useRef, useState } from "react";
import { Folha, SAIDA_FOLHA } from "./Folha";
import { MeusPedidos, resumoPedidos, type PedidoAcompanhado } from "./MeusPedidos";

/**
 * Acompanhar o pedido de qualquer lugar do cardápio.
 *
 * A lista "Seus pedidos" sempre morou no alto da página — e o cardápio tem
 * **14 telas de celular** de altura (medido: 11.461 px em 375×812). Quem manda
 * um pedido estando no meio dele fica a dez telas da própria lista, sem
 * nenhum sinal de que ela existe. Era o caso de quem pede, pede de novo, e
 * nunca mais vê o andamento de nada: o atendente via tudo, o cliente não via
 * nem o primeiro pedido.
 *
 * A lista continua no alto, porque ali ela é a primeira coisa que a pessoa lê
 * ao abrir o QR. O que muda é que, **enquanto ela está fora de vista**, uma
 * faixa fixa mostra o andamento em uma linha — e tocar nela abre a lista por
 * cima do cardápio, sem perder o lugar onde a pessoa estava lendo.
 */
export function Acompanhamento({
  pedidos,
  aoCancelar,
  aberto,
  aoAbrir,
  aoFechar,
}: {
  pedidos: PedidoAcompanhado[];
  aoCancelar?: (id: number) => Promise<{ ok: true } | { ok: false; erro: string }>;
  /** A folha é aberta pela faixa daqui, e também pelo aviso de "pedido enviado". */
  aberto: boolean;
  aoAbrir: () => void;
  aoFechar: () => void;
}) {
  const alvo = useRef<HTMLDivElement>(null);
  /** A lista do alto está na tela? Então a faixa seria a mesma coisa duas vezes. */
  const [listaAVista, setListaAVista] = useState(true);
  const [saindo, setSaindo] = useState(false);

  useEffect(() => {
    const no = alvo.current;
    // Sem pedido nenhum não há o que medir.
    if (!no || pedidos.length === 0) return;

    /*
      Medida direta, de propósito, em vez de IntersectionObserver.

      O observer só entrega resultado quando o navegador está desenhando a
      página: numa aba em segundo plano ele não chama ninguém, e a faixa
      ficaria presa no último estado que ele alcançou a contar. Medido aqui
      mesmo, num painel que não estava repintando, ele nunca disparou.
      getBoundingClientRect responde sempre, e isto é a leitura de um
      elemento só por rolagem.
    */
    const conferir = () => {
      const r = no.getBoundingClientRect();
      setListaAVista(r.bottom > 0 && r.top < window.innerHeight);
    };
    conferir();
    window.addEventListener("scroll", conferir, { passive: true });
    window.addEventListener("resize", conferir);
    return () => {
      window.removeEventListener("scroll", conferir);
      window.removeEventListener("resize", conferir);
    };
  }, [pedidos.length]);

  /* Fechar é em dois tempos, como toda folha: desce, e só então sai da tela. */
  function fechar() {
    setSaindo(true);
    setTimeout(() => {
      setSaindo(false);
      aoFechar();
    }, SAIDA_FOLHA);
  }

  const resumo = resumoPedidos(pedidos);

  return (
    <>
      <div ref={alvo}>
        <MeusPedidos pedidos={pedidos} aoCancelar={aoCancelar} />
      </div>

      {resumo && !listaAVista && (
        <button
          type="button"
          onClick={aoAbrir}
          className="anim-aviso fixed inset-x-0 top-0 z-40 mx-auto flex max-w-2xl items-center gap-2.5 border-b border-ouro/50 bg-carvao/95 px-4 py-2.5 text-left shadow-lg shadow-black/60 backdrop-blur"
        >
          {/* o pontinho só pisca enquanto algum pedido está andando */}
          {resumo.andando && (
            <span aria-hidden className="relative flex size-2.5 shrink-0">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-ouro opacity-60" />
              <span className="relative inline-flex size-2.5 rounded-full bg-ouro" />
            </span>
          )}
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-creme">
            {resumo.texto}
          </span>
          <span className="shrink-0 whitespace-nowrap font-display text-xs font-bold uppercase tracking-wide text-ouro">
            Acompanhar
          </span>
        </button>
      )}

      {aberto && (
        <Folha rotulo="Seus pedidos" saindo={saindo} aoFechar={fechar}>
          <header className="flex items-center justify-between gap-3 border-b border-borda px-5 py-4">
            <h2 className="font-display text-lg font-extrabold uppercase">Seus pedidos</h2>
            <button
              type="button"
              onClick={fechar}
              className="text-sm text-creme-suave underline underline-offset-2"
            >
              Voltar
            </button>
          </header>

          <div className="flex-1 overflow-y-auto px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <MeusPedidos pedidos={pedidos} aoCancelar={aoCancelar} semMoldura />
            <p className="mt-5 text-xs leading-relaxed text-creme-fraco">
              Esta lista é só dos pedidos feitos neste celular. Quem pediu pelo
              celular de outra pessoa acompanha no aparelho dela — a conta
              continua sendo uma só, da mesa.
            </p>
          </div>
        </Folha>
      )}
    </>
  );
}
