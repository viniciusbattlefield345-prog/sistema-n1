import { criarClienteServidor } from "@/lib/supabase/server";
import { lerConfiguracoes } from "@/lib/configuracoes";
import { EstacaoImpressao } from "./EstacaoImpressao";

export const revalidate = 0;

export default async function PaginaImpressao() {
  const supabase = await criarClienteServidor();
  const { data: configs } = await supabase.from("configuracoes").select("chave, valor");
  const { restaurante, impressoras } = lerConfiguracoes(configs);

  return <EstacaoImpressao restaurante={restaurante} inicial={impressoras} />;
}
