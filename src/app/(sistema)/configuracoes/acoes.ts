"use server";

import { revalidatePath } from "next/cache";
import { criarClienteServidor } from "@/lib/supabase/server";
import type { ConfigImpressoras, ConfigRestaurante } from "@/lib/tipos";

export type Resultado = { ok: true } | { ok: false; erro: string };

async function gravar(chave: string, valor: unknown): Promise<Resultado> {
  const supabase = await criarClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, erro: "Sessão expirada." };

  const { error } = await supabase
    .from("configuracoes")
    .upsert({ chave, valor }, { onConflict: "chave" });

  if (error) return { ok: false, erro: error.message };

  revalidatePath("/configuracoes");
  revalidatePath("/imprimir", "layout");
  return { ok: true };
}

export async function salvarRestaurante(dados: ConfigRestaurante) {
  return gravar("restaurante", dados);
}

export async function salvarImpressoras(dados: ConfigImpressoras) {
  return gravar("impressoras", dados);
}
