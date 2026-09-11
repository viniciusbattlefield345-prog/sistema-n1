"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { criarClienteNavegador } from "@/lib/supabase/client";

/**
 * Mantém a tela em dia sozinha.
 *
 * Qualquer mudança nas tabelas avisadas pelo Supabase (tempo real) recarrega
 * os dados do servidor — com meio segundo de respiro, porque um pedido chega
 * em várias gravações seguidas (cabeçalho, itens, adicionais) e só faz
 * sentido mostrar o resultado final.
 *
 * O tempo real cai quando o celular bloqueia a tela. Por isso a tela também
 * recarrega ao voltar a ficar visível e, por garantia, a cada `folgaSegundos`.
 */
export function useAoVivo(tabelas: string[], folgaSegundos = 30) {
  const router = useRouter();
  const chave = tabelas.join(",");

  useEffect(() => {
    const supabase = criarClienteNavegador();
    let espera: ReturnType<typeof setTimeout> | null = null;

    const recarregar = () => {
      if (espera) clearTimeout(espera);
      espera = setTimeout(() => router.refresh(), 500);
    };

    const canal = supabase.channel(`ao-vivo-${chave}-${Math.random().toString(36).slice(2)}`);
    for (const tabela of chave.split(",")) {
      canal.on("postgres_changes", { event: "*", schema: "public", table: tabela }, recarregar);
    }
    canal.subscribe();

    const aoVoltar = () => {
      if (document.visibilityState === "visible") recarregar();
    };
    document.addEventListener("visibilitychange", aoVoltar);
    const relogio = setInterval(recarregar, folgaSegundos * 1000);

    return () => {
      if (espera) clearTimeout(espera);
      clearInterval(relogio);
      document.removeEventListener("visibilitychange", aoVoltar);
      void supabase.removeChannel(canal);
    };
  }, [chave, folgaSegundos, router]);
}
