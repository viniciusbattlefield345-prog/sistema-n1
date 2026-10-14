"use server";

import { clienteServico } from "@/lib/supabase/admin";
import {
  contaDaMesa,
  gravarPedido,
  montarItens,
  type ItemEnviado,
} from "@/lib/pedido-servidor";
import type { StatusPedido } from "@/lib/tipos";
import { MOTIVO_CLIENTE_DESISTIU } from "@/lib/formato";

/**
 * Ações do cardápio da mesa. Quem chama é o celular do cliente, sem login —
 * por isso tudo é conferido aqui: a mesa pelo código do QR, a loja aberta
 * pelo caixa, e cada item e preço relidos do banco.
 */

/** Pedidos da mesma conta esperando aprovação. Acima disso, é trote ou toque repetido. */
const LIMITE_AGUARDANDO = 3;

/**
 * O nome é obrigatório: é por ele que o atendente sabe de quem é o pedido
 * quando a mesa tem mais de uma pessoa. A tela pede antes do cardápio, mas
 * a trava que vale é esta — a de lá se contorna pelo navegador.
 */
const NOME_MINIMO = 2;

export type RespostaEnvio =
  | { ok: true; pedido_id: number; numero_dia: number | null }
  | { ok: false; erro: string };

export async function enviarPedido(
  codigo: string,
  dados: { nome: string; observacao: string; itens: ItemEnviado[] },
): Promise<RespostaEnvio> {
  const sb = clienteServico();

  const { data: mesa } = await sb
    .from("mesas")
    .select("id, numero, ativo")
    .eq("codigo", String(codigo))
    .maybeSingle();
  if (!mesa || !mesa.ativo)
    return { ok: false, erro: "Este QR code não vale mais. Chame o atendente." };

  const { data: caixa } = await sb
    .from("caixas")
    .select("id")
    .eq("status", "ABERTO")
    .maybeSingle();
  if (!caixa)
    return { ok: false, erro: "Estamos fechados agora. Chame o atendente." };

  const nome = String(dados?.nome ?? "").trim().slice(0, 40);
  if (nome.length < NOME_MINIMO)
    return { ok: false, erro: "Diga seu nome pra eu mandar o pedido pra cozinha." };

  const montagem = await montarItens(sb, dados?.itens ?? [], true);
  if (!montagem.ok) return montagem;

  const conta = await contaDaMesa(sb, mesa.id, caixa.id);
  if (!conta.ok) return conta;

  const { count } = await sb
    .from("pedidos")
    .select("id", { count: "exact", head: true })
    .eq("comanda_id", conta.id)
    .eq("status", "AGUARDANDO");
  if ((count ?? 0) >= LIMITE_AGUARDANDO)
    return {
      ok: false,
      erro: "Seus pedidos anteriores ainda estão esperando o atendente confirmar. Aguarde um instante.",
    };

  const resultado = await gravarPedido(
    sb,
    {
      caixa_id: caixa.id,
      usuario_id: null,
      origem: "CLIENTE",
      tipo: "MESA",
      mesa_id: mesa.id,
      comanda_id: conta.id,
      cliente_id: null,
      cliente_nome: nome,
      cliente_telefone: null,
      endereco_entrega: null,
      taxa_entrega: 0,
      desconto: 0,
      forma_pagamento: null,
      troco_para: null,
      status: "AGUARDANDO",
      aprovado_por: null,
      aprovado_em: null,
      observacao: String(dados?.observacao ?? "").trim().slice(0, 200) || null,
    },
    montagem.itens,
  );

  if (!resultado.ok) {
    // A conta nasceu só pra este pedido, que não entrou: não deixa a mesa
    // aparecendo como ocupada com R$ 0,00.
    if (conta.nova) {
      await sb.from("comandas").update({ status: "CANCELADA" }).eq("id", conta.id);
    }
    return resultado;
  }

  return { ok: true, pedido_id: resultado.id, numero_dia: resultado.numero_dia };
}

export interface SituacaoPedido {
  id: number;
  numero_dia: number | null;
  status: StatusPedido;
  total: number;
  motivo_recusa: string | null;
  criado_em: string;
  itens: { nome: string; quantidade: number }[];
}

/**
 * Andamento dos pedidos que ESTE celular fez (os ids ficam guardados nele).
 * Só devolve pedido da mesma mesa e das últimas 12 horas.
 */
export async function consultarPedidos(
  codigo: string,
  ids: number[],
): Promise<SituacaoPedido[]> {
  const limpos = [
    ...new Set((Array.isArray(ids) ? ids : []).map(Number).filter(Number.isInteger)),
  ].slice(0, 30);
  if (limpos.length === 0) return [];

  const sb = clienteServico();
  const { data: mesa } = await sb
    .from("mesas")
    .select("id")
    .eq("codigo", String(codigo))
    .maybeSingle();
  if (!mesa) return [];

  const desde = new Date(Date.now() - 12 * 3600_000).toISOString();
  const { data } = await sb
    .from("pedidos")
    .select("id, numero_dia, status, total, motivo_recusa, criado_em, itens_pedido(produto_nome, quantidade)")
    .eq("mesa_id", mesa.id)
    .in("id", limpos)
    .gte("criado_em", desde)
    .order("criado_em", { ascending: false });

  return (data ?? []).map((p) => ({
    id: p.id,
    numero_dia: p.numero_dia,
    status: p.status as StatusPedido,
    total: Number(p.total),
    motivo_recusa: p.motivo_recusa,
    criado_em: p.criado_em,
    itens: ((p.itens_pedido ?? []) as { produto_nome: string; quantidade: number }[]).map(
      (i) => ({ nome: i.produto_nome, quantidade: Number(i.quantidade) }),
    ),
  }));
}


// =====================================================================
// DESISTIR DO PEDIDO
// =====================================================================

/**
 * Conta que ficou sem nenhum pedido válido não deixa a mesa marcada como
 * ocupada. Mesmo cuidado que a recusa do atendente tem — só que aqui não há
 * usuário logado pra assinar o fechamento.
 */
async function liberarContaVazia(sb: ReturnType<typeof clienteServico>, comandaId: number) {
  const { count } = await sb
    .from("pedidos")
    .select("id", { count: "exact", head: true })
    .eq("comanda_id", comandaId)
    .neq("status", "CANCELADO");

  if ((count ?? 0) === 0) {
    await sb
      .from("comandas")
      .update({ status: "CANCELADA", fechada_em: new Date().toISOString() })
      .eq("id", comandaId)
      .eq("status", "ABERTA");
  }
}

/**
 * O cliente desiste do pedido que acabou de mandar.
 *
 * Existe porque escolher errado é normal: toca no produto parecido, manda, e
 * dois segundos depois percebe. Antes disto a única saída era chamar alguém
 * pra recusar o pedido inteiro, e ninguém é obrigado a levar o que não
 * escolheu.
 *
 * Só vale enquanto ninguém da equipe olhou o pedido (AGUARDANDO). Depois de
 * aprovado o papel já saiu e a cozinha está com ele na mão: aí quem desfaz é
 * o atendente, com o pedido na frente.
 *
 * O id sozinho não autoriza nada — o celular é de quem estiver com ele. Tem
 * que ser pedido DESTA mesa e das últimas 12 horas, as mesmas travas do
 * consultarPedidos, e a troca de status só acontece se ele ainda estiver
 * AGUARDANDO. Dois toques ao mesmo tempo, ou o atendente aprovando no mesmo
 * segundo, não viram cancelamento de pedido já confirmado.
 */
export async function cancelarMeuPedido(
  codigo: string,
  pedidoId: number,
): Promise<{ ok: true } | { ok: false; erro: string }> {
  const id = Number(pedidoId);
  if (!Number.isInteger(id)) return { ok: false, erro: "Pedido inválido." };

  const sb = clienteServico();
  const { data: mesa } = await sb
    .from("mesas")
    .select("id")
    .eq("codigo", String(codigo))
    .maybeSingle();
  if (!mesa) return { ok: false, erro: "Este QR code não vale mais. Chame o atendente." };

  const desde = new Date(Date.now() - 12 * 3600_000).toISOString();
  const { data, error } = await sb
    .from("pedidos")
    .update({
      status: "CANCELADO",
      motivo_recusa: MOTIVO_CLIENTE_DESISTIU,
      atualizado_em: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("mesa_id", mesa.id)
    .eq("status", "AGUARDANDO")
    // Pedido que a equipe lançou no PDV não se cancela por celular de mesa,
    // mesmo que por algum caminho ele esteja esperando aprovação.
    .eq("origem", "CLIENTE")
    .gte("criado_em", desde)
    .select("id, comanda_id")
    .maybeSingle();

  if (error) return { ok: false, erro: "Não consegui cancelar agora. Chame o atendente." };

  if (!data) {
    // Não trocou nada: ou o pedido não é desta mesa, ou alguém chegou antes.
    const { data: atual } = await sb
      .from("pedidos")
      .select("status")
      .eq("id", id)
      .eq("mesa_id", mesa.id)
      .maybeSingle();
    if (!atual) return { ok: false, erro: "Esse pedido não é desta mesa." };
    if (atual.status === "CANCELADO") return { ok: true }; // já estava cancelado
    return {
      ok: false,
      erro: "O atendente já confirmou esse pedido. Fale com ele pra trocar.",
    };
  }

  if (data.comanda_id) await liberarContaVazia(sb, data.comanda_id);
  return { ok: true };
}
