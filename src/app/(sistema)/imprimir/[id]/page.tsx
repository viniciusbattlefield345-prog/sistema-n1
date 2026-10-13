import { notFound } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/server";
import { lerConfiguracoes } from "@/lib/configuracoes";
import { PainelImpressao } from "./PainelImpressao";
import type { Comanda, Pedido, TrabalhoImpressao } from "@/lib/tipos";

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
      // Mesma ordem que a estação usa pra montar o papel: a pré-visualização
      // tem que ser o cupom, não uma lista parecida com ele.
      .order("id", { referencedTable: "itens_pedido" })
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

  /**
   * A conta da mesa deste pedido.
   *
   * O cliente pede "a conta" e quer a da mesa inteira; a atendente, parada
   * no pedido de alguém, precisa alcançar as duas coisas do mesmo lugar.
   * Vem com todos os pedidos porque a conta é a soma deles.
   */
  let comanda: Comanda | null = null;
  if (pedido.comanda_id) {
    const { data } = await supabase
      .from("comandas")
      .select("*, mesas(numero), pedidos(*, itens_pedido(*, item_adicionais(*))), pagamentos(*)")
      .eq("id", pedido.comanda_id)
      .order("id", { referencedTable: "pedidos" })
      .maybeSingle();
    comanda = (data ?? null) as Comanda | null;
  }

  const { restaurante, impressoras } = lerConfiguracoes(configs);

  return (
    <PainelImpressao
      pedido={pedido as Pedido}
      comanda={comanda}
      restaurante={restaurante}
      impressoras={impressoras}
      impressoes={(impressoes ?? []) as TrabalhoImpressao[]}
    />
  );
}
