"use server";

import { criarClienteServidor } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { FormaPagamento, TipoEntrega } from "@/lib/tipos";

/** O que o navegador manda. Repare: nenhum preco vem daqui. */
export interface ItemEnviado {
  produto_id: number;
  variacao_id: number | null;
  quantidade: number;
  observacao: string;
  adicionais: number[]; // ids
}

export interface PedidoEnviado {
  caixa_id: number;
  tipo_entrega: TipoEntrega;
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
  | { ok: true; pedido_id: number; numero_dia: number | null }
  | { ok: false; erro: string };

export async function salvarPedido(dados: PedidoEnviado): Promise<Resultado> {
  const supabase = await criarClienteServidor();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, erro: "Sessão expirada. Entre de novo." };

  if (dados.itens.length === 0)
    return { ok: false, erro: "O pedido está sem itens." };

  if (!dados.cliente_nome.trim())
    return { ok: false, erro: "Informe o nome do cliente." };

  if (dados.tipo_entrega === "ENTREGA" && !dados.endereco_entrega?.trim())
    return { ok: false, erro: "Entrega precisa de endereço." };

  // ---- Precos vem SEMPRE do banco, nunca do navegador ----------------
  const idsProduto = [...new Set(dados.itens.map((i) => i.produto_id))];
  const idsVariacao = [
    ...new Set(dados.itens.map((i) => i.variacao_id).filter((v): v is number => v !== null)),
  ];
  const idsAdicional = [...new Set(dados.itens.flatMap((i) => i.adicionais))];

  const [produtosRes, variacoesRes, adicionaisRes] = await Promise.all([
    supabase.from("produtos").select("id, nome, preco_base").in("id", idsProduto),
    idsVariacao.length
      ? supabase.from("produto_variacoes").select("id, nome, preco, produto_id").in("id", idsVariacao)
      : Promise.resolve({ data: [], error: null }),
    idsAdicional.length
      ? supabase.from("adicionais").select("id, nome, preco").in("id", idsAdicional)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const produtos = new Map((produtosRes.data ?? []).map((p) => [p.id, p]));
  const variacoes = new Map((variacoesRes.data ?? []).map((v) => [v.id, v]));
  const extras = new Map((adicionaisRes.data ?? []).map((a) => [a.id, a]));

  for (const item of dados.itens) {
    if (!produtos.has(item.produto_id))
      return { ok: false, erro: "Um dos produtos saiu do cardápio. Refaça o item." };
    if (item.variacao_id !== null && !variacoes.has(item.variacao_id))
      return { ok: false, erro: "Um dos tamanhos saiu do cardápio. Refaça o item." };
    if (!(item.quantidade > 0))
      return { ok: false, erro: "Quantidade inválida." };
  }

  // ---- Taxa de entrega: tambem do banco ------------------------------
  let taxa = 0;
  if (dados.tipo_entrega === "ENTREGA" && dados.bairro_id) {
    const { data: bairro } = await supabase
      .from("bairros")
      .select("taxa")
      .eq("id", dados.bairro_id)
      .maybeSingle();
    taxa = Number(bairro?.taxa ?? 0);
  }

  // ---- Cabecalho -----------------------------------------------------
  const { data: pedido, error: erroPedido } = await supabase
    .from("pedidos")
    .insert({
      caixa_id: dados.caixa_id,
      usuario_id: user.id,
      cliente_id: dados.cliente_id,
      cliente_nome: dados.cliente_nome.trim(),
      cliente_telefone: dados.cliente_telefone,
      tipo_entrega: dados.tipo_entrega,
      endereco_entrega:
        dados.tipo_entrega === "ENTREGA"
          ? dados.endereco_entrega
          : "RETIRADA NO BALCÃO",
      taxa_entrega: taxa,
      desconto: dados.desconto,
      forma_pagamento: dados.forma_pagamento,
      troco_para: dados.forma_pagamento === "Dinheiro" ? dados.troco_para : null,
      observacao: dados.observacao,
    })
    .select("id, numero_dia")
    .single();

  if (erroPedido || !pedido)
    return { ok: false, erro: erroPedido?.message ?? "Não consegui abrir o pedido." };

  // ---- Itens ---------------------------------------------------------
  const { data: itensSalvos, error: erroItens } = await supabase
    .from("itens_pedido")
    .insert(
      dados.itens.map((item) => {
        const produto = produtos.get(item.produto_id)!;
        const variacao = item.variacao_id ? variacoes.get(item.variacao_id)! : null;
        return {
          pedido_id: pedido.id,
          produto_id: produto.id,
          variacao_id: variacao?.id ?? null,
          produto_nome: produto.nome,
          variacao_nome: variacao?.nome ?? null,
          quantidade: item.quantidade,
          preco_unitario: Number(variacao ? variacao.preco : produto.preco_base),
          observacao: item.observacao.trim() || null,
        };
      }),
    )
    .select("id");

  if (erroItens || !itensSalvos) {
    // Sem itens o pedido nao serve pra nada: desfaz o cabecalho.
    await supabase.from("pedidos").delete().eq("id", pedido.id);
    return { ok: false, erro: erroItens?.message ?? "Não consegui salvar os itens." };
  }

  // ---- Adicionais ----------------------------------------------------
  const linhasExtras = dados.itens.flatMap((item, indice) =>
    item.adicionais
      .map((id) => extras.get(id))
      .filter((a) => a !== undefined)
      .map((a) => ({
        item_id: itensSalvos[indice].id,
        adicional_id: a.id,
        nome: a.nome,
        preco: Number(a.preco),
        quantidade: 1,
      })),
  );

  if (linhasExtras.length > 0) {
    const { error } = await supabase.from("item_adicionais").insert(linhasExtras);
    if (error) return { ok: false, erro: error.message };
  }

  revalidatePath("/cozinha");
  revalidatePath("/pedidos");
  return { ok: true, pedido_id: pedido.id, numero_dia: pedido.numero_dia };
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
  const {
    data: { user },
  } = await supabase.auth.getUser();
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
