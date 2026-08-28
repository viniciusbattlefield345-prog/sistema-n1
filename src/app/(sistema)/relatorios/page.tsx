import { redirect } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/server";
import { Cabecalho, Vazio } from "@/components/Cabecalho";
import { reais } from "@/lib/formato";
import type { FormaPagamento } from "@/lib/tipos";

export const revalidate = 0;

/** Meia-noite de hoje no fuso de São Paulo, em ISO. */
function inicioDoDia(diasAtras = 0) {
  const agora = new Date();
  const saoPaulo = new Date(
    agora.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }),
  );
  saoPaulo.setHours(0, 0, 0, 0);
  saoPaulo.setDate(saoPaulo.getDate() - diasAtras);
  const desvio = agora.getTime() - saoPaulo.getTime();
  return new Date(agora.getTime() - desvio).toISOString();
}

export default async function PaginaRelatorios() {
  const supabase = await criarClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: perfil } = await supabase
    .from("perfis")
    .select("papel")
    .eq("id", user!.id)
    .single();

  if (perfil?.papel !== "dono") redirect("/pdv");

  const [{ data: hoje }, { data: mes }, { data: top }] = await Promise.all([
    supabase
      .from("pedidos")
      .select("total, forma_pagamento, tipo_entrega")
      .gte("criado_em", inicioDoDia())
      .neq("status", "CANCELADO"),
    supabase
      .from("pedidos")
      .select("total, criado_em")
      .gte("criado_em", inicioDoDia(29))
      .neq("status", "CANCELADO"),
    supabase
      .from("vw_vendas_produto")
      .select("produto, quantidade, faturamento")
      .gte("dia", inicioDoDia(29)),
  ]);

  const pedidosHoje = hoje ?? [];
  const totalHoje = pedidosHoje.reduce((s, p) => s + Number(p.total), 0);
  const ticket = pedidosHoje.length ? totalHoje / pedidosHoje.length : 0;

  const totalMes = (mes ?? []).reduce((s, p) => s + Number(p.total), 0);

  const porPagamento = new Map<string, number>();
  for (const p of pedidosHoje) {
    const f = (p.forma_pagamento as FormaPagamento) ?? "—";
    porPagamento.set(f, (porPagamento.get(f) ?? 0) + Number(p.total));
  }

  const entregas = pedidosHoje.filter((p) => p.tipo_entrega === "ENTREGA").length;

  // A view já agrupa por dia; aqui somamos os 30 dias por produto.
  const somaProduto = new Map<string, { qtd: number; valor: number }>();
  for (const l of top ?? []) {
    const atual = somaProduto.get(l.produto) ?? { qtd: 0, valor: 0 };
    atual.qtd += Number(l.quantidade);
    atual.valor += Number(l.faturamento);
    somaProduto.set(l.produto, atual);
  }
  const ranking = [...somaProduto.entries()]
    .sort((a, b) => b[1].qtd - a[1].qtd)
    .slice(0, 10);

  return (
    <div className="p-8">
      <Cabecalho
        fita="Gerência"
        titulo="Relatórios"
        descricao="Hoje e os últimos 30 dias. Pedido cancelado não entra em nenhuma conta."
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Cartao rotulo="Vendas de hoje" valor={reais(totalHoje)} nota={`${pedidosHoje.length} pedidos`} destaque />
        <Cartao rotulo="Ticket médio" valor={reais(ticket)} nota="hoje" />
        <Cartao rotulo="Entregas hoje" valor={String(entregas)} nota={`de ${pedidosHoje.length} pedidos`} />
        <Cartao rotulo="Últimos 30 dias" valor={reais(totalMes)} nota={`${(mes ?? []).length} pedidos`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-borda bg-carvao p-6">
          <h2 className="mb-4 font-display text-lg uppercase tracking-wide text-creme">
            Como pagaram hoje
          </h2>
          {porPagamento.size === 0 ? (
            <p className="text-sm text-creme-fraco">Nenhuma venda hoje ainda.</p>
          ) : (
            <ul className="space-y-3">
              {[...porPagamento.entries()]
                .sort((a, b) => b[1] - a[1])
                .map(([forma, valor]) => (
                  <li key={forma}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="text-creme-suave">{forma}</span>
                      <span className="tabular font-medium text-creme">
                        {reais(valor)}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-breu">
                      <div
                        className="h-full rounded-full bg-ouro"
                        style={{ width: `${totalHoje ? (valor / totalHoje) * 100 : 0}%` }}
                      />
                    </div>
                  </li>
                ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-borda bg-carvao p-6">
          <h2 className="mb-1 font-display text-lg uppercase tracking-wide text-creme">
            Mais vendidos
          </h2>
          <p className="mb-4 text-xs text-creme-fraco">
            Últimos 30 dias, contado por produto — não por texto, então observação
            diferente não vira produto diferente.
          </p>
          {ranking.length === 0 ? (
            <Vazio titulo="Sem vendas ainda" texto="O ranking aparece depois do primeiro pedido." />
          ) : (
            <ol className="space-y-2">
              {ranking.map(([produto, d], i) => (
                <li key={produto} className="flex items-baseline gap-3 text-sm">
                  <span className="tabular w-5 text-right font-display text-creme-fraco">
                    {i + 1}
                  </span>
                  <span className="flex-1 text-creme">{produto}</span>
                  <span className="tabular text-creme-suave">{d.qtd}x</span>
                  <span className="tabular w-24 text-right font-medium text-ouro">
                    {reais(d.valor)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}

function Cartao({
  rotulo,
  valor,
  nota,
  destaque,
}: {
  rotulo: string;
  valor: string;
  nota: string;
  destaque?: boolean;
}) {
  return (
    <div
      className={
        "rounded-2xl border p-5 " +
        (destaque ? "border-ouro/40 bg-ouro/5" : "border-borda bg-carvao")
      }
    >
      <p className="text-xs uppercase tracking-wide text-creme-fraco">{rotulo}</p>
      <p
        className={
          "tabular mt-1 font-display text-2xl " +
          (destaque ? "text-ouro" : "text-creme")
        }
      >
        {valor}
      </p>
      <p className="mt-0.5 text-xs text-creme-suave">{nota}</p>
    </div>
  );
}
