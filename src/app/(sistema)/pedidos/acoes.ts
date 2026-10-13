"use server";

import { revalidatePath } from "next/cache";
import { criarClienteServidor } from "@/lib/supabase/server";
import { usuarioAtual } from "@/lib/supabase/sessao";
import { gravarItens, montarItens, type ItemEnviado } from "@/lib/pedido-servidor";

export type Resultado = { ok: true } | { ok: false; erro: string };

type Supabase = Awaited<ReturnType<typeof criarClienteServidor>>;

function atualizarTelas() {
  for (const tela of ["/pedidos", "/cozinha", "/caixa", "/mesas", "/entregas", "/pdv"]) {
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
    if (conta && conta.status === "CANCELADA")
      return {
        ok: false,
        erro: "A conta dessa mesa foi cancelada e a mesa liberada. Lance o pedido de novo na mesa.",
      };
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

/** Um pedido que já virou um cupom deste tamanho não é pedido, é confusão. */
const MAX_LINHAS = 60;

/**
 * Apaga um pedido cancelado do histórico, de vez.
 *
 * Serve pra limpar o lixo: os testes de quando o sistema estava sendo
 * aprendido, o pedido digitado em dobro. Só pedido CANCELADO, e é por isso
 * que é seguro — cancelado já está fora de todo total, de todo relatório e
 * de toda conta, então apagar não muda número nenhum. Pedido que valeu
 * dinheiro continua sem poder ser apagado linha por linha: pra isso existe
 * o "Zerar o movimento" em Configurações, que leva tudo junto e avisa.
 *
 * Só o dono. Os itens e os adicionais saem junto, pelo cascade do banco.
 */
export async function apagarPedido(id: number): Promise<Resultado> {
  const supabase = await criarClienteServidor();
  const user = await usuarioAtual(supabase);
  if (!user) return { ok: false, erro: "Sessão expirada." };

  const { data: perfil } = await supabase
    .from("perfis")
    .select("papel")
    .eq("id", user.id)
    .single();
  if (perfil?.papel !== "dono")
    return { ok: false, erro: "Só a dona pode apagar pedido do histórico." };

  const { data: pedido } = await supabase
    .from("pedidos")
    .select("id, status")
    .eq("id", id)
    .maybeSingle();
  if (!pedido) return { ok: false, erro: "Esse pedido já saiu do histórico." };
  if (pedido.status !== "CANCELADO")
    return {
      ok: false,
      erro: "Só pedido cancelado pode ser apagado. Cancele ele primeiro, ou use Zerar o movimento em Configurações.",
    };

  const { error } = await supabase
    .from("pedidos")
    .delete()
    .eq("id", id)
    .eq("status", "CANCELADO");
  if (error) return { ok: false, erro: error.message };

  atualizarTelas();
  return { ok: true };
}

/**
 * Acrescenta itens a um pedido que já existe.
 *
 * É o caso mais comum do balcão e não tinha solução: o cliente liga de volta
 * e pede uma coca, ou lembra da batata quando já desligou. Antes disso, a
 * única saída era cancelar o pedido inteiro e lançar tudo de novo — com a
 * cozinha já trabalhando no resto.
 *
 * Vale pra mesa, entrega e retirada. Os preços vêm do banco, nunca do
 * navegador, pelo mesmo caminho do pedido novo; os totais do pedido e da
 * conta da mesa são refeitos pelos gatilhos.
 *
 * O papel não sai sozinho: se a cozinha precisa saber, quem manda é o
 * atendente, pelo botão de sempre.
 */
export async function acrescentarItens(
  pedidoId: number,
  itens: ItemEnviado[],
): Promise<Resultado> {
  const supabase = await criarClienteServidor();
  const user = await usuarioAtual(supabase);
  if (!user) return { ok: false, erro: "Sessão expirada." };

  const pode = await podeMexer(supabase, pedidoId);
  if (!pode.ok) return pode;
  if (pode.pedido.status === "CANCELADO")
    return { ok: false, erro: "Esse pedido está cancelado. Reabra ele primeiro." };

  const { count } = await supabase
    .from("itens_pedido")
    .select("id", { count: "exact", head: true })
    .eq("pedido_id", pedidoId);
  if ((count ?? 0) + itens.length > MAX_LINHAS)
    return {
      ok: false,
      erro: `Esse pedido já tem ${count} itens. Lance os novos como um pedido separado.`,
    };

  const montagem = await montarItens(supabase, itens, false);
  if (!montagem.ok) return montagem;

  const gravado = await gravarItens(supabase, pedidoId, montagem.itens);
  if (!gravado.ok) return gravado;

  atualizarTelas();
  return { ok: true };
}

/**
 * Muda a quantidade ou a observação de um item que já está no pedido.
 *
 * Dois em vez de um, "sem cebola" que faltou. Sem isso, acertar a quantidade
 * era tirar a linha e lançar de novo — e o preço voltava do cardápio de hoje,
 * que pode não ser o preço que foi combinado com o cliente. Aqui o
 * preco_unitario não é tocado de propósito.
 */
export async function editarItem(
  itemId: number,
  dados: { quantidade?: number; observacao?: string | null },
): Promise<Resultado> {
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
    return { ok: false, erro: "Esse pedido está cancelado. Reabra ele primeiro." };

  const mudancas: { quantidade?: number; observacao?: string | null } = {};

  if (dados.quantidade !== undefined) {
    const q = Math.trunc(Number(dados.quantidade));
    if (!Number.isFinite(q) || q < 1)
      return { ok: false, erro: "A quantidade tem que ser 1 ou mais. Pra tirar, use o ✕." };
    if (q > 99) return { ok: false, erro: "Quantidade alta demais. Confira o número." };
    mudancas.quantidade = q;
  }

  if (dados.observacao !== undefined)
    mudancas.observacao = dados.observacao?.trim().slice(0, 120) || null;

  if (Object.keys(mudancas).length === 0) return { ok: true };

  const { error } = await supabase.from("itens_pedido").update(mudancas).eq("id", itemId);
  if (error) return { ok: false, erro: error.message };

  atualizarTelas();
  return { ok: true };
}

/**
 * Volta atrás num cancelamento.
 *
 * Cancelar é um toque e dá pra errar de linha: o atendente cancela o #12
 * querendo cancelar o #13 e o cliente fica sem o lanche. Como cancelar não
 * apaga nada — só marca — desfazer é desmarcar, e o valor volta pra conta da
 * mesa pelo mesmo gatilho do banco que o tirou.
 *
 * Volta como PENDENTE, na fila da cozinha, que é onde um pedido novo nasce. O
 * sistema não tem como saber se a comida já foi feita; quem sabe é quem está
 * lá, e dali ele segue pelos botões normais da cozinha.
 */
export async function descancelarPedido(id: number): Promise<Resultado> {
  const supabase = await criarClienteServidor();
  const user = await usuarioAtual(supabase);
  if (!user) return { ok: false, erro: "Sessão expirada." };

  const pode = await podeMexer(supabase, id);
  if (!pode.ok) return pode;
  if (pode.pedido.status !== "CANCELADO")
    return { ok: false, erro: "Esse pedido não está cancelado." };

  // Trava no status: duas pessoas tocando junto não devolvem o valor em dobro.
  const { data, error } = await supabase
    .from("pedidos")
    .update({
      status: "PENDENTE",
      motivo_recusa: null,
      atualizado_em: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "CANCELADO")
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, erro: error.message };
  if (!data) return { ok: false, erro: "Esse pedido acabou de mudar. Recarregue a tela." };

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
