import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { clienteServico } from "@/lib/supabase/admin";
import { lerConfiguracoes } from "@/lib/configuracoes";
import { CardapioMesa } from "./CardapioMesa";
import type { Adicional, Categoria, Produto } from "@/lib/tipos";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Cardápio",
  description: "Escolha, envie e acompanhe seu pedido direto da mesa.",
};

/**
 * O cardápio que abre quando o cliente lê o QR da mesa.
 * Sem login: os dados vêm pelo servidor, com a chave de serviço, e só o que
 * o cliente precisa ver (custo do produto, por exemplo, não sai daqui).
 */
export default async function PaginaMesa({ params }: PageProps<"/m/[codigo]">) {
  const { codigo } = await params;
  const sb = clienteServico();

  const { data: mesa } = await sb
    .from("mesas")
    .select("id, numero, codigo, ativo")
    .eq("codigo", codigo)
    .maybeSingle();

  if (!mesa || !mesa.ativo) notFound();

  const [
    { data: caixa },
    { data: categorias },
    { data: produtos },
    { data: adicionais },
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
        "id, categoria_id, nome, descricao, fatias, foto_url, preco_base, ativo, disponivel, ordem, produto_variacoes(*), produto_adicionais(adicional_id, preco)",
      )
      .eq("ativo", true)
      .order("ordem")
      .order("nome"),
    sb.from("adicionais").select("*").eq("ativo", true).order("ordem").order("nome"),
    sb.from("configuracoes").select("chave, valor").eq("chave", "restaurante"),
  ]);

  const { restaurante } = lerConfiguracoes(configs);

  return (
    <CardapioMesa
      mesa={{ numero: mesa.numero, codigo: mesa.codigo }}
      lojaAberta={Boolean(caixa)}
      categorias={(categorias ?? []) as Categoria[]}
      produtos={(produtos ?? []) as Produto[]}
      adicionais={(adicionais ?? []) as Adicional[]}
      instagram={restaurante.instagram}
    />
  );
}
