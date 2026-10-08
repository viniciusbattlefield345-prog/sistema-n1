import type { Metadata } from "next";
import { clienteServico } from "@/lib/supabase/admin";
import { lerConfiguracoes } from "@/lib/configuracoes";
import { CardapioEntrega } from "./CardapioEntrega";
import type { BairroAtendido } from "./dados";
import type { Adicional, Categoria, Produto } from "@/lib/tipos";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Peça pelo delivery",
  description: "Monte seu pedido e receba em casa, ou retire na loja.",
};

/**
 * O link que a lanchonete compartilha. Sem login e sem QR: qualquer um abre.
 *
 * Igual ao cardápio da mesa, os dados vêm pelo servidor com a chave de
 * serviço e só o que o cliente precisa ver sai daqui — custo de produto, por
 * exemplo, não passa.
 */
export default async function PaginaPedir() {
  const sb = clienteServico();

  const [
    { data: caixa },
    { data: categorias },
    { data: produtos },
    { data: adicionais },
    { data: bairros },
    { data: configs },
  ] = await Promise.all([
    sb.from("caixas").select("id").eq("status", "ABERTO").maybeSingle(),
    sb
      .from("categorias")
      .select("id, nome, descricao, ordem, ativo")
      .eq("ativo", true)
      .order("ordem")
      .order("nome"),
    sb
      .from("produtos")
      .select(
        "id, categoria_id, nome, descricao, foto_url, preco_base, ativo, disponivel, ordem, produto_variacoes(*), produto_adicionais(adicional_id, preco)",
      )
      .eq("ativo", true)
      .order("ordem")
      .order("nome"),
    sb.from("adicionais").select("*").eq("ativo", true).order("ordem").order("nome"),
    // Bairro desativado não aparece: é assim que se diz "aqui a gente não entrega".
    sb.from("bairros").select("id, nome, taxa").eq("ativo", true).order("nome"),
    sb.from("configuracoes").select("chave, valor").eq("chave", "restaurante"),
  ]);

  const { restaurante } = lerConfiguracoes(configs);

  return (
    <CardapioEntrega
      lojaAberta={Boolean(caixa)}
      categorias={(categorias ?? []) as Categoria[]}
      produtos={(produtos ?? []) as Produto[]}
      adicionais={(adicionais ?? []) as Adicional[]}
      bairros={(bairros ?? []) as BairroAtendido[]}
      instagram={restaurante.instagram}
      telefoneLoja={restaurante.telefone}
    />
  );
}
