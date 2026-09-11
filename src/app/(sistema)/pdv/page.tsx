import Link from "next/link";
import { criarClienteServidor } from "@/lib/supabase/server";
import { PainelPdv } from "./PainelPdv";
import type { Adicional, Bairro, Categoria, Cliente, Mesa, Produto } from "@/lib/tipos";

export default async function PaginaPdv({ searchParams }: PageProps<"/pdv">) {
  const { mesa } = await searchParams;
  const supabase = await criarClienteServidor();

  // O caixa precisa estar aberto pra vender — a regra vive no banco
  // (indice unico caixa_unico_aberto), aqui so consultamos.
  const { data: caixa } = await supabase
    .from("caixas")
    .select("id, aberto_em, valor_abertura")
    .eq("status", "ABERTO")
    .maybeSingle();

  if (!caixa) {
    return (
      <div className="grid min-h-screen place-items-center p-8">
        <div className="max-w-md rounded-2xl border border-borda bg-carvao p-10 text-center">
          <span className="fita mb-5">Caixa fechado</span>
          <h1 className="mb-2 font-display text-2xl font-extrabold uppercase tracking-wide text-creme">
            Abra o caixa para vender
          </h1>
          <p className="mb-7 text-sm text-creme-suave">
            Todo pedido fica amarrado ao caixa do dia. Sem caixa aberto, o
            fechamento não fecha — e o QR das mesas também não aceita pedido.
          </p>
          <Link href="/caixa" className="btn btn-ouro w-full">
            Ir para o caixa
          </Link>
        </div>
      </div>
    );
  }

  const [
    { data: categorias },
    { data: produtos },
    { data: adicionais },
    { data: clientes },
    { data: bairros },
    { data: mesas },
    { data: contas },
  ] = await Promise.all([
    supabase
      .from("categorias")
      .select("*")
      .eq("ativo", true)
      .order("ordem")
      .order("nome"),
    supabase
      .from("produtos")
      .select("*, produto_variacoes(*), produto_adicionais(adicional_id, preco)")
      .eq("ativo", true)
      .order("ordem")
      .order("nome"),
    supabase.from("adicionais").select("*").eq("ativo", true).order("ordem").order("nome"),
    supabase.from("clientes").select("*").order("nome"),
    supabase.from("bairros").select("*").eq("ativo", true).order("nome"),
    supabase.from("mesas").select("id, numero, codigo, ativo").eq("ativo", true).order("numero"),
    supabase.from("comandas").select("mesa_id").eq("status", "ABERTA"),
  ]);

  const mesaInicial =
    typeof mesa === "string" && Number.isInteger(Number(mesa)) ? Number(mesa) : null;

  return (
    <PainelPdv
      caixaId={caixa.id}
      categorias={(categorias ?? []) as Categoria[]}
      produtos={(produtos ?? []) as Produto[]}
      adicionais={(adicionais ?? []) as Adicional[]}
      clientes={(clientes ?? []) as Cliente[]}
      bairros={(bairros ?? []) as Bairro[]}
      mesas={(mesas ?? []) as Mesa[]}
      ocupadas={(contas ?? []).map((c) => c.mesa_id as number)}
      mesaInicial={mesaInicial}
    />
  );
}
