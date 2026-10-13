"use server";

import { revalidatePath } from "next/cache";
import { criarClienteServidor } from "@/lib/supabase/server";
import { usuarioAtual } from "@/lib/supabase/sessao";
import { mandarImprimir } from "@/lib/pedido-servidor";
import { centavos, reais } from "@/lib/formato";
import type { FormaPagamento } from "@/lib/tipos";

export type Resultado = { ok: true } | { ok: false; erro: string };

const FORMAS: FormaPagamento[] = ["Dinheiro", "Pix", "Cartao Credito", "Cartao Debito"];

async function sessao() {
  const supabase = await criarClienteServidor();
  const user = await usuarioAtual(supabase);
  return { supabase, user };
}

function atualizarTelas() {
  for (const tela of ["/mesas", "/entregas", "/cozinha", "/pedidos", "/caixa", "/impressao"]) {
    revalidatePath(tela);
  }
  revalidatePath("/mesas/[id]", "page");
}

type Supabase = Awaited<ReturnType<typeof criarClienteServidor>>;

/** Conta que ficou sem nenhum pedido válido não deixa a mesa marcada como ocupada. */
async function liberarSeVazia(supabase: Supabase, comandaId: number, usuarioId: string) {
  const { count } = await supabase
    .from("pedidos")
    .select("id", { count: "exact", head: true })
    .eq("comanda_id", comandaId)
    .neq("status", "CANCELADO");

  if ((count ?? 0) === 0) {
    await supabase
      .from("comandas")
      .update({
        status: "CANCELADA",
        fechada_em: new Date().toISOString(),
        fechada_por: usuarioId,
      })
      .eq("id", comandaId)
      .eq("status", "ABERTA");
  }
}

/**
 * Aprovar = aceitar o pedido que o cliente fez pelo QR e somar na conta da
 * mesa. Não imprime: o papel sai quando o atendente mandar pra cozinha, pra
 * mesa não acumular uma comanda por item pedido.
 */
export async function aprovarPedido(id: number): Promise<Resultado> {
  const { supabase, user } = await sessao();
  if (!user) return { ok: false, erro: "Sessão expirada. Entre de novo." };

  const agora = new Date().toISOString();
  // A condição status = AGUARDANDO é a trava: dois atendentes tocando em
  // "aprovar" ao mesmo tempo não imprimem o pedido duas vezes.
  const { data, error } = await supabase
    .from("pedidos")
    .update({ status: "PENDENTE", aprovado_por: user.id, aprovado_em: agora, atualizado_em: agora })
    .eq("id", id)
    .eq("status", "AGUARDANDO")
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, erro: error.message };
  if (!data) return { ok: false, erro: "Esse pedido já foi aprovado ou recusado por outra pessoa." };

  atualizarTelas();
  return { ok: true };
}

/**
 * Manda pra chapa o que ainda não foi. Um toque, um papel por pedido — e
 * pedido que só tem bebida sai da fila sem gastar papel, porque a cozinha
 * não tem nada a fazer com ele.
 */
export async function mandarPraCozinha(ids: number[]): Promise<Resultado> {
  const { supabase, user } = await sessao();
  if (!user) return { ok: false, erro: "Sessão expirada. Entre de novo." };

  const alvos = [...new Set(ids.map(Number).filter(Number.isInteger))];
  if (alvos.length === 0) return { ok: false, erro: "Nenhum pedido pra mandar." };

  const { error } = await supabase
    .from("fila_impressao")
    .insert(alvos.map((pedido_id) => ({ tipo: "PEDIDO", pedido_id, pedido_por: user.id })));

  if (error) return { ok: false, erro: error.message };
  atualizarTelas();
  return { ok: true };
}

/** Recusar: o cliente vê o motivo no celular dele. */
export async function recusarPedido(id: number, motivo: string): Promise<Resultado> {
  const { supabase, user } = await sessao();
  if (!user) return { ok: false, erro: "Sessão expirada. Entre de novo." };

  const { data, error } = await supabase
    .from("pedidos")
    .update({
      status: "CANCELADO",
      motivo_recusa: motivo.trim().slice(0, 120) || "Não foi possível aceitar agora",
      atualizado_em: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "AGUARDANDO")
    .select("id, comanda_id")
    .maybeSingle();

  if (error) return { ok: false, erro: error.message };
  if (!data) return { ok: false, erro: "Esse pedido já foi aprovado ou recusado por outra pessoa." };

  if (data.comanda_id) await liberarSeVazia(supabase, data.comanda_id, user.id);
  atualizarTelas();
  return { ok: true };
}

export async function reimprimirPedido(id: number): Promise<Resultado> {
  const { supabase, user } = await sessao();
  if (!user) return { ok: false, erro: "Sessão expirada. Entre de novo." };

  const r = await mandarImprimir(supabase, { tipo: "PEDIDO", pedido_id: id }, user.id);
  atualizarTelas();
  return r;
}

export async function imprimirConta(comandaId: number): Promise<Resultado> {
  const { supabase, user } = await sessao();
  if (!user) return { ok: false, erro: "Sessão expirada. Entre de novo." };

  const r = await mandarImprimir(supabase, { tipo: "CONTA", comanda_id: comandaId }, user.id);
  atualizarTelas();
  return r;
}

export async function tentarImpressaoDeNovo(trabalhoId: number): Promise<Resultado> {
  const { supabase, user } = await sessao();
  if (!user) return { ok: false, erro: "Sessão expirada. Entre de novo." };

  const { error } = await supabase
    .from("fila_impressao")
    .update({ status: "PENDENTE", erro: null, atualizado_em: new Date().toISOString() })
    .eq("id", trabalhoId)
    .eq("status", "ERRO");

  if (error) return { ok: false, erro: error.message };
  atualizarTelas();
  return { ok: true };
}

/**
 * Fecha a conta da mesa. Os pagamentos têm que somar exatamente o que falta
 * pagar — dá pra dividir entre formas (parte Pix, parte dinheiro).
 */
export async function fecharConta(
  comandaId: number,
  dados: { desconto: number; pagamentos: { forma: FormaPagamento; valor: number }[] },
): Promise<Resultado> {
  const { supabase, user } = await sessao();
  if (!user) return { ok: false, erro: "Sessão expirada. Entre de novo." };

  const { data: caixa } = await supabase
    .from("caixas")
    .select("id")
    .eq("status", "ABERTO")
    .maybeSingle();
  if (!caixa)
    return { ok: false, erro: "Abra o caixa antes de fechar a conta — o pagamento precisa entrar num caixa." };

  const { data: comanda } = await supabase
    .from("comandas")
    .select("id, status, total")
    .eq("id", comandaId)
    .maybeSingle();
  if (!comanda || comanda.status !== "ABERTA")
    return { ok: false, erro: "Essa conta já foi fechada." };

  const { count: esperando } = await supabase
    .from("pedidos")
    .select("id", { count: "exact", head: true })
    .eq("comanda_id", comandaId)
    .eq("status", "AGUARDANDO");
  if ((esperando ?? 0) > 0)
    return { ok: false, erro: "Tem pedido esperando aprovação nessa mesa. Aprove ou recuse antes de fechar." };

  const total = Number(comanda.total);
  const desconto = centavos(Math.max(0, Number(dados.desconto) || 0));
  if (desconto > total) return { ok: false, erro: "O desconto é maior que a conta." };
  const aPagar = centavos(total - desconto);

  const pagamentos = (Array.isArray(dados.pagamentos) ? dados.pagamentos : [])
    .map((p) => ({ forma: p.forma, valor: centavos(Number(p.valor) || 0) }))
    .filter((p) => p.valor > 0);
  if (pagamentos.some((p) => !FORMAS.includes(p.forma)))
    return { ok: false, erro: "Forma de pagamento inválida." };

  const pago = centavos(pagamentos.reduce((s, p) => s + p.valor, 0));
  if (Math.abs(pago - aPagar) > 0.009)
    return {
      ok: false,
      erro: `Os pagamentos somam ${reais(pago)}, mas a conta é ${reais(aPagar)}.`,
    };

  const agora = new Date().toISOString();
  // Fecha primeiro, com trava: se duas pessoas fecharem juntas, só uma passa
  // e o pagamento não entra em dobro no caixa.
  const { data: fechada, error } = await supabase
    .from("comandas")
    .update({
      status: "FECHADA",
      desconto,
      fechada_em: agora,
      fechada_por: user.id,
      caixa_id: caixa.id,
    })
    .eq("id", comandaId)
    .eq("status", "ABERTA")
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, erro: error.message };
  if (!fechada) return { ok: false, erro: "Essa conta acabou de ser fechada por outra pessoa." };

  if (pagamentos.length > 0) {
    const { error: erroPagamento } = await supabase
      .from("pagamentos")
      .insert(pagamentos.map((p) => ({ ...p, comanda_id: comandaId, caixa_id: caixa.id })));

    if (erroPagamento) {
      await supabase
        .from("comandas")
        .update({ status: "ABERTA", desconto: 0, fechada_em: null, fechada_por: null })
        .eq("id", comandaId);
      return { ok: false, erro: erroPagamento.message };
    }
  }

  // Conta paga: o que ainda aparecia na cozinha sai do painel.
  await supabase
    .from("pedidos")
    .update({ status: "CONCLUIDO", atualizado_em: agora })
    .eq("comanda_id", comandaId)
    .in("status", ["PENDENTE", "EM PREPARO", "PRONTO"]);

  atualizarTelas();
  return { ok: true };
}

/**
 * Estorna o fechamento: desfaz o pagamento e devolve a conta pra aberta.
 *
 * Existe porque fechar conta é a hora de errar. O cliente olha o papel e diz
 * que não pediu aquela coca, ou a forma de pagamento foi digitada trocada —
 * e até agora a única saída era deixar errado. Reabrir devolve a MESMA conta,
 * com os mesmos pedidos: corrige o que estiver errado e fecha de novo.
 *
 * Só o dono, e por um motivo concreto: reabrir tira dinheiro do caixa do dia
 * na hora (o pagamento é apagado, o relatório cai) e o sistema ainda não
 * guarda quem fez isso. Enquanto não guardar, a chave fica com uma pessoa só.
 */
export async function reabrirConta(comandaId: number): Promise<Resultado> {
  const { supabase, user } = await sessao();
  if (!user) return { ok: false, erro: "Sessão expirada. Entre de novo." };

  const { data: perfil } = await supabase
    .from("perfis")
    .select("papel")
    .eq("id", user.id)
    .single();
  if (perfil?.papel !== "dono")
    return { ok: false, erro: "Só a dona pode reabrir uma conta já paga. Chame ela." };

  const { data: comanda } = await supabase
    .from("comandas")
    .select("id, mesa_id, caixa_id, status, desconto, fechada_em, fechada_por")
    .eq("id", comandaId)
    .maybeSingle();
  if (!comanda) return { ok: false, erro: "Conta não encontrada." };
  if (comanda.status === "ABERTA") return { ok: false, erro: "Essa conta já está aberta." };
  if (comanda.status !== "FECHADA")
    return { ok: false, erro: "Essa conta foi cancelada, não paga — não há pagamento pra estornar." };

  /**
   * O caixa que recebeu tem que ser o que ainda está aberto. Caixa fechado já
   * foi contado e conferido: estornar ali mudaria um número que já foi dado
   * como certo, e o dinheiro da gaveta não voltaria junto.
   */
  const { data: caixa } = await supabase
    .from("caixas")
    .select("id")
    .eq("status", "ABERTO")
    .maybeSingle();
  if (!caixa)
    return { ok: false, erro: "O caixa está fechado. Abra o caixa antes de estornar uma conta." };
  if (comanda.caixa_id && comanda.caixa_id !== caixa.id)
    return {
      ok: false,
      erro: "Essa conta foi paga num caixa que já foi fechado e conferido. Não dá pra estornar por aqui.",
    };

  /**
   * O banco só aceita uma conta aberta por mesa. Se outra turma já sentou,
   * reabrir a antiga misturaria o consumo das duas na mesma conta.
   */
  const { data: jaAberta } = await supabase
    .from("comandas")
    .select("id")
    .eq("mesa_id", comanda.mesa_id)
    .eq("status", "ABERTA")
    .maybeSingle();
  if (jaAberta)
    return {
      ok: false,
      erro: "Essa mesa já tem outra conta aberta. Feche ou libere ela antes de reabrir a anterior.",
    };

  // Reabre com trava: se duas pessoas tocarem junto, só uma estorna.
  const { data: reaberta, error } = await supabase
    .from("comandas")
    .update({ status: "ABERTA", desconto: 0, fechada_em: null, fechada_por: null })
    .eq("id", comandaId)
    .eq("status", "FECHADA")
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, erro: error.message };
  if (!reaberta) return { ok: false, erro: "Essa conta acabou de mudar. Recarregue a tela." };

  /**
   * Só agora o dinheiro sai do caixa. Se apagar falhar, a conta volta a
   * fechada exatamente como estava: conta aberta com pagamento ainda no caixa
   * contaria a venda duas vezes no fechamento do dia.
   */
  const { error: erroPagamento } = await supabase
    .from("pagamentos")
    .delete()
    .eq("comanda_id", comandaId);

  if (erroPagamento) {
    await supabase
      .from("comandas")
      .update({
        status: "FECHADA",
        desconto: comanda.desconto,
        fechada_em: comanda.fechada_em,
        fechada_por: comanda.fechada_por,
      })
      .eq("id", comandaId);
    return { ok: false, erro: erroPagamento.message };
  }

  atualizarTelas();
  return { ok: true };
}

/** Mesa aberta por engano ou com todos os pedidos cancelados. */
export async function liberarMesa(comandaId: number): Promise<Resultado> {
  const { supabase, user } = await sessao();
  if (!user) return { ok: false, erro: "Sessão expirada. Entre de novo." };

  const { count } = await supabase
    .from("pedidos")
    .select("id", { count: "exact", head: true })
    .eq("comanda_id", comandaId)
    .neq("status", "CANCELADO");
  if ((count ?? 0) > 0)
    return { ok: false, erro: "Essa conta tem pedidos. Cancele os pedidos ou feche a conta." };

  const { error } = await supabase
    .from("comandas")
    .update({ status: "CANCELADA", fechada_em: new Date().toISOString(), fechada_por: user.id })
    .eq("id", comandaId)
    .eq("status", "ABERTA");

  if (error) return { ok: false, erro: error.message };
  atualizarTelas();
  return { ok: true };
}
