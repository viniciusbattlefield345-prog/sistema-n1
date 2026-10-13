import Link from "next/link";
import { notFound } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/server";
import { PainelPdv } from "./PainelPdv";
import type {
  Adicional,
  Bairro,
  Categoria,
  Cliente,
  Mesa,
  Pedido,
  Produto,
} from "@/lib/tipos";

export const revalidate = 0;

export default async function PaginaPdv({ searchParams }: PageProps<"/pdv">) {
  const { mesa, pedido } = await searchParams;
  const supabase = await criarClienteServidor();

  /**
   * `?pedido=<id>` abre o PDV em cima de um pedido que já existe, pra
   * acrescentar o que o cliente pediu depois. Serve pra mesa, entrega e
   * retirada: o cardápio é o mesmo, e é aqui que ele mora.
   */
  const alvoId =
    typeof pedido === "string" && Number.isInteger(Number(pedido)) ? Number(pedido) : null;

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

  let pedidoEditando: Pedido | null = null;
  if (alvoId !== null) {
    const { data } = await supabase
      .from("pedidos")
      .select("*, mesas(numero), itens_pedido(*, item_adicionais(*))")
      .eq("id", alvoId)
      .maybeSingle();
    if (!data) notFound();
    pedidoEditando = data as Pedido;

    // Cancelado não recebe item: a volta é reabrir o pedido, e isso tem
    // botão próprio. Dizer isso aqui é melhor que deixar salvar e falhar.
    if (pedidoEditando.status === "CANCELADO")
      return (
        <div className="grid min-h-screen place-items-center p-8">
          <div className="max-w-md rounded-2xl border border-borda bg-carvao p-10 text-center">
            <span className="fita mb-5">Pedido cancelado</span>
            <h1 className="mb-2 font-display text-2xl font-extrabold uppercase tracking-wide text-creme">
              Reabra o pedido primeiro
            </h1>
            <p className="mb-7 text-sm text-creme-suave">
              Esse pedido está cancelado e fora da conta. Reabra ele na tela de Pedidos e
              depois volte pra acrescentar o que falta.
            </p>
            <Link href="/pedidos" className="btn btn-ouro w-full">
              Ir para Pedidos
            </Link>
          </div>
        </div>
      );
  }

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
      pedidoEditando={pedidoEditando}
    />
  );
}
