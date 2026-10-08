"use client";

import { useEffect } from "react";

/**
 * Folha que sobe de baixo no celular e vira janela no computador.
 *
 * Fechar é em dois tempos: quem usa liga `saindo`, espera a folha descer e só
 * então tira do ar. Por isso a duração da saída mora aqui — quem fecha precisa
 * esperar exatamente esse tempo.
 */
export const SAIDA_FOLHA = 180;

export function Folha({
  rotulo,
  aoFechar,
  saindo = false,
  children,
}: {
  rotulo: string;
  aoFechar: () => void;
  /** Ligado pelo pai durante os SAIDA_FOLHA ms em que a folha desce. */
  saindo?: boolean;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const esc = (e: KeyboardEvent) => e.key === "Escape" && aoFechar();
    window.addEventListener("keydown", esc);
    return () => {
      document.body.style.overflow = anterior;
      window.removeEventListener("keydown", esc);
    };
  }, [aoFechar]);

  return (
    <div
      className={
        "anim-fundo fixed inset-0 z-50 flex items-end justify-center bg-black/75 transition-opacity duration-150 sm:items-center sm:p-4 " +
        (saindo ? "opacity-0" : "opacity-100")
      }
      onClick={aoFechar}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={rotulo}
        onClick={(e) => e.stopPropagation()}
        className={
          "anim-folha flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-borda bg-carvao transition-transform duration-150 ease-in sm:rounded-3xl " +
          (saindo ? "translate-y-full sm:translate-y-0 sm:scale-95" : "translate-y-0")
        }
      >
        {children}
      </div>
    </div>
  );
}
