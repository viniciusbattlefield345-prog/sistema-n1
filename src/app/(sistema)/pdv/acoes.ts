"use server";

import { criarClienteServidor } from "@/lib/supabase/server";
import { usuarioAtual } from "@/lib/supabase/sessao";
import { revalidatePath } from "next/cache";
import {
  contaDaMesa,
  gravarPedido,
  mandarImprimir,
  montarItens,
  type ItemEnviado,
} from "@/lib/pedido-servidor";
import type { FormaPagamento, TipoPedido } from "@/lib/tipos";

export type { ItemEnviado };

export interface PedidoEnviado {
  caixa_id: number;
  tipo: TipoPedido;
  mesa_id: number | null;
  cliente_id: number | null;
  cliente_nome: string;
  cliente_telefone: string | null;
  endereco_entrega: string | null;
  bairro_id: number | null;
  forma_pagamento: FormaPagamento;
  troco_para: number | null;
  desconto: number;
  observacao: string | null;
  itens: ItemEnviado[];
}

export type Resultado =
  | { ok: true; pedido_id: number; numero_dia: number | null; mesa_id: number | null }
  | { ok: false; erro: string };

/**
 * Pedido lançado pela equipe. Não passa por aprovação: já nasce na fila da
 * cozinha e vai direto pra impressora do balcão. Pedido de mesa entra na
 * conta aberta dela (e abre uma, se a mesa estava livre).
 */
export async function salvarPedido(dados: PedidoEnviado): Promise<Resultado> {
  const supabase = await criarClienteServidor();

  const user = await usuarioAtual(supabase);
  if (!user) return { ok: false, erro: "Sessão expirada. Entre de novo." };

  const ehMesa = dados.tipo === "MESA";

  if (!ehMesa && !dados.cliente_nome.trim())
    return { ok: false, erro: "Informe o nome do cliente." };

  if (dados.tipo === "ENTREGA" && !dados.endereco_entrega?.trim())
    return { ok: false, erro: "Entrega precisa de endereço." };

  // ---- Preços vêm SEMPRE do banco, nunca do navegador ----------------
  const montagem = await montarItens(supabase, dados.itens, false);
  if (!montagem.ok) return montagem;

  // ---- Mesa: entra na conta aberta ----------------------------------
  let comanda: { id: number; nova: boolean } | null = null;
  let nomeMesa = "";
  if (ehMesa) {
    if (!dados.mesa_id) return { ok: false, erro: "Escolha a mesa." };
    const { data: mesa } = await supabase
      .from("mesas")
      .select("id, numero, ativo")
      .eq("id", dados.mesa_id)
      .maybeSingle();
    if (!mesa || !mesa.ativo) return { ok: false, erro: "Essa mesa não está ativa." };

    const conta = await contaDaMesa(supabase, mesa.id, dados.caixa_id);
    if (!conta.ok) return conta;
    comanda = { id: conta.id, nova: conta.nova };
    nomeMesa = `Mesa ${mesa.numero}`;
  }

  // ---- Taxa de entrega: também do banco ------------------------------
  let taxa = 0;
  if (dados.tipo === "ENTREGA" && dados.bairro_id) {
    const { data: bairro } = await supabase
      .from("bairros")
      .select("taxa")
      .eq("id", dados.bairro_id)
      .maybeSingle();
    taxa = Number(bairro?.taxa ?? 0);
  }

  const agora = new Date().toISOString();
  const resultado = await gravarPedido(
    supabase,
    {
      caixa_id: dados.caixa_id,
      usuario_id: user.id,
      origem: "EQUIPE",
      tipo: dados.tipo,
      mesa_id: ehMesa ? dados.mesa_id : null,
      comanda_id: comanda?.id ?? null,
      cliente_id: dados.tipo === "ENTREGA" ? dados.cliente_id : null,
      cliente_nome: dados.cliente_nome.trim() || nomeMesa,
      cliente_telefone: ehMesa ? null : dados.cliente_telefone,
      endereco_entrega:
        dados.tipo === "ENTREGA"
          ? dados.endereco_entrega
          : dados.tipo === "RETIRADA"
            ? "RETIRADA NO BALCÃO"
            : null,
      taxa_entrega: taxa,
      desconto: dados.desconto,
      forma_pagamento: ehMesa ? null : dados.forma_pagamento,
      troco_para: !ehMesa && dados.forma_pagamento === "Dinheiro" ? dados.troco_para : null,
      status: "PENDENTE",
      aprovado_por: user.id,
      aprovado_em: agora,
      observacao: dados.observacao,
    },
    montagem.itens,
  );

  if (!resultado.ok) {
    if (comanda?.nova) {
      await supabase.from("comandas").update({ status: "CANCELADA" }).eq("id", comanda.id);
    }
    return resultado;
  }

  await mandarImprimir(supabase, { tipo: "PEDIDO", pedido_id: resultado.id }, user.id);

  for (const tela of ["/cozinha", "/pedidos", "/mesas", "/entregas", "/impressao"])
    revalidatePath(tela);
  return {
    ok: true,
    pedido_id: resultado.id,
    numero_dia: resultado.numero_dia,
    mesa_id: ehMesa ? dados.mesa_id : null,
  };
}

/** Cadastro rapido de cliente, direto do PDV. */
export async function salvarCliente(dados: {
  nome: string;
  telefone: string;
  endereco: string;
  numero: string;
  bairro_id: number | null;
  referencia: string;
}) {
  const supabase = await criarClienteServidor();
  const user = await usuarioAtual(supabase);
  if (!user) return { ok: false as const, erro: "Sessão expirada." };

  if (!dados.nome.trim())
    return { ok: false as const, erro: "O cliente precisa de nome." };

  const telefone = dados.telefone.replace(/\D/g, "") || null;

  const { data, error } = await supabase
    .from("clientes")
    .insert({
      nome: dados.nome.trim(),
      telefone,
      endereco: dados.endereco.trim() || null,
      numero: dados.numero.trim() || null,
      bairro_id: dados.bairro_id,
      referencia: dados.referencia.trim() || null,
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505")
      return { ok: false as const, erro: "Já existe cliente com esse telefone." };
    return { ok: false as const, erro: error.message };
  }

  revalidatePath("/pdv");
  return { ok: true as const, cliente: data };
}
