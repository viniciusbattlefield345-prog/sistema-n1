import { criarClienteServidor } from "@/lib/supabase/server";
import { ListaClientes } from "./ListaClientes";
import type { Bairro, Cliente } from "@/lib/tipos";

export default async function PaginaClientes() {
  const supabase = await criarClienteServidor();

  const [{ data: clientes }, { data: bairros }] = await Promise.all([
    supabase.from("clientes").select("*").order("nome"),
    supabase.from("bairros").select("*").eq("ativo", true).order("nome"),
  ]);

  return (
    <ListaClientes
      clientes={(clientes ?? []) as Cliente[]}
      bairros={(bairros ?? []) as Bairro[]}
    />
  );
}
