import { criarClienteServidor } from "@/lib/supabase/server";
import { ListaPedidos } from "./ListaPedidos";
import type { Pedido } from "@/lib/tipos";

export const revalidate = 0;

export default async function PaginaPedidos() {
  const supabase = await criarClienteServidor();

  // Últimos 7 dias: o histórico completo é assunto do relatório.
  const desde = new Date(Date.now() - 7 * 86400000).toISOString();

  const { data } = await supabase
    .from("pedidos")
    .select("*, itens_pedido(*, item_adicionais(*))")
    .gte("criado_em", desde)
    .order("criado_em", { ascending: false });

  return <ListaPedidos pedidos={(data ?? []) as Pedido[]} />;
}
