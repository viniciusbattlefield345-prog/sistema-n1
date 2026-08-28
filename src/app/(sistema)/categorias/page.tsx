import { criarClienteServidor } from "@/lib/supabase/server";
import { Cadastro, type Linha } from "@/components/Cadastro";

export default async function PaginaCategorias() {
  const supabase = await criarClienteServidor();
  const { data } = await supabase
    .from("categorias")
    .select("*")
    .order("ordem")
    .order("nome");

  return (
    <Cadastro
      tabela="categorias"
      fita="Cardápio"
      titulo="Categorias"
      descricao="As abas que a atendente vê no topo do PDV. A ordem define em que sequência aparecem."
      campos={[
        { chave: "nome", rotulo: "Nome", tipo: "texto", largura: "18rem", placeholder: "Pratos" },
        { chave: "ordem", rotulo: "Ordem", tipo: "inteiro", largura: "7rem", placeholder: "1" },
      ]}
      linhas={(data ?? []) as unknown as Linha[]}
      textoVazio="Sem categoria, os produtos ficam todos misturados numa aba só."
    />
  );
}
