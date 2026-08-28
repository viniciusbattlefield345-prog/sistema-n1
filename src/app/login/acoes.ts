"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { criarClienteServidor } from "@/lib/supabase/server";

export type EstadoLogin = { erro: string | null };

export async function entrar(
  _anterior: EstadoLogin,
  form: FormData,
): Promise<EstadoLogin> {
  const email = String(form.get("email") ?? "").trim();
  const senha = String(form.get("senha") ?? "");
  const voltar = String(form.get("voltar") ?? "/pdv");

  if (!email || !senha) {
    return { erro: "Preencha o e-mail e a senha." };
  }

  const supabase = await criarClienteServidor();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: senha,
  });

  if (error) {
    // Nao diz qual dos dois errou: isso entregaria quais e-mails existem.
    return { erro: "E-mail ou senha incorretos." };
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
