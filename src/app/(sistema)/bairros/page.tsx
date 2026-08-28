import { criarClienteServidor } from "@/lib/supabase/server";
import { Cadastro, type Linha } from "@/components/Cadastro";

export default async function PaginaBairros() {
  const supabase = await criarClienteServidor();
  const { data } = await supabase.from("bairros").select("*").order("nome");

  return (
    <Cadastro
      tabela="bairros"
      fita="Entrega"
      titulo="Bairros e taxas"
      descricao="A taxa do bairro do cliente entra sozinha no pedido de entrega — a atendente não precisa lembrar de somar."
      campos={[
        { chave: "nome", rotulo: "Bairro", tipo: "texto", largura: "18rem", placeholder: "Centro" },
        { chave: "taxa", rotulo: "Taxa de entrega", tipo: "dinheiro", largura: "10rem", placeholder: "5,00" },
      ]}
      linhas={(data ?? []) as unknown as Linha[]}
      textoVazio="Cadastre os bairros que vocês atendem e quanto cobram por cada um."
    />
  );
}
