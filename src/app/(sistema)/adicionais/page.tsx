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
      titulo="Adicionais"
      descricao="O que dá pra acrescentar no lanche: bacon, ovo, cheddar… Quais produtos aceitam cada um se marca no próprio produto, em Cardápio. Acabou algum? Desative, não exclua."
      campos={[
        { chave: "nome", rotulo: "Nome", tipo: "texto", largura: "16rem", placeholder: "Bacon" },
        { chave: "grupo", rotulo: "Seção", tipo: "lista", largura: "13rem", placeholder: "Adicionais", opcoes: grupos as string[] },
        { chave: "preco", rotulo: "Preço", tipo: "dinheiro", largura: "8rem", placeholder: "5,00" },
        { chave: "ordem", rotulo: "Ordem", tipo: "inteiro", largura: "7rem", placeholder: "1" },
      ]}
      linhas={(data ?? []) as unknown as Linha[]}
      textoVazio="Cadastre o que pode ser acrescentado nos lanches."
    />
  );
}
