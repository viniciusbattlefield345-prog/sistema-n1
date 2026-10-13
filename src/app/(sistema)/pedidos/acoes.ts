"use server";

import { revalidatePath } from "next/cache";
import { criarClienteServidor } from "@/lib/supabase/server";
import { usuarioAtual } from "@/lib/supabase/sessao";

export type Resultado = { ok: true } | { ok: false; erro: string };

type Supabase = Awaited<ReturnType<typeof criarClienteServidor>>;

function atualizarTelas() {
  for (const tela of ["/pedidos", "/cozinha", "/caixa", "/mesas", "/entregas"]) {
    revalidatePath(tela);
  }
  revalidatePath("/mesas/[id]", "page");
}

/**
 * Até quando dá pra desfazer um pedido já lançado.
 *
 * O limite não é o status do pedido, é o dinheiro. Enquanto a conta da mesa
 * está aberta e o caixa também, nada foi recebido nem conferido: corrigir um
 * lançamento errado é só corrigir. Depois que a conta fecha ou o caixa é
 * contado, mexer aqui faria o relatório parar de bater com a gaveta — e
 * ninguém ia descobrir pelo sistema, só pelo dinheiro faltando.
 */
async function podeMexer(
  supabase: Supabase,
  pedidoId: number,
): Promise<
  | { ok: true; pedido: { id: number; status: string; comanda_id: number | null } }
  | { ok: false; erro: string }
> {
  const { data: pedido } = await supabase
    .from("pedidos")
    .select("id, status, comanda_id, caixa_id")
    .eq("id", pedidoId)
    .maybeSingle();
  if (!pedido) return { ok: false, erro: "Pedido não encontrado." };

  if (pedido.comanda_id) {
    const { data: conta } = await supabase
      .from("comandas")
      .select("status")
      .eq("id", pedido.comanda_id)
      .maybeSingle();
    if (conta && conta.status !== "ABERTA")
      return {
        ok: false,
        erro:
          "A conta dessa mesa já foi fechada e paga. Pra corrigir, reabra a conta na tela da mesa — só a dona faz isso.",
      };
  }

  if (pedido.caixa_id) {
    const { data: caixa } = await supabase
      .from("caixas")
      .select("status")
      .eq("id", pedido.caixa_id)
      .maybeSingle();
    if (caixa && caixa.status !== "ABERTO")
      return {
        ok: false,
        erro: "Esse pedido é de um caixa que já foi fechado e conferido. Anote a diferença e fale com a dona.",
      };
  }

  return { ok: true, pedido };
}

/** Cancelar não apaga: o pedido some das contas mas fica no histórico. */
export async function cancelarPedido(id: number): Promise<Resultado> {
  const supabase = await criarClienteServidor();
  const user = await usuarioAtual(supabase);
  if (!user) return { ok: false, erro: "Sessão expirada." };

  const pode = await podeMexer(supabase, id);
  if (!pode.ok) return pode;

  const { error } = await supabase
    .from("pedidos")
    .update({ status: "CANCELADO", atualizado_em: new Date().toISOString() })
    .eq("id", id);

  if (error) return { ok: false, erro: error.message };

  atualizarTelas();
  return { ok: true };
}

/**
 * Tira um item do pedido: a coca que o cliente não pediu, o lanche digitado
 * duas vezes. Sem isso, errar uma linha obrigava a cancelar o pedido inteiro
 * e lançar tudo de novo, com a cozinha já trabalhando no resto.
 *
 * Aqui apaga de verdade, e é de propósito: uma venda que não aconteceu não
 * pode continuar contando no relatório do dia nem na conta da mesa. Quem
 * refaz os totais é o banco, pelos mesmos gatilhos de quando o item nasceu.
 */
export async function removerItem(itemId: number): Promise<Resultado> {
  const supabase = await criarClienteServidor();
  const user = await usuarioAtual(supabase);
  if (!user) return { ok: false, erro: "Sessão expirada." };

  const { data: item } = await supabase
    .from("itens_pedido")
    .select("id, pedido_id")
    .eq("id", itemId)
    .maybeSingle();
  if (!item) return { ok: false, erro: "Esse item já saiu do pedido." };

  const pode = await podeMexer(supabase, item.pedido_id);
  if (!pode.ok) return pode;
  if (pode.pedido.status === "CANCELADO")
    return { ok: false, erro: "Esse pedido inteiro já está cancelado." };

  /**
   * Pedido sem item nenhum não é pedido: ficaria valendo zero na conta e
   * ainda apareceria na cozinha. Quem quer tirar a última linha está, na
   * verdade, cancelando o pedido — e para isso existe o botão do lado.
   */
  const { count } = await supabase
    .from("itens_pedido")
    .select("id", { count: "exact", head: true })
    .eq("pedido_id", item.pedido_id);
  if ((count ?? 0) <= 1)
    return {
      ok: false,
      erro: "É o único item do pedido. Use Cancelar para tirar o pedido inteiro.",
    };

  const { error } = await supabase.from("itens_pedido").delete().eq("id", itemId);
  if (error) return { ok: false, erro: error.message };

  atualizarTelas();
  return { ok: true };
}
