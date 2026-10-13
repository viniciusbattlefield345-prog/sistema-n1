import { notFound } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/server";
import { usuarioAtual } from "@/lib/supabase/sessao";
import { DetalheMesa } from "./DetalheMesa";
import type { Comanda, Mesa, TrabalhoImpressao } from "@/lib/tipos";

export const revalidate = 0;

export default async function PaginaDetalheMesa({ params }: PageProps<"/mesas/[id]">) {
  const { id } = await params;
  const mesaId = Number(id);
  if (!Number.isInteger(mesaId)) notFound();

  const supabase = await criarClienteServidor();
  const user = await usuarioAtual(supabase);

  const [{ data: mesa }, { data: comanda }, { data: caixa }, { data: perfil }] = await Promise.all([
    supabase.from("mesas").select("id, numero, codigo, ativo").eq("id", mesaId).maybeSingle(),
    supabase
      .from("comandas")
      .select("*, pedidos(*, itens_pedido(*, item_adicionais(*)))")
      .eq("mesa_id", mesaId)
      .eq("status", "ABERTA")
      .maybeSingle(),
    supabase.from("caixas").select("id").eq("status", "ABERTO").maybeSingle(),
    supabase.from("perfis").select("papel").eq("id", user!.id).single(),
  ]);

  if (!mesa) notFound();

  /**
   * A conta que acabou de ser paga nesta mesa, pra poder ser estornada.
   *
   * Só a do caixa que ainda está aberto: depois que o caixa é conferido, o
   * valor já foi dado como certo e o estorno não é mais assunto desta tela.
   * E só quando a mesa está livre — com outra conta rolando, reabrir a
   * anterior misturaria o consumo das duas.
   */
  let ultimaFechada: Comanda | null = null;
  if (!comanda && caixa) {
    const { data } = await supabase
      .from("comandas")
      .select("*, pagamentos(*)")
      .eq("mesa_id", mesaId)
      .eq("status", "FECHADA")
      .eq("caixa_id", caixa.id)
      .order("fechada_em", { ascending: false })
      .limit(1)
      .maybeSingle();
    ultimaFechada = (data ?? null) as Comanda | null;
  }

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
      ultimaFechada={ultimaFechada}
      ehDono={perfil?.papel === "dono"}
      caixaAberto={Boolean(caixa)}
      impressoes={impressoes}
    />
  );
}
