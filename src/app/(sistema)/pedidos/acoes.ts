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

  const { data: pedido } = await supabase
    .from("pedidos")
    .select("id, comandas(status)")
    .eq("id", id)
    .maybeSingle();
  if (!pedido) return { ok: false, erro: "Pedido não encontrado." };

  // Conta paga já entrou no caixa: cancelar agora deixaria o caixa sem bater.
  const conta = pedido.comandas as unknown as { status: string } | null;
  if (conta?.status === "FECHADA")
    return {
      ok: false,
      erro: "A conta dessa mesa já foi fechada e paga — não dá mais pra cancelar o pedido.",
    };

  const { error } = await supabase
    .from("pedidos")
    .update({ status: "CANCELADO", atualizado_em: new Date().toISOString() })
    .eq("id", id);

  if (error) return { ok: false, erro: error.message };

  for (const tela of ["/pedidos", "/cozinha", "/caixa", "/mesas"]) revalidatePath(tela);
  revalidatePath("/mesas/[id]", "page");
  return { ok: true };
}
