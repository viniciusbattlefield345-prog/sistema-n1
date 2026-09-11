import { criarClienteServidor } from "@/lib/supabase/server";
import { PainelCozinha } from "./PainelCozinha";
import type { Pedido } from "@/lib/tipos";

// A cozinha é um painel vivo: se atualiza sozinho.
export const revalidate = 0;

export default async function PaginaCozinha() {
  const supabase = await criarClienteServidor();

  // Pedido esperando aprovação ainda não é da cozinha.
  const { data: pedidos } = await supabase
    .from("pedidos")
    .select("*, mesas(numero), itens_pedido(*, item_adicionais(*))")
    .not("status", "in", '("AGUARDANDO","CONCLUIDO","CANCELADO")')
    .order("criado_em", { ascending: true });

  return <PainelCozinha pedidos={(pedidos ?? []) as Pedido[]} />;
}
