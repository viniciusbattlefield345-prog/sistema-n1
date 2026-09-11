import { criarClienteServidor } from "@/lib/supabase/server";
import { PainelCaixa } from "./PainelCaixa";
import type { Caixa, FormaPagamento } from "@/lib/tipos";

export type ResumoPagamento = Record<FormaPagamento, number>;

export const revalidate = 0;

export default async function PaginaCaixa() {
  const supabase = await criarClienteServidor();

  const { data: aberto } = await supabase
    .from("caixas")
    .select("*")
    .eq("status", "ABERTO")
    .maybeSingle();

  // As vendas do caixa vêm por caixa_id, não por horário: é o que garante
  // que o fechamento bata mesmo se alguém mexer no relógio.
  const resumo: ResumoPagamento = {
    Dinheiro: 0,
    Pix: 0,
    "Cartao Debito": 0,
    "Cartao Credito": 0,
  };
  let quantidade = 0;
  let mesasAbertas = { quantidade: 0, total: 0 };

  if (aberto) {
    const [{ data: pedidos }, { data: pagamentos }, { data: contas }] = await Promise.all([
      // Entrega e retirada pagam no pedido...
      supabase
        .from("pedidos")
        .select("total, forma_pagamento")
        .eq("caixa_id", aberto.id)
        .neq("tipo", "MESA")
        .not("status", "in", '("CANCELADO","AGUARDANDO")'),
      // ...mesa paga quando a conta fecha.
      supabase.from("pagamentos").select("valor, forma, comanda_id").eq("caixa_id", aberto.id),
      supabase.from("comandas").select("total").eq("status", "ABERTA"),
    ]);

    for (const p of pedidos ?? []) {
      if (!p.forma_pagamento) continue;
      resumo[p.forma_pagamento as FormaPagamento] += Number(p.total);
      quantidade++;
    }

    const contasPagas = new Set<number>();
    for (const pg of pagamentos ?? []) {
      resumo[pg.forma as FormaPagamento] += Number(pg.valor);
      contasPagas.add(pg.comanda_id);
    }
    quantidade += contasPagas.size;

    mesasAbertas = {
      quantidade: (contas ?? []).length,
      total: (contas ?? []).reduce((s, c) => s + Number(c.total), 0),
    };
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
      mesasAbertas={mesasAbertas}
      historico={(historico ?? []) as Caixa[]}
    />
  );
}
