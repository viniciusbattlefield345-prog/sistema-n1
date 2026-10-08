"use server";

import { clienteServico } from "@/lib/supabase/admin";
import { gravarPedido, montarItens, type ItemEnviado } from "@/lib/pedido-servidor";
import type { FormaPagamento, StatusPedido, TipoPedido } from "@/lib/tipos";

/**
 * Ações do link público de tele-entrega.
 *
 * Quem chama é o celular de quem está em casa, sem login nenhum — então tudo
 * é conferido aqui: o telefone, o bairro (e a taxa dele), cada item e cada
 * preço são relidos do banco. Nada que venha do navegador é usado como
 * verdade, nem o valor da entrega.
 */

/** Pedidos do mesmo telefone esperando aprovação. Acima disso é trote. */
const LIMITE_AGUARDANDO = 3;
const NOME_MINIMO = 2;
/** Fixo com DDD (10) ou celular (11). Menos que isso não é telefone. */
const TELEFONE_MINIMO = 10;

export type RespostaEnvio =
  | { ok: true; pedido_id: number; numero_dia: number | null }
  | { ok: false; erro: string };

export interface ClienteConhecido {
  nome: string;
  endereco: string;
  numero: string;
  bairro_id: number | null;
  referencia: string;
}

export interface DadosEntrega {
  tipo: TipoPedido;
  telefone: string;
  nome: string;
  endereco: string;
  numero: string;
  bairro_id: number | null;
  referencia: string;
  forma_pagamento: FormaPagamento;
  troco_para: number | null;
  observacao: string;
  itens: ItemEnviado[];
}

/** Telefone sem máscara: é assim que ele vive no banco e é comparado. */
function soDigitos(valor: unknown): string {
  return String(valor ?? "").replace(/\D/g, "").slice(0, 11);
}

/**
 * Quem já pediu antes não digita tudo de novo.
 *
 * Isto é um link público: qualquer um que digite um telefone vê o nome e o
 * endereço ligados a ele. Foi uma decisão consciente, em troca de o cliente
 * pedir em dois toques. Por isso aqui só sai o que o próprio cliente precisa
 * rever — nunca o histórico de pedidos nem quanto ele já gastou.
 */
export async function buscarCliente(telefone: string): Promise<ClienteConhecido | null> {
  const tel = soDigitos(telefone);
  if (tel.length < TELEFONE_MINIMO) return null;

  const sb = clienteServico();
  const { data } = await sb
    .from("clientes")
    .select("nome, endereco, numero, bairro_id, referencia")
    .eq("telefone", tel)
    .maybeSingle();

  if (!data) return null;
  return {
    nome: data.nome ?? "",
    endereco: data.endereco ?? "",
    numero: data.numero ?? "",
    bairro_id: data.bairro_id,
    referencia: data.referencia ?? "",
  };
}

/**
 * Cria ou completa o cadastro pelo telefone, que é a chave única da tabela.
 *
 * Cadastro que já existe NÃO é sobrescrito daqui: este é um link público, e
 * quem soubesse o número de outra pessoa poderia trocar o nome e o endereço
 * dela no cadastro da loja. Só se preenche buraco — o que já está escrito
 * fica. O endereço deste pedido vai gravado no próprio pedido, então a
 * entrega sai certa de qualquer jeito.
 *
 * O efeito colateral: cliente que se muda continua com o endereço antigo
 * voltando preenchido. Ele corrige na hora do pedido (e o pedido sai no
 * lugar certo), mas quem arruma o cadastro de vez é a loja, na tela
 * Clientes. Pra ele mesmo poder mudar, o telefone precisaria ser
 * confirmado por SMS — aí sim dá pra confiar em quem está do outro lado.
 */
async function guardarCliente(
  sb: ReturnType<typeof clienteServico>,
  dados: DadosEntrega,
  tel: string,
): Promise<number | null> {
  const campos = {
    nome: dados.nome.trim().slice(0, 80),
    telefone: tel,
    endereco: dados.endereco.trim().slice(0, 120) || null,
    numero: dados.numero.trim().slice(0, 20) || null,
    bairro_id: dados.bairro_id,
    referencia: dados.referencia.trim().slice(0, 120) || null,
  };

  const { data: existente } = await sb
    .from("clientes")
    .select("id, nome, endereco, numero, bairro_id, referencia")
    .eq("telefone", tel)
    .maybeSingle();

  if (existente) {
    const buracos: Record<string, unknown> = {};
    if (!existente.nome?.trim()) buracos.nome = campos.nome;
    if (!existente.endereco?.trim() && campos.endereco) buracos.endereco = campos.endereco;
    if (!existente.numero?.trim() && campos.numero) buracos.numero = campos.numero;
    if (existente.bairro_id === null && campos.bairro_id) buracos.bairro_id = campos.bairro_id;
    if (!existente.referencia?.trim() && campos.referencia)
      buracos.referencia = campos.referencia;

    if (Object.keys(buracos).length > 0)
      await sb.from("clientes").update(buracos).eq("id", existente.id);
    return existente.id;
  }

  const { data: novo, error } = await sb.from("clientes").insert(campos).select("id").single();
  if (novo) return novo.id;

  // Dois pedidos do mesmo telefone no mesmo segundo: um perde a corrida do
  // índice único. O cadastro do outro já serve.
  if (error?.code === "23505") {
    const { data: outro } = await sb
      .from("clientes")
      .select("id")
      .eq("telefone", tel)
      .maybeSingle();
    return outro?.id ?? null;
  }
  // Cadastro é conveniência: se falhar, o pedido ainda vale.
  return null;
}

export async function enviarPedidoEntrega(dados: DadosEntrega): Promise<RespostaEnvio> {
  const sb = clienteServico();

  const ehEntrega = dados?.tipo === "ENTREGA";
  if (!ehEntrega && dados?.tipo !== "RETIRADA")
    return { ok: false, erro: "Escolha entre receber em casa ou buscar na loja." };

  const tel = soDigitos(dados?.telefone);
  if (tel.length < TELEFONE_MINIMO)
    return { ok: false, erro: "Telefone incompleto. Põe o DDD e o número." };

  const nome = String(dados?.nome ?? "").trim().slice(0, 80);
  if (nome.length < NOME_MINIMO) return { ok: false, erro: "Diga seu nome completo." };

  const { data: caixa } = await sb
    .from("caixas")
    .select("id")
    .eq("status", "ABERTO")
    .maybeSingle();
  if (!caixa) return { ok: false, erro: "Estamos fechados agora. Tente mais tarde." };

  // ---- Endereço e taxa: a taxa vem SEMPRE do bairro no banco ----------
  let taxa = 0;
  let enderecoCompleto = "RETIRADA NO BALCÃO";

  if (ehEntrega) {
    const rua = String(dados?.endereco ?? "").trim().slice(0, 120);
    const numero = String(dados?.numero ?? "").trim().slice(0, 20);
    if (!rua) return { ok: false, erro: "Falta a rua pra entrega." };
    if (!dados?.bairro_id) return { ok: false, erro: "Escolha o seu bairro." };

    const { data: bairro } = await sb
      .from("bairros")
      .select("nome, taxa, ativo")
      .eq("id", dados.bairro_id)
      .maybeSingle();
    if (!bairro || !bairro.ativo)
      return { ok: false, erro: "Não entregamos nesse bairro. Escolha outro ou retire na loja." };

    taxa = Number(bairro.taxa);
    const referencia = String(dados?.referencia ?? "").trim().slice(0, 120);
    enderecoCompleto =
      `${rua}${numero ? `, ${numero}` : ""} - ${bairro.nome}` +
      (referencia ? ` (${referencia})` : "");
  }

  const montagem = await montarItens(sb, dados?.itens ?? [], true);
  if (!montagem.ok) return montagem;

  const { count } = await sb
    .from("pedidos")
    .select("id", { count: "exact", head: true })
    .eq("cliente_telefone", tel)
    .eq("status", "AGUARDANDO");
  if ((count ?? 0) >= LIMITE_AGUARDANDO)
    return {
      ok: false,
      erro: "Seus pedidos anteriores ainda estão esperando confirmação. Aguarde um instante.",
    };

  const clienteId = await guardarCliente(sb, { ...dados, nome }, tel);

  const dinheiro = dados?.forma_pagamento === "Dinheiro";
  const troco = dinheiro ? Number(dados?.troco_para) || null : null;

  const resultado = await gravarPedido(
    sb,
    {
      caixa_id: caixa.id,
      usuario_id: null,
      origem: "CLIENTE",
      tipo: ehEntrega ? "ENTREGA" : "RETIRADA",
      mesa_id: null,
      comanda_id: null,
      cliente_id: clienteId,
      cliente_nome: nome,
      cliente_telefone: tel,
      endereco_entrega: enderecoCompleto,
      taxa_entrega: taxa,
      desconto: 0,
      forma_pagamento: dados?.forma_pagamento ?? null,
      troco_para: troco,
      status: "AGUARDANDO",
      aprovado_por: null,
      aprovado_em: null,
      observacao: String(dados?.observacao ?? "").trim().slice(0, 200) || null,
    },
    montagem.itens,
  );

  if (!resultado.ok) return resultado;
  return { ok: true, pedido_id: resultado.id, numero_dia: resultado.numero_dia };
}

export interface SituacaoEntrega {
  id: number;
  numero_dia: number | null;
  status: StatusPedido;
  total: number;
  motivo_recusa: string | null;
  criado_em: string;
  itens: { nome: string; quantidade: number }[];
}

/**
 * Andamento dos pedidos que ESTE celular fez: os ids ficam guardados nele, e
 * só valem casados com o telefone do dono. Últimas 12 horas.
 */
export async function consultarPedidosEntrega(
  telefone: string,
  ids: number[],
): Promise<SituacaoEntrega[]> {
  const tel = soDigitos(telefone);
  if (tel.length < TELEFONE_MINIMO) return [];

  const limpos = [
    ...new Set((Array.isArray(ids) ? ids : []).map(Number).filter(Number.isInteger)),
  ].slice(0, 30);
  if (limpos.length === 0) return [];

  const sb = clienteServico();
  const desde = new Date(Date.now() - 12 * 3600_000).toISOString();
  const { data } = await sb
    .from("pedidos")
    .select(
      "id, numero_dia, status, total, motivo_recusa, criado_em, itens_pedido(produto_nome, quantidade)",
    )
    .eq("cliente_telefone", tel)
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
    itens: ((p.itens_pedido ?? []) as { produto_nome: string; quantidade: number }[]).map((i) => ({
      nome: i.produto_nome,
      quantidade: Number(i.quantidade),
    })),
  }));
}
