import type { SupabaseClient } from "@supabase/supabase-js";
import type { FormaPagamento, OrigemPedido, StatusPedido, TipoPedido } from "./tipos";

/**
 * Regras de pedido que valem igual pro PDV da equipe e pro QR da mesa.
 * Só roda no servidor (server actions) — recebe o cliente Supabase de quem
 * chamou: o do usuário logado, ou o de serviço no caso do cliente da mesa.
 */

/** O que chega do navegador. Repare: nenhum preço vem daqui. */
export interface ItemEnviado {
  produto_id: number;
  variacao_id: number | null;
  quantidade: number;
  observacao: string;
  adicionais: number[]; // ids
}

export interface ItemMontado {
  produto_id: number;
  variacao_id: number | null;
  produto_nome: string;
  variacao_nome: string | null;
  quantidade: number;
  preco_unitario: number;
  observacao: string | null;
  adicionais: { adicional_id: number; nome: string; preco: number }[];
}

export type Falha = { ok: false; erro: string };

const MAX_ITENS = 40;
const MAX_QUANTIDADE = 99;

/**
 * Relê o cardápio no banco e monta os itens com o preço de lá.
 *
 * `rigoroso` é o modo do cliente da mesa: produto esgotado ou desativado é
 * recusado, quantidade tem que ser inteira e adicional só vale se estiver
 * ligado àquele produto. A equipe no PDV tem mais liberdade.
 */
export async function montarItens(
  sb: SupabaseClient,
  enviados: ItemEnviado[],
  rigoroso: boolean,
): Promise<{ ok: true; itens: ItemMontado[] } | Falha> {
  if (!Array.isArray(enviados) || enviados.length === 0)
    return { ok: false, erro: "O pedido está sem itens." };
  if (enviados.length > MAX_ITENS)
    return { ok: false, erro: "Pedido grande demais. Divida em dois." };

  const idsProduto = [...new Set(enviados.map((i) => Number(i.produto_id)))];
  const idsVariacao = [
    ...new Set(
      enviados.map((i) => i.variacao_id).filter((v): v is number => v !== null && v !== undefined),
    ),
  ];
  const idsAdicional = [
    ...new Set(enviados.flatMap((i) => (Array.isArray(i.adicionais) ? i.adicionais : []))),
  ];

  const [produtosRes, variacoesRes, adicionaisRes, ligacoesRes] = await Promise.all([
    sb.from("produtos").select("id, nome, preco_base, ativo, disponivel").in("id", idsProduto),
    idsVariacao.length
      ? sb.from("produto_variacoes").select("id, nome, preco, produto_id").in("id", idsVariacao)
      : Promise.resolve({ data: [], error: null }),
    idsAdicional.length
      ? sb.from("adicionais").select("id, nome, preco, ativo").in("id", idsAdicional)
      : Promise.resolve({ data: [], error: null }),
    idsAdicional.length
      ? sb.from("produto_adicionais").select("produto_id, adicional_id").in("produto_id", idsProduto)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const erroLeitura =
    produtosRes.error ?? variacoesRes.error ?? adicionaisRes.error ?? ligacoesRes.error;
  if (erroLeitura) return { ok: false, erro: erroLeitura.message };

  const produtos = new Map((produtosRes.data ?? []).map((p) => [p.id, p]));
  const variacoes = new Map((variacoesRes.data ?? []).map((v) => [v.id, v]));
  const extras = new Map((adicionaisRes.data ?? []).map((a) => [a.id, a]));
  const ligados = new Set(
    (ligacoesRes.data ?? []).map((l) => `${l.produto_id}:${l.adicional_id}`),
  );

  const itens: ItemMontado[] = [];
  for (const enviado of enviados) {
    const produto = produtos.get(Number(enviado.produto_id));
    if (!produto)
      return { ok: false, erro: "Um dos produtos saiu do cardápio. Refaça o item." };
    if (rigoroso && (!produto.ativo || !produto.disponivel))
      return { ok: false, erro: `${produto.nome} acabou por hoje. Tire do pedido.` };

    let variacao: { id: number; nome: string; preco: number } | null = null;
    if (enviado.variacao_id !== null && enviado.variacao_id !== undefined) {
      const v = variacoes.get(Number(enviado.variacao_id));
      if (!v || v.produto_id !== produto.id)
        return { ok: false, erro: "Um dos tamanhos saiu do cardápio. Refaça o item." };
      variacao = v;
    }

    const quantidade = Number(enviado.quantidade);
    const quantidadeValida = rigoroso
      ? Number.isInteger(quantidade) && quantidade >= 1 && quantidade <= MAX_QUANTIDADE
      : quantidade > 0 && quantidade <= MAX_QUANTIDADE * 10;
    if (!quantidadeValida) return { ok: false, erro: "Quantidade inválida." };

    const adicionais: ItemMontado["adicionais"] = [];
    for (const id of new Set(Array.isArray(enviado.adicionais) ? enviado.adicionais : [])) {
      const a = extras.get(Number(id));
      if (!a) continue;
      if (rigoroso && (!a.ativo || !ligados.has(`${produto.id}:${a.id}`)))
        return { ok: false, erro: `O adicional ${a.nome} não está disponível pra ${produto.nome}.` };
      adicionais.push({ adicional_id: a.id, nome: a.nome, preco: Number(a.preco) });
    }

    itens.push({
      produto_id: produto.id,
      variacao_id: variacao?.id ?? null,
      produto_nome: produto.nome,
      variacao_nome: variacao?.nome ?? null,
      quantidade,
      preco_unitario: Number(variacao ? variacao.preco : produto.preco_base),
      observacao: String(enviado.observacao ?? "").trim().slice(0, 140) || null,
      adicionais,
    });
  }

  return { ok: true, itens };
}

export interface CabecalhoPedido {
  caixa_id: number | null;
  usuario_id: string | null;
  origem: OrigemPedido;
  tipo: TipoPedido;
  mesa_id: number | null;
  comanda_id: number | null;
  cliente_id: number | null;
  cliente_nome: string;
  cliente_telefone: string | null;
  endereco_entrega: string | null;
  taxa_entrega: number;
  desconto: number;
  forma_pagamento: FormaPagamento | null;
  troco_para: number | null;
  status: StatusPedido;
  aprovado_por: string | null;
  aprovado_em: string | null;
  observacao: string | null;
}

/**
 * Grava cabeçalho, itens e adicionais. Se uma parte falha, apaga o que
 * já tinha entrado: pedido pela metade é pior do que pedido nenhum.
 * O total não é passado — quem soma é o banco (triggers).
 */
export async function gravarPedido(
  sb: SupabaseClient,
  cabecalho: CabecalhoPedido,
  itens: ItemMontado[],
): Promise<{ ok: true; id: number; numero_dia: number | null } | Falha> {
  const { data: pedido, error: erroPedido } = await sb
    .from("pedidos")
    .insert(cabecalho)
    .select("id, numero_dia")
    .single();

  if (erroPedido || !pedido)
    return { ok: false, erro: erroPedido?.message ?? "Não consegui abrir o pedido." };

  const { data: salvos, error: erroItens } = await sb
    .from("itens_pedido")
    .insert(
      itens.map((i) => ({
        pedido_id: pedido.id,
        produto_id: i.produto_id,
        variacao_id: i.variacao_id,
        produto_nome: i.produto_nome,
        variacao_nome: i.variacao_nome,
        quantidade: i.quantidade,
        preco_unitario: i.preco_unitario,
        observacao: i.observacao,
      })),
    )
    .select("id");

  if (erroItens || !salvos || salvos.length !== itens.length) {
    await sb.from("pedidos").delete().eq("id", pedido.id);
    return { ok: false, erro: erroItens?.message ?? "Não consegui salvar os itens." };
  }

  const linhasExtras = itens.flatMap((item, indice) =>
    item.adicionais.map((a) => ({
      item_id: salvos[indice].id,
      adicional_id: a.adicional_id,
      nome: a.nome,
      preco: a.preco,
      quantidade: 1,
    })),
  );

  if (linhasExtras.length > 0) {
    const { error } = await sb.from("item_adicionais").insert(linhasExtras);
    if (error) {
      await sb.from("pedidos").delete().eq("id", pedido.id);
      return { ok: false, erro: error.message };
    }
  }

  return { ok: true, id: pedido.id, numero_dia: pedido.numero_dia };
}

/** A conta aberta da mesa; abre uma se não houver. `nova` diz se acabou de nascer. */
export async function contaDaMesa(
  sb: SupabaseClient,
  mesaId: number,
  caixaId: number | null,
): Promise<{ ok: true; id: number; nova: boolean } | Falha> {
  const buscar = () =>
    sb.from("comandas").select("id").eq("mesa_id", mesaId).eq("status", "ABERTA").maybeSingle();

  const { data: aberta } = await buscar();
  if (aberta) return { ok: true, id: aberta.id, nova: false };

  const { data: nova, error } = await sb
    .from("comandas")
    .insert({ mesa_id: mesaId, caixa_id: caixaId })
    .select("id")
    .single();
  if (nova) return { ok: true, id: nova.id, nova: true };

  // Duas pessoas da mesma mesa pedindo no mesmo segundo: o índice único do
  // banco deixa só uma abrir a conta. A outra usa a que acabou de nascer.
  if (error?.code === "23505") {
    const { data: outra } = await buscar();
    if (outra) return { ok: true, id: outra.id, nova: false };
  }
  return { ok: false, erro: error?.message ?? "Não consegui abrir a conta da mesa." };
}

/** Coloca um cupom na fila da impressora do balcão. */
export async function mandarImprimir(
  sb: SupabaseClient,
  alvo: { tipo: "PEDIDO"; pedido_id: number } | { tipo: "CONTA"; comanda_id: number },
  usuarioId: string | null,
): Promise<{ ok: true } | Falha> {
  const { error } = await sb.from("fila_impressao").insert({ ...alvo, pedido_por: usuarioId });
  return error ? { ok: false, erro: error.message } : { ok: true };
}
