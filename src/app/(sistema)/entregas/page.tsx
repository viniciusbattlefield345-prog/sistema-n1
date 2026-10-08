import { criarClienteServidor } from "@/lib/supabase/server";
import { PainelEntregas } from "./PainelEntregas";
import type { Pedido } from "@/lib/tipos";

export const revalidate = 0;

export default async function PaginaEntregas() {
  const supabase = await criarClienteServidor();

  // 18 horas cobre um turno de noite inteiro sem trazer a semana toda junto.
  const desde = new Date(Date.now() - 18 * 3600_000).toISOString();

  const [{ data: pedidos }, { count: bairrosAtivos }, { data: caixa }] = await Promise.all([
    supabase
      .from("pedidos")
      .select("*, itens_pedido(*, item_adicionais(*))")
      .in("tipo", ["ENTREGA", "RETIRADA"])
      .gte("criado_em", desde)
      .order("criado_em", { ascending: true }),
    supabase.from("bairros").select("id", { count: "exact", head: true }).eq("ativo", true),
    supabase.from("caixas").select("id").eq("status", "ABERTO").maybeSingle(),
  ]);

  return (
    <PainelEntregas
      pedidos={(pedidos ?? []) as Pedido[]}
      bairrosAtivos={bairrosAtivos ?? 0}
      caixaAberto={Boolean(caixa)}
    />
  );
}
