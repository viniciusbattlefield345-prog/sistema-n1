"use server";

import { revalidatePath } from "next/cache";
import { criarClienteServidor } from "@/lib/supabase/server";
import { usuarioAtual } from "@/lib/supabase/sessao";
import { centavos, dataHora, reais } from "@/lib/formato";

export type ResultadoCaixa = { ok: true } | { ok: false; erro: string };

export async function abrirCaixa(valorAbertura: number): Promise<ResultadoCaixa> {
  const supabase = await criarClienteServidor();
  const user = await usuarioAtual(supabase);
  if (!user) return { ok: false, erro: "Sessão expirada." };

  const { error } = await supabase.from("caixas").insert({
    usuario_id: user.id,
    valor_abertura: valorAbertura,
  });

  if (error) {
    // O índice caixa_unico_aberto impede dois caixas abertos ao mesmo tempo.
    if (error.code === "23505")
      return { ok: false, erro: "Já existe um caixa aberto. Feche ele antes." };
    return { ok: false, erro: error.message };
  }

  revalidatePath("/caixa");
  revalidatePath("/pdv");
  return { ok: true };
}

export async function fecharCaixa(
  id: number,
  valorContado: number,
  observacao: string,
): Promise<ResultadoCaixa> {
  const supabase = await criarClienteServidor();
  const user = await usuarioAtual(supabase);
  if (!user) return { ok: false, erro: "Sessão expirada." };

  // Mesa com conta aberta ainda vai pagar: o dinheiro dela precisa entrar
  // neste caixa, não sumir entre um fechamento e outro.
  const { count: contasAbertas } = await supabase
    .from("comandas")
    .select("id", { count: "exact", head: true })
    .eq("status", "ABERTA");

  if ((contasAbertas ?? 0) > 0)
    return {
      ok: false,
      erro: `Ainda há ${contasAbertas} mesa(s) com conta aberta. Feche as contas antes de fechar o caixa.`,
    };

  // Pedido em aberto some da cozinha quando o caixa fecha: melhor barrar.
  const { count } = await supabase
    .from("pedidos")
    .select("id", { count: "exact", head: true })
    .eq("caixa_id", id)
    .not("status", "in", '("CONCLUIDO","CANCELADO")');

  if ((count ?? 0) > 0)
    return {
      ok: false,
      erro: `Ainda há ${count} pedido(s) em andamento. Conclua ou cancele antes de fechar.`,
    };

  const { error } = await supabase
    .from("caixas")
    .update({
      status: "FECHADO",
      fechado_em: new Date().toISOString(),
      valor_fechamento: valorContado,
      observacao: observacao.trim() || null,
    })
    .eq("id", id);

  if (error) return { ok: false, erro: error.message };

  revalidatePath("/caixa");
  revalidatePath("/pdv");
  return { ok: true };
}

// =====================================================================
// CORRIGIR O CAIXA
// =====================================================================

/** Acima disto é dedo errado no teclado, não dinheiro de lanchonete. */
const MAX_VALOR = 1_000_000;

/** Quanto texto cabe na observação, já contando o histórico das correções. */
const MAX_OBSERVACAO = 2_000;

/**
 * Valor que entra no caixa: tem que ser número, não pode ser negativo e não
 * pode ser absurdo. Centavo arredondado, porque soma de float não fecha conta.
 */
function valorValido(v: number): number | null {
  if (!Number.isFinite(v) || v < 0 || v > MAX_VALOR) return null;
  return centavos(v);
}

/**
 * Corrigir valor de caixa é mexer em dinheiro depois do fato: só a dona.
 * Devolve também o nome dela, que vai assinar a correção.
 */
async function exigirDono() {
  const supabase = await criarClienteServidor();
  const user = await usuarioAtual(supabase);
  if (!user) return { ok: false as const, erro: "Sessão expirada. Entre de novo." };

  const { data: perfil } = await supabase
    .from("perfis")
    .select("papel, nome")
    .eq("id", user.id)
    .single();

  if (perfil?.papel !== "dono")
    return { ok: false as const, erro: "Só a dona corrige valor de caixa. Chame ela." };

  return { ok: true as const, supabase, nome: (perfil.nome as string) || "dona" };
}

/**
 * Corrige os valores de um caixa — o de abertura, o contado no fechamento e
 * a observação.
 *
 * Por que isto existe: o troco da gaveta é digitado às pressas na hora de
 * abrir, e um zero a mais deixa o "esperado na gaveta" errado o dia inteiro.
 * Antes, o único jeito de arrumar era abrir o banco.
 *
 * Por que é seguro: estes dois números NÃO entram em venda nenhuma. Venda,
 * ticket médio e relatório saem de `pedidos` e `pagamentos`; abertura e
 * contagem só servem pra conferir a gaveta nesta tela. Corrigir aqui não
 * mexe em um centavo do faturamento — só faz a conferência bater com a
 * realidade.
 *
 * Toda troca de valor assina embaixo da observação: quem, quando, de quanto
 * pra quanto. O sistema ainda não tem trilha de auditoria de verdade (isso
 * precisa de tabela nova), e uma linha de texto é melhor do que nada quando
 * o assunto é dinheiro mudando de valor depois de contado.
 */
export async function editarCaixa(
  id: number,
  dados: {
    valor_abertura?: number;
    valor_fechamento?: number;
    observacao?: string;
  },
): Promise<ResultadoCaixa> {
  const dono = await exigirDono();
  if (!dono.ok) return dono;
  const { supabase, nome } = dono;

  const { data: caixa } = await supabase
    .from("caixas")
    .select("id, status, valor_abertura, valor_fechamento, observacao")
    .eq("id", id)
    .maybeSingle();

  if (!caixa) return { ok: false, erro: "Esse caixa não existe mais." };

  const mudanca: Record<string, unknown> = {};
  const assinatura: string[] = [];

  if (dados.valor_abertura !== undefined) {
    const v = valorValido(dados.valor_abertura);
    if (v === null) return { ok: false, erro: "Valor de abertura inválido." };
    if (v !== centavos(Number(caixa.valor_abertura))) {
      assinatura.push(`abertura ${reais(Number(caixa.valor_abertura))} para ${reais(v)}`);
      mudanca.valor_abertura = v;
    }
  }

  if (dados.valor_fechamento !== undefined) {
    if (caixa.status !== "FECHADO")
      return {
        ok: false,
        erro: "O dinheiro contado só existe depois que o caixa fecha. Feche ele primeiro.",
      };
    const v = valorValido(dados.valor_fechamento);
    if (v === null) return { ok: false, erro: "Valor contado inválido." };
    if (v !== centavos(Number(caixa.valor_fechamento ?? 0))) {
      assinatura.push(
        `contado ${reais(Number(caixa.valor_fechamento ?? 0))} para ${reais(v)}`,
      );
      mudanca.valor_fechamento = v;
    }
  }

  /**
   * A observação do dono vem inteira do formulário — inclusive as assinaturas
   * antigas, que ele enxerga e pode apagar se quiser. O que a gente garante é
   * que a correção de AGORA entra; guardar isso contra a vontade dele seria
   * fingir uma auditoria que este sistema ainda não tem.
   */
  let texto = dados.observacao !== undefined ? dados.observacao.trim() : (caixa.observacao ?? "");

  if (assinatura.length > 0) {
    const carimbo = `[${dataHora(new Date().toISOString())} · ${nome}] ${assinatura.join("; ")}`;
    texto = texto ? `${texto}\n${carimbo}` : carimbo;
  }

  if (texto.length > MAX_OBSERVACAO) texto = texto.slice(-MAX_OBSERVACAO);

  if (dados.observacao !== undefined || assinatura.length > 0) {
    mudanca.observacao = texto || null;
  }

  if (Object.keys(mudanca).length === 0) return { ok: true }; // nada mudou

  const { error } = await supabase.from("caixas").update(mudanca).eq("id", id);
  if (error) return { ok: false, erro: error.message };

  revalidatePath("/caixa");
  revalidatePath("/pdv");
  return { ok: true };
}
