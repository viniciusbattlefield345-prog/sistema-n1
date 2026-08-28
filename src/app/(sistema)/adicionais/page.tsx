import { criarClienteServidor } from "@/lib/supabase/server";
import { Cadastro, type Linha } from "@/components/Cadastro";

export default async function PaginaAdicionais() {
  const supabase = await criarClienteServidor();
  const { data } = await supabase
    .from("adicionais")
    .select("*")
    .order("grupo")
    .order("ordem")
    .order("nome");

  const grupos = [...new Set((data ?? []).map((a) => a.grupo).filter(Boolean))];

  return (
    <Cadastro
      tabela="adicionais"
      fita="Cardápio"
      titulo="Itens e adicionais"
      descricao="O que entra dentro da marmita. Preço zero é o normal aqui — quem define o valor é o tamanho. Acabou algum? Desative, não exclua."
      campos={[
        { chave: "nome", rotulo: "Nome", tipo: "texto", largura: "16rem", placeholder: "Arroz" },
        { chave: "grupo", rotulo: "Seção", tipo: "lista", largura: "13rem", placeholder: "Acompanhamentos", opcoes: grupos as string[] },
        { chave: "preco", rotulo: "Preço", tipo: "dinheiro", largura: "8rem", placeholder: "0,00" },
        { chave: "ordem", rotulo: "Ordem", tipo: "inteiro", largura: "7rem", placeholder: "1" },
      ]}
      linhas={(data ?? []) as unknown as Linha[]}
      textoVazio="Cadastre o que pode ir dentro da marmita."
    />
  );
}
