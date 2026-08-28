import { redirect } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/server";
import { Cabecalho } from "@/components/Cabecalho";
import { PainelRestaurante } from "./PainelRestaurante";
import { PainelImpressoras } from "./PainelImpressoras";
import type { ConfigImpressoras, ConfigRestaurante } from "@/lib/tipos";

const IMPRESSORAS_PADRAO: ConfigImpressoras = {
  cozinha: "TANCA TP-650",
  entrega: "TANCA TP-650",
  colunas: 48,
  cortar: true,
  abrir_gaveta: false,
  vias_cozinha: 1,
  vias_entrega: 1,
};

const RESTAURANTE_PADRAO: ConfigRestaurante = {
  nome: "RESTAURANTE E CHOPERIA",
  slogan: "",
  endereco: "",
  telefone: "",
  whatsapp: "",
  instagram: "",
  horario: "",
};

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

  if (perfil?.papel !== "dono") redirect("/pdv");

  const { data: configs } = await supabase.from("configuracoes").select("chave, valor");
  const mapa = new Map((configs ?? []).map((c) => [c.chave, c.valor]));

  const restaurante = {
    ...RESTAURANTE_PADRAO,
    ...((mapa.get("restaurante") ?? {}) as Partial<ConfigRestaurante>),
  };
  const impressoras = {
    ...IMPRESSORAS_PADRAO,
    ...((mapa.get("impressoras") ?? {}) as Partial<ConfigImpressoras>),
  };

  return (
    <div className="p-4 lg:p-8">
      <Cabecalho
        fita="Gerência"
        titulo="Configurações"
        descricao="Só o dono vê esta tela."
      />
      <div className="space-y-6">
        <PainelImpressoras inicial={impressoras} restaurante={restaurante} />
        <PainelRestaurante inicial={restaurante} />
      </div>
    </div>
  );
}
