import { criarClienteServidor } from "@/lib/supabase/server";
import { usuarioAtual } from "@/lib/supabase/sessao";
import { ListaPedidos } from "./ListaPedidos";
import { fimIso, inicioIso, lerPeriodo } from "@/lib/periodo";
import type { Pedido } from "@/lib/tipos";

export const revalidate = 0;

export default async function PaginaPedidos({ searchParams }: PageProps<"/pedidos">) {
  const { p, de, ate } = await searchParams;
  // Padrão de 7 dias: é o que o balcão consulta — "o pedido de ontem", "o de
  // sábado". Mês fechado e comparação são assunto do relatório.
  const periodo = lerPeriodo({ p, de, ate }, "7");

  const supabase = await criarClienteServidor();
  const user = await usuarioAtual(supabase);

  const [{ data }, { data: perfil }] = await Promise.all([
    supabase
      .from("pedidos")
      // comandas e caixas vêm junto pra tela saber o que ainda dá pra
      // corrigir: conta já paga precisa ser reaberta antes, e caixa
      // conferido não se mexe mais.
      .select(
        "*, mesas(numero), comandas(id, status), caixas(id, status), itens_pedido(*, item_adicionais(*))",
      )
      .gte("criado_em", inicioIso(periodo.de))
      .lt("criado_em", fimIso(periodo.ate))
      .order("criado_em", { ascending: false }),
    supabase.from("perfis").select("papel").eq("id", user!.id).single(),
  ]);

  return (
    <ListaPedidos
      pedidos={(data ?? []) as Pedido[]}
      periodo={periodo}
      ehDono={perfil?.papel === "dono"}
    />
  );
}
