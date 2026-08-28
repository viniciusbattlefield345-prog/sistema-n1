"use server";

import { revalidatePath } from "next/cache";
import { criarClienteServidor } from "@/lib/supabase/server";
import { usuarioParaEmail } from "@/lib/auth";
import type { Papel } from "@/lib/tipos";

export type Resultado = { ok: true } | { ok: false; erro: string };

type Contexto =
  | { autorizado: false; erro: string }
  | {
      autorizado: true;
      supabase: Awaited<ReturnType<typeof criarClienteServidor>>;
      user: { id: string };
    };

/** Só o dono mexe em acessos. */
async function exigirDono(): Promise<Contexto> {
  const supabase = await criarClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { autorizado: false, erro: "Sessão expirada." };

  const { data: perfil } = await supabase
    .from("perfis")
    .select("papel")
    .eq("id", user.id)
    .single();

  if (perfil?.papel !== "dono")
    return { autorizado: false, erro: "Só o dono pode mexer nos acessos." };

  return { autorizado: true, supabase, user };
}

export async function mudarPapel(id: string, papel: Papel): Promise<Resultado> {
  const ctx = await exigirDono();
  if (!ctx.autorizado) return { ok: false, erro: ctx.erro };

  if (id === ctx.user.id && papel !== "dono")
    return { ok: false, erro: "Você não pode tirar o próprio acesso de dono." };

  const { error } = await ctx.supabase.from("perfis").update({ papel }).eq("id", id);
  if (error) return { ok: false, erro: error.message };

  revalidatePath("/acessos");
  return { ok: true };
}

export async function alternarAtivo(id: string, ativo: boolean): Promise<Resultado> {
  const ctx = await exigirDono();
  if (!ctx.autorizado) return { ok: false, erro: ctx.erro };

  if (id === ctx.user.id && !ativo)
    return { ok: false, erro: "Você não pode desativar a si mesmo." };

  const { error } = await ctx.supabase.from("perfis").update({ ativo }).eq("id", id);
  if (error) return { ok: false, erro: error.message };

  revalidatePath("/acessos");
  return { ok: true };
}

/** Criar usuário exige a chave de serviço, que só existe no servidor. */
export async function criarUsuario(
  usuario: string,
  senha: string,
  nome: string,
  papel: Papel,
): Promise<Resultado> {
  const ctx = await exigirDono();
  if (!ctx.autorizado) return { ok: false, erro: ctx.erro };

  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!chave || !url)
    return {
      ok: false,
      erro:
        "Falta a chave de serviço no servidor (SUPABASE_SERVICE_ROLE_KEY). Enquanto isso, crie o usuário pelo painel do Supabase.",
    };

  if (!usuario.trim()) return { ok: false, erro: "Informe o usuário." };
  if (senha.length < 3) return { ok: false, erro: "A senha é curta demais." };

  const resposta = await fetch(`${url}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: chave,
      Authorization: `Bearer ${chave}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: usuarioParaEmail(usuario),
      password: senha,
      email_confirm: true,
      user_metadata: { nome: nome.trim() || usuario.trim() },
    }),
  });

  if (!resposta.ok) {
    const corpo = await resposta.json().catch(() => ({}));
    const msg = String(corpo?.msg ?? corpo?.message ?? "");
    if (msg.toLowerCase().includes("already"))
      return { ok: false, erro: "Já existe um usuário com esse nome." };
    return { ok: false, erro: msg || "Não consegui criar o usuário." };
  }

  const criado = await resposta.json();
  if (papel !== "atendente") {
    await ctx.supabase.from("perfis").update({ papel }).eq("id", criado.id);
  }

  revalidatePath("/acessos");
  return { ok: true };
}
