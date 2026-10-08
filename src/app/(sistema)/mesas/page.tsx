import { criarClienteServidor } from "@/lib/supabase/server";
import { PainelMesas, type MesaNoSalao } from "./PainelMesas";
import type { Pedido } from "@/lib/tipos";

export const revalidate = 0;

export default async function PaginaMesas() {
  const supabase = await criarClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const umMinutoAtras = new Date(Date.now() - 60_000).toISOString();
  const seisHorasAtras = new Date(Date.now() - 6 * 3600_000).toISOString();

  const [
    { data: mesas },
    { data: comandas },
    { data: aguardando },
    { data: caixa },
    { data: perfil },
    { count: atrasados },
    { count: falhas },
  ] = await Promise.all([
    supabase.from("mesas").select("id, numero").eq("ativo", true).order("numero"),
    supabase.from("comandas").select("id, mesa_id, total, aberta_em").eq("status", "ABERTA"),
    // Só pedido de mesa: o que vem pelo link de delivery tem tela própria.
    supabase
      .from("pedidos")
      .select("*, mesas(numero), itens_pedido(*, item_adicionais(*))")
      .eq("status", "AGUARDANDO")
      .eq("tipo", "MESA")
      .order("criado_em"),
    supabase.from("caixas").select("id").eq("status", "ABERTO").maybeSingle(),
    supabase.from("perfis").select("papel").eq("id", user!.id).single(),
    supabase
      .from("fila_impressao")
      .select("id", { count: "exact", head: true })
      .eq("status", "PENDENTE")
      .lt("criado_em", umMinutoAtras),
    supabase
      .from("fila_impressao")
      .select("id", { count: "exact", head: true })
      .eq("status", "ERRO")
      .gte("criado_em", seisHorasAtras),
  ]);

  const pedidosAguardando = (aguardando ?? []) as Pedido[];
  const contaPorMesa = new Map((comandas ?? []).map((c) => [c.mesa_id, c]));

  const salao: MesaNoSalao[] = (mesas ?? []).map((m) => {
    const conta = contaPorMesa.get(m.id);
    return {
      id: m.id,
      numero: m.numero,
      comanda: conta
        ? { id: conta.id, total: Number(conta.total), aberta_em: conta.aberta_em }
        : null,
      aguardando: pedidosAguardando.filter((p) => p.mesa_id === m.id).length,
    };
  });

  return (
    <PainelMesas
      mesas={salao}
      aguardando={pedidosAguardando}
      caixaAberto={Boolean(caixa)}
      ehDono={perfil?.papel === "dono"}
      impressaoAtrasada={atrasados ?? 0}
      falhasImpressao={falhas ?? 0}
    />
  );
}
