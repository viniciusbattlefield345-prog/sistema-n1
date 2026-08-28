import { criarClienteServidor } from "@/lib/supabase/server";
import { PainelCozinha } from "./PainelCozinha";
import type { Pedido } from "@/lib/tipos";

// A cozinha é um painel vivo: recarrega sozinho a cada 15s.
export const revalidate = 0;

export default async function PaginaCozinha() {
  const supabase = await criarClienteServidor();

  const { data: pedidos } = await supabase
    .from("pedidos")
    .select("*, itens_pedido(*, item_adicionais(*))")
    .not("status", "in", '("CONCLUIDO","CANCELADO")')
    .order("criado_em", { ascending: true });

  return <PainelCozinha pedidos={(pedidos ?? []) as Pedido[]} />;
}
