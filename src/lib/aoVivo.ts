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
 *
 * Essa folga é rede de segurança, não é o motor — e rede de segurança cara
 * derrubou a lanchonete.
 *
 * Em 25/10/2026 a Vercel desligou o projeto inteiro por estourar o limite de
 * chamadas do plano. Não foi movimento de cliente: era esta linha. Cada
 * `router.refresh()` é uma ida ao servidor, e ela contava duas vezes (o
 * porteiro do login roda antes da página). Uma aba esquecida aberta no
 * balcão, a 10 segundos por volta, fazia meio milhão de chamadas por mês
 * sozinha — de madrugada, com a loja fechada, ninguém olhando.
 *
 * Então a folga virou minuto, e parou de correr com a aba escondida. Quem
 * avisa de pedido novo continua sendo o tempo real (e o alarme da Moldura,
 * que fala direto com o banco e não custa nada aqui). Esta folga só existe
 * pro caso de o tempo real ter caído sem avisar.
 */
export function useAoVivo(tabelas: string[], folgaSegundos = 120) {
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
    // Aba escondida não recarrega: ninguém está lendo aquela tela, e o
    // `visibilitychange` abaixo já põe tudo em dia no instante em que
    // alguém volta pra ela.
    const relogio = setInterval(() => {
      if (document.visibilityState === "visible") recarregar();
    }, folgaSegundos * 1000);

    return () => {
      if (espera) clearTimeout(espera);
      clearInterval(relogio);
      document.removeEventListener("visibilitychange", aoVoltar);
      void supabase.removeChannel(canal);
    };
  }, [chave, folgaSegundos, router]);
}
