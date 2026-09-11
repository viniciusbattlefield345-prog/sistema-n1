import { redirect } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/server";
import { Cabecalho } from "@/components/Cabecalho";
import { lerConfiguracoes } from "@/lib/configuracoes";
import { PainelRestaurante } from "./PainelRestaurante";
import { PainelImpressoras } from "./PainelImpressoras";

export default async function PaginaConfiguracoes() {
  const supabase = await criarClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: perfil } = await supabase
    .from("perfis")
    .select("papel")
    .eq("id", user!.id)
    .single();

  if (perfil?.papel !== "dono") redirect("/mesas");

  const { data: configs } = await supabase.from("configuracoes").select("chave, valor");
  const { restaurante, impressoras } = lerConfiguracoes(configs);

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
      </div>
    </div>
  );
}
