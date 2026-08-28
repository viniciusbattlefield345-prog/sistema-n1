"use server";

import { revalidatePath } from "next/cache";
import { criarClienteServidor } from "@/lib/supabase/server";
import type { StatusPedido } from "@/lib/tipos";

export type Resultado = { ok: true } | { ok: false; erro: string };

export async function mudarStatus(
  id: number,
  status: StatusPedido,
): Promise<Resultado> {
  const supabase = await criarClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, erro: "Sessão expirada." };

  const { error } = await supabase
    .from("pedidos")
    .update({ status, atualizado_em: new Date().toISOString() })
    .eq("id", id);

  if (error) return { ok: false, erro: error.message };

  revalidatePath("/cozinha");
  revalidatePath("/pedidos");
  return { ok: true };
}
