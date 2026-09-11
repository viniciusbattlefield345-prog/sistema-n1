"use server";

import { revalidatePath } from "next/cache";
import { criarClienteServidor } from "@/lib/supabase/server";
import { clienteServico } from "@/lib/supabase/admin";

export interface DadosProduto {
  id?: number;
  categoria_id: number | null;
  nome: string;
  descricao: string;
  foto_url: string | null;
  preco_base: number;
  ativo: boolean;
  disponivel: boolean;
  ordem: number;
  /** Tamanhos. Lista vazia = produto de preço único. */
  variacoes: { id?: number; nome: string; preco: number; ordem: number }[];
  /** Quais adicionais este produto aceita. */
  adicionais: number[];
}

export type Resultado = { ok: true; id: number } | { ok: false; erro: string };

export async function salvarProduto(dados: DadosProduto): Promise<Resultado> {
  const supabase = await criarClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, erro: "Sessão expirada." };

  const nome = dados.nome.trim();
  if (!nome) return { ok: false, erro: "O produto precisa de nome." };

  const variacoes = dados.variacoes.filter((v) => v.nome.trim());
  for (const v of variacoes)
    if (!(v.preco > 0))
      return { ok: false, erro: `O tamanho "${v.nome}" está sem preço.` };

  if (variacoes.length === 0 && !(dados.preco_base > 0))
    return { ok: false, erro: "Informe o preço, ou cadastre os tamanhos." };

  const linha = {
    categoria_id: dados.categoria_id,
    nome,
    descricao: dados.descricao.trim() || null,
    foto_url: dados.foto_url || null,
    // Com tamanhos, o preço base vira o menor deles: é o "a partir de" do card.
    preco_base: variacoes.length
      ? Math.min(...variacoes.map((v) => v.preco))
      : dados.preco_base,
    ativo: dados.ativo,
    disponivel: dados.disponivel,
    ordem: dados.ordem,
  };

  const resposta = dados.id
    ? await supabase.from("produtos").update(linha).eq("id", dados.id).select("id").single()
    : await supabase.from("produtos").insert(linha).select("id").single();

  if (resposta.error) return { ok: false, erro: resposta.error.message };
  const produtoId = resposta.data.id;

  // Tamanhos: troca a lista inteira. Item de pedido guarda o nome do tamanho
  // numa coluna própria, então o histórico não se perde nisso.
  await supabase.from("produto_variacoes").delete().eq("produto_id", produtoId);
  if (variacoes.length > 0) {
    const { error } = await supabase.from("produto_variacoes").insert(
      variacoes.map((v, i) => ({
        produto_id: produtoId,
        nome: v.nome.trim(),
        preco: v.preco,
        ordem: v.ordem || i + 1,
      })),
    );
    if (error) return { ok: false, erro: error.message };
  }

  await supabase.from("produto_adicionais").delete().eq("produto_id", produtoId);
  if (dados.adicionais.length > 0) {
    const { error } = await supabase.from("produto_adicionais").insert(
      dados.adicionais.map((adicional_id) => ({ produto_id: produtoId, adicional_id })),
    );
    if (error) return { ok: false, erro: error.message };
  }

  revalidatePath("/cardapio");
  revalidatePath("/pdv");
  return { ok: true, id: produtoId };
}

const TIPOS_FOTO = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png" } as const;

/**
 * Sobe a foto de um produto pro Storage e devolve o link público.
 * O navegador já manda a imagem reduzida (lado maior de 1000px), por isso
 * o limite aqui é baixo: foto de celular crua passaria de 5 MB.
 */
export async function enviarFoto(
  form: FormData,
): Promise<{ ok: true; url: string } | { ok: false; erro: string }> {
  const supabase = await criarClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, erro: "Sessão expirada." };

  const arquivo = form.get("foto");
  if (!(arquivo instanceof File) || arquivo.size === 0)
    return { ok: false, erro: "Escolha uma imagem." };
  if (arquivo.size > 900_000)
    return { ok: false, erro: "A imagem ficou grande demais. Tente outra foto." };

  const extensao = TIPOS_FOTO[arquivo.type as keyof typeof TIPOS_FOTO];
  if (!extensao) return { ok: false, erro: "Use uma foto (JPG, PNG ou WebP)." };

  const caminho = `produtos/${crypto.randomUUID()}.${extensao}`;
  const storage = clienteServico().storage;
  const subir = () =>
    storage.from("cardapio").upload(caminho, arquivo, {
      contentType: arquivo.type,
      cacheControl: "31536000",
    });

  let { error } = await subir();
  // O SQL cria a pasta "cardapio"; se alguém rodou sem ela, cria agora.
  if (error && /not found/i.test(error.message)) {
    await storage.createBucket("cardapio", { public: true });
    ({ error } = await subir());
  }
  if (error) return { ok: false, erro: error.message };

  return { ok: true, url: storage.from("cardapio").getPublicUrl(caminho).data.publicUrl };
}

/** O botão "acabou hoje": tira do PDV e do cardápio da mesa sem apagar nada. */
export async function alternarDisponivel(
  id: number,
  disponivel: boolean,
): Promise<Resultado> {
  const supabase = await criarClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, erro: "Sessão expirada." };

  const { error } = await supabase
    .from("produtos")
    .update({ disponivel })
    .eq("id", id);
  if (error) return { ok: false, erro: error.message };

  revalidatePath("/cardapio");
  revalidatePath("/pdv");
  return { ok: true, id };
}

export async function excluirProduto(id: number): Promise<Resultado> {
  const supabase = await criarClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, erro: "Sessão expirada." };

  const { count } = await supabase
    .from("itens_pedido")
    .select("id", { count: "exact", head: true })
    .eq("produto_id", id);

  if ((count ?? 0) > 0)
    return {
      ok: false,
      erro: `Este produto já foi vendido ${count} vez(es). Desative em vez de excluir, senão o relatório perde o histórico.`,
    };

  const { error } = await supabase.from("produtos").delete().eq("id", id);
  if (error) return { ok: false, erro: error.message };

  revalidatePath("/cardapio");
  revalidatePath("/pdv");
  return { ok: true, id };
}
