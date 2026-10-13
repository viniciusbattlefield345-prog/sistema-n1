"use server";

import { revalidatePath } from "next/cache";
import { criarClienteServidor } from "@/lib/supabase/server";
import { usuarioAtual } from "@/lib/supabase/sessao";
import type { ConfigImpressoras, ConfigRestaurante } from "@/lib/tipos";

export type Resultado = { ok: true } | { ok: false; erro: string };

async function gravar(chave: string, valor: unknown): Promise<Resultado> {
  const supabase = await criarClienteServidor();
  const user = await usuarioAtual(supabase);
  if (!user) return { ok: false, erro: "Sessão expirada." };

  const { error } = await supabase
    .from("configuracoes")
    .upsert({ chave, valor }, { onConflict: "chave" });

  if (error) return { ok: false, erro: error.message };

  revalidatePath("/configuracoes");
  revalidatePath("/impressao");
  revalidatePath("/imprimir", "layout");
  return { ok: true };
}

export async function salvarRestaurante(dados: ConfigRestaurante) {
  return gravar("restaurante", dados);
}

export async function salvarImpressoras(dados: ConfigImpressoras) {
  return gravar("impressoras", dados);
}

// =====================================================================
// ZERAR O MOVIMENTO
// =====================================================================

/**
 * As tabelas do movimento, na ordem em que podem sair sem brigar com as
 * chaves estrangeiras: primeiro quem aponta, depois quem é apontado.
 *
 * Cardápio, clientes, bairros, mesas, acessos e configurações não estão
 * aqui e não são tocados. É o ponto inteiro desta lista existir escrita
 * em um lugar só: fica óbvio o que entra e o que não entra.
 */
const MOVIMENTO = [
  "pagamentos",
  "fila_impressao",
  "item_adicionais",
  "itens_pedido",
  "pedidos",
  "comandas",
  "caixas",
] as const;

/** A palavra que o dono digita pra destravar. Não é "sim", é um ato. */
const SENHA_DE_CONFIRMACAO = "ZERAR";

/** Cópia grande demais pra voltar numa resposta de servidor. */
const MAX_LINHAS_COPIA = 50_000;

type Supabase = Awaited<ReturnType<typeof criarClienteServidor>>;

async function exigirDono(): Promise<
  { ok: true; supabase: Supabase } | { ok: false; erro: string }
> {
  const supabase = await criarClienteServidor();
  const user = await usuarioAtual(supabase);
  if (!user) return { ok: false, erro: "Sessão expirada. Entre de novo." };

  const { data: perfil } = await supabase
    .from("perfis")
    .select("papel")
    .eq("id", user.id)
    .single();
  if (perfil?.papel !== "dono")
    return { ok: false, erro: "Só a dona pode apagar o movimento." };

  return { ok: true, supabase };
}

/**
 * Baixa tudo que vai ser apagado, pra ficar guardado no computador.
 *
 * O plano do banco não tem backup automático: se o movimento for embora
 * sem cópia, foi embora pra sempre. Por isso o botão de baixar está antes
 * do botão de apagar, e não ao lado.
 */
export async function copiaDoMovimento(): Promise<
  { ok: true; dados: Record<string, unknown[]> } | { ok: false; erro: string }
> {
  const dono = await exigirDono();
  if (!dono.ok) return dono;

  const dados: Record<string, unknown[]> = {};
  let total = 0;

  for (const tabela of MOVIMENTO) {
    const { data, error } = await dono.supabase.from(tabela).select("*");
    if (error) return { ok: false, erro: `${tabela}: ${error.message}` };
    dados[tabela] = data ?? [];
    total += dados[tabela].length;
    if (total > MAX_LINHAS_COPIA)
      return {
        ok: false,
        erro: "Movimento grande demais pra baixar por aqui. Me chame que eu tiro a cópia pelo banco.",
      };
  }

  return { ok: true, dados };
}

/**
 * Apaga todo o movimento: pedidos, itens, contas de mesa, pagamentos,
 * fila de impressão e caixas. Não tem como desfazer.
 *
 * Existe pra ele não precisar rodar SQL à mão no banco — era isso ou
 * digitar `truncate` no painel do Supabase cada vez, onde um nome de
 * tabela trocado leva o cardápio inteiro junto.
 *
 * Três travas, e as três importam:
 *  - só o dono;
 *  - a palavra digitada, porque clique sozinho a gente dá sem ler;
 *  - mesa com conta aberta ou pedido esperando aprovação barra tudo.
 *    Apagar no meio do movimento deixaria gente comendo sem conta e
 *    pedido na chapa sem registro.
 */
export async function zerarMovimento(
  confirmacao: string,
): Promise<{ ok: true; apagados: number } | { ok: false; erro: string }> {
  const dono = await exigirDono();
  if (!dono.ok) return dono;
  const { supabase } = dono;

  if (confirmacao.trim().toUpperCase() !== SENHA_DE_CONFIRMACAO)
    return { ok: false, erro: `Digite ${SENHA_DE_CONFIRMACAO} pra confirmar.` };

  const { count: abertas } = await supabase
    .from("comandas")
    .select("id", { count: "exact", head: true })
    .eq("status", "ABERTA");
  if ((abertas ?? 0) > 0)
    return {
      ok: false,
      erro: `Tem ${abertas} mesa(s) com conta aberta. Feche ou libere elas antes de zerar.`,
    };

  const { count: esperando } = await supabase
    .from("pedidos")
    .select("id", { count: "exact", head: true })
    .eq("status", "AGUARDANDO");
  if ((esperando ?? 0) > 0)
    return {
      ok: false,
      erro: `Tem ${esperando} pedido(s) esperando aprovação. Aprove ou recuse antes de zerar.`,
    };

  const { count: pedidos } = await supabase
    .from("pedidos")
    .select("id", { count: "exact", head: true });

  for (const tabela of MOVIMENTO) {
    // O filtro é sempre verdadeiro: serve pra deixar explícito que é a
    // tabela toda, em vez de depender do servidor aceitar delete sem filtro.
    const { error } = await supabase.from(tabela).delete().gt("id", 0);
    if (error) return { ok: false, erro: `${tabela}: ${error.message}` };
  }

  for (const tela of [
    "/configuracoes",
    "/pedidos",
    "/mesas",
    "/cozinha",
    "/entregas",
    "/caixa",
    "/relatorios",
    "/impressao",
    "/pdv",
  ])
    revalidatePath(tela);
  revalidatePath("/mesas/[id]", "page");

  return { ok: true, apagados: pedidos ?? 0 };
}
