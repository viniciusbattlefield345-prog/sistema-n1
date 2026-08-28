import { criarClienteServidor } from "@/lib/supabase/server";
import { PainelCaixa } from "./PainelCaixa";
import type { Caixa, FormaPagamento } from "@/lib/tipos";

export type ResumoPagamento = Record<FormaPagamento, number>;

export default async function PaginaCaixa() {
  const supabase = await criarClienteServidor();

  const { data: aberto } = await supabase
    .from("caixas")
    .select("*")
    .eq("status", "ABERTO")
    .maybeSingle();

  // As vendas do caixa vêm por caixa_id, não por horário: é o que garante
  // que o fechamento bata mesmo se alguém mexer no relógio.
  let resumo: ResumoPagamento = {
    Dinheiro: 0,
    Pix: 0,
    "Cartao Debito": 0,
    "Cartao Credito": 0,
  };
  let quantidade = 0;

  if (aberto) {
    const { data: pedidos } = await supabase
      .from("pedidos")
      .select("total, forma_pagamento")
      .eq("caixa_id", aberto.id)
      .neq("status", "CANCELADO");

    for (const p of pedidos ?? []) {
      if (!p.forma_pagamento) continue;
      resumo[p.forma_pagamento as FormaPagamento] += Number(p.total);
      quantidade++;
    }
  }

  const { data: historico } = await supabase
    .from("caixas")
    .select("*")
    .eq("status", "FECHADO")
    .order("fechado_em", { ascending: false })
    .limit(30);

  return (
    <PainelCaixa
      aberto={(aberto ?? null) as Caixa | null}
      resumo={resumo}
      quantidade={quantidade}
      historico={(historico ?? []) as Caixa[]}
    />
  );
}
