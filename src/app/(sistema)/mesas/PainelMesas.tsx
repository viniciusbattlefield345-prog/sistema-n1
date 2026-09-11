"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Cabecalho, Vazio } from "@/components/Cabecalho";
import { CartaoAprovacao } from "./CartaoAprovacao";
import { useAoVivo } from "@/lib/aoVivo";
import { definirSom, somLigado } from "@/lib/som";
import { duracao, minutosDesde, reais } from "@/lib/formato";
import type { Pedido } from "@/lib/tipos";

export interface MesaNoSalao {
  id: number;
  numero: number;
  comanda: { id: number; total: number; aberta_em: string } | null;
  aguardando: number;
}

/**
 * A tela do atendente no celular: pedidos esperando aprovação no topo,
 * e o salão inteiro embaixo — mesa livre, ocupada, quanto já deu.
 */
export function PainelMesas({
  mesas,
  aguardando,
  caixaAberto,
  ehDono,
  impressaoAtrasada,
  falhasImpressao,
}: {
  mesas: MesaNoSalao[];
  aguardando: Pedido[];
  caixaAberto: boolean;
  ehDono: boolean;
  impressaoAtrasada: number;
  falhasImpressao: number;
}) {
  useAoVivo(["pedidos", "comandas", "fila_impressao"]);

  const ocupadas = mesas.filter((m) => m.comanda).length;

  return (
    <div className="p-4 lg:p-8">
      <Cabecalho
        fita="Salão"
        titulo="Mesas"
        descricao="Pedido feito pelo QR chega aqui primeiro. Aprovou, sai sozinho na impressora do balcão."
      >
        <Controles />
      </Cabecalho>

      <div className="mb-5 space-y-2">
        {!caixaAberto && (
          <Aviso tom="perigo">
            <strong>Caixa fechado:</strong> o QR das mesas não aceita pedido.{" "}
            <Link href="/caixa" className="underline underline-offset-2">
              Abrir o caixa
            </Link>
          </Aviso>
        )}
        {impressaoAtrasada > 0 && (
          <Aviso tom="alerta">
            <strong>{impressaoAtrasada} cupom(ns) parado(s) na fila há mais de 1 minuto.</strong>{" "}
            A tela Impressão está aberta no computador do balcão?{" "}
            <Link href="/impressao" className="underline underline-offset-2">
              Abrir Impressão
            </Link>
          </Aviso>
        )}
        {falhasImpressao > 0 && (
          <Aviso tom="perigo">
            <strong>{falhasImpressao} cupom(ns) não imprimiram</strong> nas últimas horas.{" "}
            <Link href="/impressao" className="underline underline-offset-2">
              Ver e mandar de novo
            </Link>
          </Aviso>
        )}
      </div>

      {aguardando.length > 0 && (
        <section className="mb-8" aria-live="polite">
          <h2 className="mb-3 flex items-center gap-2 font-display text-sm font-bold uppercase tracking-[0.14em] text-ouro">
            <span className="relative flex size-2.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-ouro opacity-75" />
              <span className="relative inline-flex size-2.5 rounded-full bg-ouro" />
            </span>
            Esperando aprovação ({aguardando.length})
          </h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {aguardando.map((p) => (
              <CartaoAprovacao key={p.id} pedido={p} />
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="font-display text-sm font-bold uppercase tracking-[0.14em] text-creme-suave">
            Salão · {ocupadas} de {mesas.length} ocupadas
          </h2>
          {ehDono && (
            <Link href="/mesas/cadastro" className="text-xs text-creme-suave underline hover:text-ouro">
              Mesas e QR codes
            </Link>
          )}
        </div>

        {mesas.length === 0 ? (
          <Vazio
            titulo="Nenhuma mesa cadastrada"
            texto="Cadastre as mesas para gerar os QR codes que vão em cada uma."
          >
            {ehDono && (
              <Link href="/mesas/cadastro" className="btn btn-ouro">
                Cadastrar mesas
              </Link>
            )}
          </Vazio>
        ) : (
          <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
            {mesas.map((m) => (
              <Link
                key={m.id}
                href={`/mesas/${m.id}`}
                className={
                  "relative flex aspect-square flex-col justify-between rounded-2xl border p-3 transition-colors " +
                  (m.aguardando > 0
                    ? "border-ouro bg-ouro/15"
                    : m.comanda
                      ? "border-ouro/40 bg-ouro/5 hover:border-ouro"
                      : "border-borda bg-carvao hover:border-borda-forte")
                }
              >
                <span className="font-display text-3xl font-extrabold leading-none">{m.numero}</span>
                {m.comanda ? (
                  <span>
                    <span className="tabular block text-sm font-bold text-ouro">
                      {reais(m.comanda.total)}
                    </span>
                    <span className="block text-xs text-creme-suave">
                      {duracao(minutosDesde(m.comanda.aberta_em))}
                    </span>
                  </span>
                ) : (
                  <span className="text-xs font-semibold uppercase tracking-wide text-creme-fraco">
                    Livre
                  </span>
                )}
                {m.aguardando > 0 && (
                  <span
                    className="absolute right-2 top-2 grid size-6 place-items-center rounded-full bg-ouro text-xs font-bold text-black"
                    aria-label={`${m.aguardando} pedido(s) esperando`}
                  >
                    {m.aguardando}
                  </span>
                )}
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Aviso({ tom, children }: { tom: "perigo" | "alerta"; children: React.ReactNode }) {
  return (
    <p
      role="status"
      className={
        "rounded-xl border px-4 py-3 text-sm " +
        (tom === "perigo"
          ? "border-cancelado/40 bg-cancelado/10 text-cancelado"
          : "border-ouro/40 bg-ouro/10 text-ouro")
      }
    >
      {children}
    </p>
  );
}

/**
 * Som do pedido novo e "tela sempre ligada". Com a tela bloqueada o
 * navegador para de ouvir o servidor — por isso existe a segunda opção.
 */
function Controles() {
  const [som, setSom] = useState(true);
  const [podeTravar, setPodeTravar] = useState(false);
  const [telaLigada, setTelaLigada] = useState(false);
  const trava = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    setSom(somLigado());
    setPodeTravar("wakeLock" in navigator);
  }, []);

  useEffect(() => {
    if (!telaLigada) return;
    let ativo = true;

    const pedir = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        trava.current = await navigator.wakeLock.request("screen");
      } catch {
        if (ativo) setTelaLigada(false);
      }
    };

    void pedir();
    // O navegador solta a trava quando a aba some; ao voltar, pede de novo.
    const aoVoltar = () => void pedir();
    document.addEventListener("visibilitychange", aoVoltar);

    return () => {
      ativo = false;
      document.removeEventListener("visibilitychange", aoVoltar);
      void trava.current?.release();
      trava.current = null;
    };
  }, [telaLigada]);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          definirSom(!som);
          setSom(!som);
        }}
        aria-pressed={som}
        className={"btn px-3 py-2 text-sm " + (som ? "btn-quieto" : "btn-quieto opacity-60")}
      >
        {som ? "Som ligado" : "Som desligado"}
      </button>
      {podeTravar && (
        <button
          type="button"
          onClick={() => setTelaLigada((v) => !v)}
          aria-pressed={telaLigada}
          className={"btn px-3 py-2 text-sm " + (telaLigada ? "btn-ouro" : "btn-quieto")}
        >
          {telaLigada ? "Tela sempre ligada" : "Manter tela ligada"}
        </button>
      )}
    </>
  );
}
