import { notFound } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/server";
import { lerConfiguracoes } from "@/lib/configuracoes";
import { PainelImpressao } from "./PainelImpressao";
import type { Pedido, TrabalhoImpressao } from "@/lib/tipos";

export const revalidate = 0;

export default async function PaginaImprimir({ params }: PageProps<"/imprimir/[id]">) {
  const { id } = await params;
  const pedidoId = Number(id);
  if (!Number.isInteger(pedidoId)) notFound();

  const supabase = await criarClienteServidor();

  const [{ data: pedido }, { data: configs }, { data: impressoes }] = await Promise.all([
    supabase
      .from("pedidos")
      .select("*, mesas(numero), itens_pedido(*, item_adicionais(*))")
      .eq("id", pedidoId)
      .maybeSingle(),
    supabase.from("configuracoes").select("chave, valor"),
    supabase
      .from("fila_impressao")
      .select("*")
      .eq("pedido_id", pedidoId)
      .order("criado_em", { ascending: false })
      .limit(5),
  ]);

  if (!pedido) notFound();

  const { restaurante, impressoras } = lerConfiguracoes(configs);

  return (
    <PainelImpressao
      pedido={pedido as Pedido}
      restaurante={restaurante}
      impressoras={impressoras}
      impressoes={(impressoes ?? []) as TrabalhoImpressao[]}
    />
  );
}
