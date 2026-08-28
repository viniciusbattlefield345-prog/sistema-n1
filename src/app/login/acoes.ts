"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { criarClienteServidor } from "@/lib/supabase/server";
import { usuarioParaEmail } from "@/lib/auth";

export type EstadoLogin = { erro: string | null };

export async function entrar(
  _anterior: EstadoLogin,
  form: FormData,
): Promise<EstadoLogin> {
  const usuario = String(form.get("usuario") ?? "").trim();
  const senha = String(form.get("senha") ?? "");
  const voltar = String(form.get("voltar") ?? "/pdv");

  if (!usuario || !senha) {
    return { erro: "Preencha o usuário e a senha." };
  }

  // "arinete" vira "arinete@n1restaurante.com"; e-mail completo passa direto
  const email = usuarioParaEmail(usuario);

  const supabase = await criarClienteServidor();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: senha,
  });

  if (error) {
    // Nao diz qual dos dois errou: isso entregaria quais contas existem.
    return { erro: "Usuário ou senha incorretos." };
  }

  revalidatePath("/", "layout");
  redirect(voltar.startsWith("/") ? voltar : "/pdv");
}

export async function sair() {
  const supabase = await criarClienteServidor();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
