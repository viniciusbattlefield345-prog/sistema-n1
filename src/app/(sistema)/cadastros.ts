"use server";

import { revalidatePath } from "next/cache";
import { criarClienteServidor } from "@/lib/supabase/server";

/**
 * Cadastros simples (categoria, adicional, bairro) compartilham a mesma
 * mecânica: uma linha com poucos campos.
 *
 * A lista abaixo é uma trava: só estas tabelas e só estas colunas podem ser
 * gravadas por aqui. Sem isso, a tela do navegador escolheria em que tabela
 * escrever, o que seria um buraco enorme.
 */
const PERMITIDO = {
  categorias: ["nome", "ordem", "ativo"],
  adicionais: ["nome", "preco", "grupo", "ordem", "ativo"],
  bairros: ["nome", "taxa", "ativo"],
} as const;

export type Tabela = keyof typeof PERMITIDO;

/** Onde cada tabela aparece — precisa revalidar o PDV junto. */
const TELAS: Record<Tabela, string[]> = {
  categorias: ["/categorias", "/pdv", "/cardapio"],
  adicionais: ["/adicionais", "/pdv", "/cardapio"],
  bairros: ["/bairros", "/pdv", "/clientes"],
};

export type Resultado =
  | { ok: true; id: number }
  | { ok: false; erro: string };

export async function salvarCadastro(
  tabela: Tabela,
  dados: Record<string, unknown>,
  id?: number,
): Promise<Resultado> {
  const colunas = PERMITIDO[tabela];
  if (!colunas) return { ok: false, erro: "Cadastro desconhecido." };

  const supabase = await criarClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, erro: "Sessão expirada." };

  // Descarta qualquer campo que não esteja na lista permitida
  const linha: Record<string, unknown> = {};
  for (const c of colunas) if (c in dados) linha[c] = dados[c];

  if (typeof linha.nome === "string") linha.nome = linha.nome.trim();
  if (!linha.nome) return { ok: false, erro: "O nome é obrigatório." };

  const resposta = id
    ? await supabase.from(tabela).update(linha).eq("id", id).select("id").single()
    : await supabase.from(tabela).insert(linha).select("id").single();

  if (resposta.error) {
    if (resposta.error.code === "23505")
      return { ok: false, erro: `Já existe "${linha.nome}" cadastrado.` };
    return { ok: false, erro: resposta.error.message };
  }

  TELAS[tabela].forEach((t) => revalidatePath(t));
  return { ok: true, id: resposta.data.id };
}

export async function excluirCadastro(
  tabela: Tabela,
  id: number,
): Promise<Resultado> {
  if (!PERMITIDO[tabela]) return { ok: false, erro: "Cadastro desconhecido." };

  const supabase = await criarClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, erro: "Sessão expirada." };

  const { error } = await supabase.from(tabela).delete().eq("id", id);
  if (error) {
    // 23503 = alguém ainda aponta pra esta linha
    if (error.code === "23503")
      return {
        ok: false,
        erro: "Está em uso e não pode ser excluído. Desative em vez de apagar.",
      };
    return { ok: false, erro: error.message };
  }

  TELAS[tabela].forEach((t) => revalidatePath(t));
  return { ok: true, id };
}
