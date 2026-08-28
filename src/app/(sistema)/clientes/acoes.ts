"use server";

import { revalidatePath } from "next/cache";
import { criarClienteServidor } from "@/lib/supabase/server";

export interface DadosCliente {
  id?: number;
  nome: string;
  telefone: string;
  endereco: string;
  numero: string;
  bairro_id: number | null;
  referencia: string;
  observacao: string;
}

export type ResultadoCliente =
  | { ok: true; id: number }
  | { ok: false; erro: string };

/** Só os dígitos: o telefone é a chave que evita cliente duplicado. */
const soDigitos = (t: string) => t.replace(/\D/g, "");

export async function salvarCliente(
  dados: DadosCliente,
): Promise<ResultadoCliente> {
  const supabase = await criarClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, erro: "Sessão expirada. Entre de novo." };

  const nome = dados.nome.trim();
  if (!nome) return { ok: false, erro: "O cliente precisa de nome." };

  const telefone = soDigitos(dados.telefone);
  if (telefone && telefone.length < 10)
    return { ok: false, erro: "Telefone incompleto — faltou o DDD?" };

  const linha = {
    nome,
    telefone: telefone || null,
    endereco: dados.endereco.trim() || null,
    numero: dados.numero.trim() || null,
    bairro_id: dados.bairro_id,
    referencia: dados.referencia.trim() || null,
    observacao: dados.observacao.trim() || null,
  };

  const resposta = dados.id
    ? await supabase.from("clientes").update(linha).eq("id", dados.id).select("id").single()
    : await supabase.from("clientes").insert(linha).select("id").single();

  if (resposta.error) {
    if (resposta.error.code === "23505")
      return { ok: false, erro: "Já existe um cliente com esse telefone." };
    return { ok: false, erro: resposta.error.message };
  }

  revalidatePath("/clientes");
  revalidatePath("/pdv");
  return { ok: true, id: resposta.data.id };
}

export async function excluirCliente(id: number): Promise<ResultadoCliente> {
  const supabase = await criarClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, erro: "Sessão expirada." };

  // Cliente com pedido no histórico não some: o pedido perderia o dono.
  const { count } = await supabase
    .from("pedidos")
    .select("id", { count: "exact", head: true })
    .eq("cliente_id", id);

  if ((count ?? 0) > 0)
    return {
      ok: false,
      erro: `Este cliente tem ${count} pedido(s) no histórico e não pode ser excluído.`,
    };

  const { error } = await supabase.from("clientes").delete().eq("id", id);
  if (error) return { ok: false, erro: error.message };

  revalidatePath("/clientes");
  revalidatePath("/pdv");
  return { ok: true, id };
}
