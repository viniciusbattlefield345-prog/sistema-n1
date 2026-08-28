import { criarClienteServidor } from "@/lib/supabase/server";
import { ListaProdutos } from "./ListaProdutos";
import type { Adicional, Categoria, Produto } from "@/lib/tipos";

export default async function PaginaCardapio() {
  const supabase = await criarClienteServidor();

  const [{ data: produtos }, { data: categorias }, { data: adicionais }] =
    await Promise.all([
      supabase
        .from("produtos")
        .select("*, produto_variacoes(*), produto_adicionais(adicional_id, preco)")
        .order("ordem")
        .order("nome"),
      supabase.from("categorias").select("*").order("ordem").order("nome"),
      supabase
        .from("adicionais")
        .select("*")
        .eq("ativo", true)
        .order("grupo")
        .order("ordem"),
    ]);

  return (
    <ListaProdutos
      produtos={(produtos ?? []) as Produto[]}
      categorias={(categorias ?? []) as Categoria[]}
      adicionais={(adicionais ?? []) as Adicional[]}
    />
  );
}
