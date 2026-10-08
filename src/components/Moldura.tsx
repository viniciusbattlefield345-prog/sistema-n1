"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { BarraLateral } from "./BarraLateral";
import { Marca } from "./Marca";
import { criarClienteNavegador } from "@/lib/supabase/client";
import { apitar, prepararSom } from "@/lib/som";
import type { Papel } from "@/lib/tipos";

/**
 * Moldura do sistema.
 *
 * No computador do caixa o menu fica sempre à vista. No celular ele viraria
 * 232px dos 375 disponíveis, então some e volta como gaveta.
 */
export function Moldura({
  nome,
  papel,
  children,
}: {
  nome: string;
  papel: Papel;
  children: React.ReactNode;
}) {
  const [aberto, setAberto] = useState(false);
  const caminho = usePathname();

  // Navegou: fecha a gaveta, senão ela tapa a tela que acabou de abrir.
  useEffect(() => setAberto(false), [caminho]);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, []);

  return (
    <div className="min-h-screen">
      {/* barra de topo — só no celular */}
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-borda bg-carvao px-4 py-2.5 lg:hidden">
        <button
          type="button"
          onClick={() => setAberto(true)}
          aria-label="Abrir menu"
          aria-expanded={aberto}
          className="btn btn-quieto p-2.5"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            className="size-5"
            aria-hidden
          >
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
        <Marca tamanho={0.95} alinhamento="esquerda" emLinha />
      </header>

      {/* véu atrás da gaveta */}
      {aberto && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={() => setAberto(false)}
          role="presentation"
        />
      )}

      <BarraLateral nome={nome} papel={papel} aberto={aberto} />

      <main className="bg-breu lg:ml-[232px]">{children}</main>

      {papel !== "cozinha" && <AvisoAguardando />}
    </div>
  );
}

/**
 * Pedido esperando aprovação, em qualquer tela: o atendente pode estar no PDV
 * ou no caixa quando o cliente pede. Apita quando a conta sobe.
 *
 * Mesa e delivery são contados separados porque moram em telas diferentes —
 * um aviso que leva pro lugar errado é pior do que aviso nenhum.
 */
function AvisoAguardando() {
  const [mesa, setMesa] = useState(0);
  const [entrega, setEntrega] = useState(0);
  const anterior = useRef<number | null>(null);
  const caminho = usePathname();

  useEffect(() => {
    const soltarSom = prepararSom();
    const supabase = criarClienteNavegador();
    let vivo = true;

    async function contar() {
      const { data } = await supabase
        .from("pedidos")
        .select("tipo")
        .eq("status", "AGUARDANDO");
      if (!vivo || !data) return;

      const deMesa = data.filter((p) => p.tipo === "MESA").length;
      const total = data.length;
      if (anterior.current !== null && total > anterior.current) apitar();
      anterior.current = total;
      setMesa(deMesa);
      setEntrega(total - deMesa);
    }

    void contar();
    const canal = supabase
      .channel(`aviso-aguardando-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "pedidos" }, () => void contar())
      .subscribe();
    // Rede de segurança pra quando o tempo real cai (Wi-Fi ruim, aba velha):
    // 8s é o atraso máximo que um pedido pode ficar invisível pro atendente.
    const relogio = setInterval(() => void contar(), 8000);
    const aoVoltar = () => {
      if (document.visibilityState === "visible") void contar();
    };
    document.addEventListener("visibilitychange", aoVoltar);

    return () => {
      vivo = false;
      clearInterval(relogio);
      soltarSom();
      document.removeEventListener("visibilitychange", aoVoltar);
      void supabase.removeChannel(canal);
    };
  }, []);

  // Na própria tela do assunto o selo é ruído: a lista já está logo abaixo.
  const avisos = [
    caminho === "/mesas" || mesa === 0
      ? null
      : { href: "/mesas", texto: `${mesa} na mesa`, chave: "mesa" },
    caminho === "/entregas" || entrega === 0
      ? null
      : { href: "/entregas", texto: `${entrega} no delivery`, chave: "entrega" },
  ].filter((a) => a !== null);

  if (avisos.length === 0) return null;

  return (
    <div className="nao-imprimir fixed right-3 top-[4.25rem] z-[45] flex flex-col items-end gap-2 lg:top-4">
      {avisos.map((a) => (
        <Link
          key={a.chave}
          href={a.href}
          className="flex items-center gap-2 rounded-full bg-ouro px-4 py-2.5 text-sm font-bold text-black shadow-lg shadow-black/60"
        >
          <span className="relative flex size-2.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-black opacity-60" />
            <span className="relative inline-flex size-2.5 rounded-full bg-black" />
          </span>
          {a.texto} esperando
        </Link>
      ))}
    </div>
  );
}
