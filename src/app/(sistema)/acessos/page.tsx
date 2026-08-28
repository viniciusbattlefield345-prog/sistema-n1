import { redirect } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/server";
import { ListaAcessos, type LinhaAcesso } from "./ListaAcessos";
import type { Papel } from "@/lib/tipos";

export const revalidate = 0;

/**
 * O e-mail de login mora em auth.users, que a API pública não expõe —
 * e é ela que dá o nome de usuário. Buscamos pela chave de serviço,
 * que só existe no servidor. Sem a chave, a tela funciona mesmo assim,
 * só não mostra o usuário nem cria acesso novo.
 */
async function buscarEmails(): Promise<Map<string, string>> {
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!chave || !url) return new Map();

  try {
    const r = await fetch(`${url}/auth/v1/admin/users?per_page=200`, {
      headers: { apikey: chave, Authorization: `Bearer ${chave}` },
      cache: "no-store",
    });
    if (!r.ok) return new Map();
    const corpo = (await r.json()) as { users?: { id: string; email: string }[] };
    return new Map((corpo.users ?? []).map((u) => [u.id, u.email]));
  } catch {
    return new Map();
  }
}

export default async function PaginaAcessos() {
  const supabase = await criarClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: eu } = await supabase
    .from("perfis")
    .select("papel")
    .eq("id", user!.id)
    .single();

  if (eu?.papel !== "dono") redirect("/pdv");

  const [{ data: perfis }, emails] = await Promise.all([
    supabase.from("perfis").select("id, nome, papel, ativo").order("nome"),
    buscarEmails(),
  ]);

  const pessoas: LinhaAcesso[] = (perfis ?? []).map((p) => ({
    id: p.id as string,
    nome: p.nome as string,
    papel: p.papel as Papel,
    ativo: p.ativo as boolean,
    email: emails.get(p.id as string) ?? "—",
  }));

  return (
    <ListaAcessos
      pessoas={pessoas}
      euId={user!.id}
      podeCriar={Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)}
    />
  );
}
