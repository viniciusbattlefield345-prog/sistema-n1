import { notFound } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/server";
import { DetalheMesa } from "./DetalheMesa";
import type { Comanda, Mesa, TrabalhoImpressao } from "@/lib/tipos";

export const revalidate = 0;

export default async function PaginaDetalheMesa({ params }: PageProps<"/mesas/[id]">) {
  const { id } = await params;
  const mesaId = Number(id);
  if (!Number.isInteger(mesaId)) notFound();

  const supabase = await criarClienteServidor();

  const [{ data: mesa }, { data: comanda }, { data: caixa }] = await Promise.all([
    supabase.from("mesas").select("id, numero, codigo, ativo").eq("id", mesaId).maybeSingle(),
    supabase
      .from("comandas")
      .select("*, pedidos(*, itens_pedido(*, item_adicionais(*)))")
      .eq("mesa_id", mesaId)
      .eq("status", "ABERTA")
      .maybeSingle(),
    supabase.from("caixas").select("id").eq("status", "ABERTO").maybeSingle(),
  ]);

  if (!mesa) notFound();

  let impressoes: TrabalhoImpressao[] = [];
  if (comanda) {
    const ids = ((comanda.pedidos ?? []) as { id: number }[]).map((p) => p.id);
    const filtro = ids.length
      ? `comanda_id.eq.${comanda.id},pedido_id.in.(${ids.join(",")})`
      : `comanda_id.eq.${comanda.id}`;
    const { data } = await supabase
      .from("fila_impressao")
      .select("*")
      .or(filtro)
      .order("criado_em", { ascending: false });
    impressoes = (data ?? []) as TrabalhoImpressao[];
  }

  return (
    <DetalheMesa
      mesa={mesa as Mesa}
      comanda={(comanda ?? null) as Comanda | null}
      caixaAberto={Boolean(caixa)}
      impressoes={impressoes}
    />
  );
}
