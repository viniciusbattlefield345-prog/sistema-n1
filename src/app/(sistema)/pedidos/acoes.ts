"use server";

import { revalidatePath } from "next/cache";
import { criarClienteServidor } from "@/lib/supabase/server";

export type Resultado = { ok: true } | { ok: false; erro: string };

/** Cancelar não apaga: o pedido some das contas mas fica no histórico. */
export async function cancelarPedido(id: number): Promise<Resultado> {
  const supabase = await criarClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, erro: "Sessão expirada." };

  const { error } = await supabase
    .from("pedidos")
    .update({ status: "CANCELADO", atualizado_em: new Date().toISOString() })
    .eq("id", id);

  if (error) return { ok: false, erro: error.message };

  revalidatePath("/pedidos");
  revalidatePath("/cozinha");
  revalidatePath("/caixa");
  return { ok: true };
}
