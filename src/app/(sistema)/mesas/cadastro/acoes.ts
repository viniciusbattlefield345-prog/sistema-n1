"use server";

import { revalidatePath } from "next/cache";
import { criarClienteServidor } from "@/lib/supabase/server";
import { usuarioAtual } from "@/lib/supabase/sessao";

export type Resultado = { ok: true } | { ok: false; erro: string };

const LETRAS = "abcdefghjkmnpqrstuvwxyz23456789"; // sem 0/o, 1/l/i: ninguém confunde ao digitar

function novoCodigo() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return [...bytes].map((b) => LETRAS[b % LETRAS.length]).join("");
}

type Contexto =
  | { autorizado: false; erro: string }
  | { autorizado: true; supabase: Awaited<ReturnType<typeof criarClienteServidor>> };

async function exigirDono(): Promise<Contexto> {
  const supabase = await criarClienteServidor();
  const user = await usuarioAtual(supabase);
  if (!user) return { autorizado: false, erro: "Sessão expirada." };

  const { data: perfil } = await supabase
    .from("perfis")
    .select("papel")
    .eq("id", user.id)
    .single();
  if (perfil?.papel !== "dono") return { autorizado: false, erro: "Só o dono mexe nas mesas." };

  return { autorizado: true, supabase };
}

function atualizar() {
  revalidatePath("/mesas");
  revalidatePath("/mesas/cadastro");
  revalidatePath("/mesas/qr");
}

export async function criarMesa(numero: number): Promise<Resultado> {
  const ctx = await exigirDono();
  if (!ctx.autorizado) return { ok: false, erro: ctx.erro };

  const n = Math.trunc(Number(numero));
  if (!(n >= 1 && n <= 999)) return { ok: false, erro: "Número de mesa inválido." };

  const { error } = await ctx.supabase.from("mesas").insert({ numero: n, codigo: novoCodigo() });
  if (error) {
    if (error.code === "23505") return { ok: false, erro: `A mesa ${n} já existe.` };
    return { ok: false, erro: error.message };
  }
  atualizar();
  return { ok: true };
}

export async function alternarMesa(id: number, ativo: boolean): Promise<Resultado> {
  const ctx = await exigirDono();
  if (!ctx.autorizado) return { ok: false, erro: ctx.erro };

  const { error } = await ctx.supabase.from("mesas").update({ ativo }).eq("id", id);
  if (error) return { ok: false, erro: error.message };
  atualizar();
  return { ok: true };
}

/** Trocar o código invalida o QR impresso daquela mesa — use se alguém fotografou e anda mandando trote. */
export async function trocarCodigo(id: number): Promise<Resultado> {
  const ctx = await exigirDono();
  if (!ctx.autorizado) return { ok: false, erro: ctx.erro };

  const { error } = await ctx.supabase.from("mesas").update({ codigo: novoCodigo() }).eq("id", id);
  if (error) return { ok: false, erro: error.message };
  atualizar();
  return { ok: true };
}

export async function excluirMesa(id: number): Promise<Resultado> {
  const ctx = await exigirDono();
  if (!ctx.autorizado) return { ok: false, erro: ctx.erro };

  const { error } = await ctx.supabase.from("mesas").delete().eq("id", id);
  if (error) {
    if (error.code === "23503")
      return { ok: false, erro: "Essa mesa já teve conta registrada. Desative em vez de excluir." };
    return { ok: false, erro: error.message };
  }
  atualizar();
  return { ok: true };
}
