import { redirect } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/server";
import { enderecoDoSite } from "@/lib/endereco";
import { CadastroMesas } from "./CadastroMesas";
import type { Mesa } from "@/lib/tipos";

export const revalidate = 0;

export default async function PaginaCadastroMesas() {
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

  const [{ data: mesas }, endereco] = await Promise.all([
    supabase.from("mesas").select("id, numero, codigo, ativo").order("numero"),
    enderecoDoSite(),
  ]);

  return <CadastroMesas mesas={(mesas ?? []) as Mesa[]} endereco={endereco} />;
}
