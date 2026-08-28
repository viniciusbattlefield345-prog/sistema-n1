import { notFound } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/server";
import { PainelImpressao } from "./PainelImpressao";
import type { ConfigImpressoras, ConfigRestaurante, Pedido } from "@/lib/tipos";

const IMPRESSORAS_PADRAO: ConfigImpressoras = {
  cozinha: "TANCA TP-650",
  entrega: "TANCA TP-650",
  colunas: 48,
  cortar: true,
  abrir_gaveta: false,
  vias_cozinha: 1,
  vias_entrega: 1,
};

export default async function PaginaImpressao({
  params,
}: PageProps<"/imprimir/[id]">) {
  const { id } = await params;
  const supabase = await criarClienteServidor();

  const [{ data: pedido }, { data: configs }] = await Promise.all([
    supabase
      .from("pedidos")
      .select("*, itens_pedido(*, item_adicionais(*))")
      .eq("id", Number(id))
      .maybeSingle(),
    supabase.from("configuracoes").select("chave, valor"),
  ]);

  if (!pedido) notFound();

  const mapa = new Map((configs ?? []).map((c) => [c.chave, c.valor]));
  const restaurante = mapa.get("restaurante") as ConfigRestaurante;
  const impressoras = {
    ...IMPRESSORAS_PADRAO,
    ...((mapa.get("impressoras") ?? {}) as Partial<ConfigImpressoras>),
  };

  return (
    <PainelImpressao
      pedido={pedido as Pedido}
      restaurante={restaurante}
      impressoras={impressoras}
    />
  );
}
