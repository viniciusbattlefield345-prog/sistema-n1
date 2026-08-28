"use server";

import { revalidatePath } from "next/cache";
import { criarClienteServidor } from "@/lib/supabase/server";

export type ResultadoCaixa = { ok: true } | { ok: false; erro: string };

export async function abrirCaixa(valorAbertura: number): Promise<ResultadoCaixa> {
  const supabase = await criarClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, erro: "Sessão expirada." };

  const { error } = await supabase.from("caixas").insert({
    usuario_id: user.id,
    valor_abertura: valorAbertura,
  });

  if (error) {
    // O índice caixa_unico_aberto impede dois caixas abertos ao mesmo tempo.
    if (error.code === "23505")
      return { ok: false, erro: "Já existe um caixa aberto. Feche ele antes." };
    return { ok: false, erro: error.message };
  }

  revalidatePath("/caixa");
  revalidatePath("/pdv");
  return { ok: true };
}

export async function fecharCaixa(
  id: number,
  valorContado: number,
  observacao: string,
): Promise<ResultadoCaixa> {
  const supabase = await criarClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, erro: "Sessão expirada." };

  // Pedido em aberto some da cozinha quando o caixa fecha: melhor barrar.
  const { count } = await supabase
    .from("pedidos")
    .select("id", { count: "exact", head: true })
    .eq("caixa_id", id)
    .not("status", "in", '("CONCLUIDO","CANCELADO")');

  if ((count ?? 0) > 0)
    return {
      ok: false,
      erro: `Ainda há ${count} pedido(s) em andamento. Conclua ou cancele antes de fechar.`,
    };

  const { error } = await supabase
    .from("caixas")
    .update({
      status: "FECHADO",
      fechado_em: new Date().toISOString(),
      valor_fechamento: valorContado,
      observacao: observacao.trim() || null,
    })
    .eq("id", id);

  if (error) return { ok: false, erro: error.message };

  revalidatePath("/caixa");
  revalidatePath("/pdv");
  return { ok: true };
}
