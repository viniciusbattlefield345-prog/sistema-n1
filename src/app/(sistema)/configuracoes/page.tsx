import { redirect } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/server";
import { usuarioAtual } from "@/lib/supabase/sessao";
import { Cabecalho } from "@/components/Cabecalho";
import { lerConfiguracoes } from "@/lib/configuracoes";
import { PainelRestaurante } from "./PainelRestaurante";
import { PainelImpressoras } from "./PainelImpressoras";
import { PainelZerar } from "./PainelZerar";

export const revalidate = 0;

/** Quantas linhas existem numa tabela, sem trazer as linhas. */
async function contar(
  supabase: Awaited<ReturnType<typeof criarClienteServidor>>,
  tabela: string,
) {
  const { count } = await supabase.from(tabela).select("id", { count: "exact", head: true });
  return count ?? 0;
}

export default async function PaginaConfiguracoes() {
  const supabase = await criarClienteServidor();
  const user = await usuarioAtual(supabase);

  const { data: perfil } = await supabase
    .from("perfis")
    .select("papel")
    .eq("id", user!.id)
    .single();

  if (perfil?.papel !== "dono") redirect("/mesas");

  const { data: configs } = await supabase.from("configuracoes").select("chave, valor");
  const { restaurante, impressoras } = lerConfiguracoes(configs);

  const [pedidos, itens, comandas, pagamentos, caixas, produtos, clientes, mesas] =
    await Promise.all([
      contar(supabase, "pedidos"),
      contar(supabase, "itens_pedido"),
      contar(supabase, "comandas"),
      contar(supabase, "pagamentos"),
      contar(supabase, "caixas"),
      contar(supabase, "produtos"),
      contar(supabase, "clientes"),
      contar(supabase, "mesas"),
    ]);

  return (
    <div className="p-4 lg:p-8">
      <Cabecalho
        fita="Gerência"
        titulo="Configurações"
        descricao="Só o dono vê esta tela."
      />
      <div className="space-y-6">
        <PainelRestaurante inicial={restaurante} />
        <PainelImpressoras inicial={impressoras} restaurante={restaurante} />
        <PainelZerar
          contagem={{ pedidos, itens, comandas, pagamentos, caixas, produtos, clientes, mesas }}
        />
      </div>
    </div>
  );
}
