"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { BarraLateral } from "./BarraLateral";
import { Marca } from "./Marca";
import type { Papel } from "@/lib/tipos";

/**
 * Moldura do sistema.
 *
 * No computador do caixa o menu fica sempre à vista. No celular ele viraria
 * 232px dos 375 disponíveis, então some e volta como gaveta — a dona precisa
 * conseguir olhar o movimento pelo telefone.
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
        <Marca tamanho={34} comFita={false} />
        <span className="font-display text-sm uppercase tracking-[0.12em] text-creme">
          N°1 Restaurante
        </span>
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
    </div>
  );
}
