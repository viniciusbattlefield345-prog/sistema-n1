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
      descricao="As seções do cardápio da mesa e as abas do PDV. A ordem define a sequência; categoria desativada some do cardápio junto com os produtos dela."
      campos={[
        { chave: "nome", rotulo: "Nome", tipo: "texto", largura: "16rem", placeholder: "Pizzas" },
        { chave: "descricao", rotulo: "Detalhe", tipo: "texto", largura: "14rem", placeholder: "De 8 fatias" },
        { chave: "ordem", rotulo: "Ordem", tipo: "inteiro", largura: "7rem", placeholder: "1" },
        {
          chave: "vai_pra_cozinha",
          rotulo: "Vai pra cozinha",
          tipo: "sim_nao",
          largura: "11rem",
          padrao: "true",
          ajuda: "Bebida e picolé: Não. Não sai comanda na chapa.",
        },
        {
          chave: "meio_a_meio",
          rotulo: "Meia a meia",
          tipo: "sim_nao",
          largura: "10rem",
          padrao: "false",
          ajuda: "Pizza: Sim. Vale o sabor mais caro.",
        },
      ]}
      linhas={(data ?? []) as unknown as Linha[]}
      textoVazio="Sem categoria, os produtos ficam todos misturados numa seção só."
    />
  );
}
