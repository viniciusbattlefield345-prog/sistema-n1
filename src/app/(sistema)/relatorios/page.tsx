import Link from "next/link";
import { redirect } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/server";
import { usuarioAtual } from "@/lib/supabase/sessao";
import { Cabecalho, Vazio } from "@/components/Cabecalho";
import { FiltroPeriodo } from "@/components/FiltroPeriodo";
import { nomePagamento, reais } from "@/lib/formato";
import {
  buscaDoPeriodo,
  diaCurto,
  diaSp,
  fimIso,
  horaSp,
  inicioIso,
  lerPeriodo,
  somarDias,
} from "@/lib/periodo";
import type { FormaPagamento } from "@/lib/tipos";

export const revalidate = 0;

// Pedido esperando aprovação ou cancelado não é venda.
const FORA_DA_CONTA = '("CANCELADO","AGUARDANDO")';

const NOME_TIPO: Record<string, string> = {
  MESA: "Mesa",
  ENTREGA: "Entrega",
  RETIRADA: "Retirada",
};

export default async function PaginaRelatorios({ searchParams }: PageProps<"/relatorios">) {
  const { p, de, ate } = await searchParams;
  const periodo = lerPeriodo({ p, de, ate }, "hoje");

  const supabase = await criarClienteServidor();
  const user = await usuarioAtual(supabase);

  const { data: perfil } = await supabase
    .from("perfis")
    .select("papel")
    .eq("id", user!.id)
    .single();

  if (perfil?.papel !== "dono") redirect("/mesas");

  const inicio = inicioIso(periodo.de);
  const fim = fimIso(periodo.ate);

  const [
    { data: vendas },
    { data: cancelados },
    { data: pagos },
    { data: contas },
    { data: produtos },
    { data: equipe },
    { data: antes },
  ] = await Promise.all([
    supabase
      .from("pedidos")
      .select(
        "total, desconto, taxa_entrega, forma_pagamento, tipo, origem, criado_em, usuario_id, comanda_id",
      )
      .gte("criado_em", inicio)
      .lt("criado_em", fim)
      .not("status", "in", FORA_DA_CONTA),
    supabase
      .from("pedidos")
      .select("total")
      .gte("criado_em", inicio)
      .lt("criado_em", fim)
      .eq("status", "CANCELADO"),
    // Dinheiro que entrou: o pagamento das contas de mesa, pela hora em que
    // foi recebido. Pedido de entrega e retirada paga no próprio pedido.
    supabase
      .from("pagamentos")
      .select("valor, forma")
      .gte("criado_em", inicio)
      .lt("criado_em", fim),
    // As contas pagas no período, com os pedidos delas. Os pedidos vêm junto
    // porque é só por eles que se descobre quanto do dinheiro recebido hoje
    // é de pedido lançado em outro dia — a mesa que virou a noite.
    supabase
      .from("comandas")
      .select("id, desconto, pedidos(total, status, criado_em)")
      .eq("status", "FECHADA")
      .gte("fechada_em", inicio)
      .lt("fechada_em", fim),
    // A view já agrupa por dia e produto; aqui só somamos o período.
    supabase
      .from("vw_vendas_produto")
      .select("produto, quantidade, faturamento")
      .gte("dia", periodo.de)
      .lt("dia", somarDias(periodo.ate, 1)),
    supabase.from("perfis").select("id, nome"),
    // Mesmo tamanho de período, imediatamente antes: é o "está melhor ou pior".
    supabase
      .from("pedidos")
      .select("total")
      .gte("criado_em", inicioIso(periodo.anterior.de))
      .lt("criado_em", fimIso(periodo.anterior.ate))
      .not("status", "in", FORA_DA_CONTA),
  ]);

  const lista = vendas ?? [];
  const vendido = lista.reduce((s, v) => s + Number(v.total), 0);
  const ticket = lista.length ? vendido / lista.length : 0;
  const vendidoAntes = (antes ?? []).reduce((s, v) => s + Number(v.total), 0);

  const canceladoValor = (cancelados ?? []).reduce((s, c) => s + Number(c.total), 0);
  // Desconto no pedido já está dentro do total dele; o da conta de mesa é
  // dado no fechamento e fica de fora — por isso aparece separado na ponte.
  const descontoPedidos = lista.reduce((s, v) => s + Number(v.desconto), 0);
  const entregas = lista.reduce((s, v) => s + Number(v.taxa_entrega), 0);

  // Entrega e retirada pagam no pedido; mesa paga no fechamento da conta.
  const porPagamento = new Map<string, number>();
  for (const v of lista) {
    if (v.tipo === "MESA" || !v.forma_pagamento) continue;
    const nome = nomePagamento(v.forma_pagamento as FormaPagamento);
    porPagamento.set(nome, (porPagamento.get(nome) ?? 0) + Number(v.total));
  }
  for (const pg of pagos ?? []) {
    const nome = nomePagamento(pg.forma as FormaPagamento);
    porPagamento.set(nome, (porPagamento.get(nome) ?? 0) + Number(pg.valor));
  }
  const recebido = [...porPagamento.values()].reduce((s, v) => s + v, 0);

  /**
   * A ponte entre "vendido" e "recebido".
   *
   * Os dois números respondem perguntas diferentes e por isso quase nunca são
   * iguais: a venda conta pelo dia em que o pedido foi lançado, o caixa conta
   * pelo dia em que o dinheiro entrou. Uma mesa aberta na sexta e paga no
   * domingo aparece na venda de sexta e no caixa de domingo.
   *
   * Sem mostrar essa diferença, a tela parecia errada — "o recebido está
   * maior que o vendido, de onde saiu esse valor?". Sai daqui, e a conta
   * fecha no centavo:
   *
   *   recebido = vendido + de outros dias − ainda em conta aberta − descontos
   */
  const fechadasNoPeriodo = new Set((contas ?? []).map((c) => c.id as number));
  const inicioMs = Date.parse(inicio);

  let deOutrosDias = 0;
  for (const c of contas ?? []) {
    for (const ped of (c.pedidos ?? []) as {
      total: number;
      status: string;
      criado_em: string;
    }[]) {
      if (ped.status === "CANCELADO" || ped.status === "AGUARDANDO") continue;
      if (Date.parse(ped.criado_em) < inicioMs) deOutrosDias += Number(ped.total);
    }
  }

  let emContaAberta = 0;
  for (const v of lista) {
    if (v.tipo !== "MESA" || !v.comanda_id) continue;
    if (!fechadasNoPeriodo.has(v.comanda_id)) emContaAberta += Number(v.total);
  }

  const descontoContas = (contas ?? []).reduce((s, c) => s + Number(c.desconto), 0);
  const aReceber = emContaAberta;

  const porTipo = new Map<string, { qtd: number; valor: number }>();
  const porDia = new Map<string, number>();
  const porHora = new Array<{ qtd: number; valor: number }>(24)
    .fill({ qtd: 0, valor: 0 })
    .map(() => ({ qtd: 0, valor: 0 }));
  const porPessoa = new Map<string, { qtd: number; valor: number }>();
  let doQr = 0;

  for (const v of lista) {
    const valor = Number(v.total);

    const tipo = porTipo.get(v.tipo) ?? { qtd: 0, valor: 0 };
    tipo.qtd++;
    tipo.valor += valor;
    porTipo.set(v.tipo, tipo);

    const dia = diaSp(v.criado_em);
    porDia.set(dia, (porDia.get(dia) ?? 0) + valor);

    const h = porHora[horaSp(v.criado_em)];
    h.qtd++;
    h.valor += valor;

    if (v.origem === "CLIENTE") doQr++;
    // Pedido pelo QR não tem atendente: quem lançou foi o cliente.
    const chave = v.usuario_id ?? "";
    const pessoa = porPessoa.get(chave) ?? { qtd: 0, valor: 0 };
    pessoa.qtd++;
    pessoa.valor += valor;
    porPessoa.set(chave, pessoa);
  }

  const nomes = new Map((equipe ?? []).map((e) => [e.id as string, e.nome as string]));

  const somaProduto = new Map<string, { qtd: number; valor: number }>();
  for (const l of produtos ?? []) {
    const atual = somaProduto.get(l.produto) ?? { qtd: 0, valor: 0 };
    atual.qtd += Number(l.quantidade);
    atual.valor += Number(l.faturamento);
    somaProduto.set(l.produto, atual);
  }
  const ranking = [...somaProduto.entries()].sort((a, b) => b[1].qtd - a[1].qtd).slice(0, 12);

  const basePagamento = Math.max(recebido + aReceber, 1);
  const baseTipo = Math.max(...[...porTipo.values()].map((t) => t.valor), 1);
  const baseDia = Math.max(...[...porDia.values()], 1);
  const basePessoa = Math.max(...[...porPessoa.values()].map((t) => t.valor), 1);
  const picoHora = Math.max(...porHora.map((h) => h.valor), 1);

  const variacao = vendidoAntes > 0 ? ((vendido - vendidoAntes) / vendidoAntes) * 100 : null;

  // Só desenha o gráfico por dia quando há mais de um dia pra comparar.
  const mostrarDias = periodo.dias.length > 1;
  const horasComMovimento = porHora.some((h) => h.qtd > 0);

  return (
    <div className="p-4 lg:p-8">
      <Cabecalho
        fita="Gerência"
        titulo="Relatórios"
        descricao="Escolha o período. Pedido cancelado nunca entra em nenhum número desta tela."
      />

      <FiltroPeriodo key={`${periodo.de}:${periodo.ate}`} periodo={periodo} />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Cartao
          rotulo="Vendido no período"
          valor={reais(vendido)}
          nota={
            variacao === null
              ? `${lista.length} pedidos · pelo dia do pedido`
              : `${lista.length} pedidos · ${variacao >= 0 ? "+" : ""}${variacao.toFixed(0)}% vs período anterior`
          }
          destaque
        />
        <Cartao
          rotulo="Recebido no período"
          valor={reais(recebido)}
          nota="pelo dia em que o dinheiro entrou"
        />
        <Cartao rotulo="Ticket médio" valor={reais(ticket)} nota="por pedido" />
        <Cartao
          rotulo="Pedidos"
          valor={String(lista.length)}
          nota={`${porTipo.get("MESA")?.qtd ?? 0} de mesa · ${doQr} pelo QR`}
        />
      </div>

      {/*
        A ponte entre os dois primeiros cartões.
        Sem ela, "recebido maior que vendido" parece defeito do sistema.
      */}
      <div className="mb-6">
        <Secao
          titulo="De vendido a recebido"
          nota="Venda conta pelo dia do pedido; caixa conta pelo dia do pagamento. Mesa que fica aberta de um dia pro outro cai nos dois dias diferentes — a conta abaixo fecha no centavo."
        >
          {deOutrosDias < 0.009 && emContaAberta < 0.009 && descontoContas < 0.009 ? (
            <p className="text-sm text-creme-suave">
              Tudo que foi vendido neste período também foi recebido neste período. Os dois
              números são iguais: <strong className="tabular text-ouro">{reais(vendido)}</strong>.
            </p>
          ) : (
            <dl className="space-y-2 text-sm">
              <Linha rotulo="Vendido no período" valor={reais(vendido)} />
              {deOutrosDias > 0.009 && (
                <Linha
                  rotulo="+ recebido agora, de pedido de outro dia"
                  valor={reais(deOutrosDias)}
                  destaque
                />
              )}
              {emContaAberta > 0.009 && (
                <Linha
                  rotulo="− vendido agora, ainda na conta de mesa aberta"
                  valor={reais(emContaAberta)}
                />
              )}
              {descontoContas > 0.009 && (
                <Linha rotulo="− desconto dado no fechamento da conta" valor={reais(descontoContas)} />
              )}
              <div className="border-t border-borda pt-2">
                <Linha rotulo="= Recebido no período" valor={reais(recebido)} forte />
              </div>
            </dl>
          )}
        </Secao>
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Secao titulo="Como pagaram" nota="Mesa entra quando a conta é fechada.">
          {porPagamento.size === 0 && aReceber === 0 ? (
            <p className="text-sm text-creme-fraco">Nenhuma venda neste período.</p>
          ) : (
            <>
              <ul className="space-y-3">
                {[...porPagamento.entries()]
                  .sort((a, b) => b[1] - a[1])
                  .map(([forma, valor]) => (
                    <Barra key={forma} rotulo={forma} valor={valor} base={basePagamento} />
                  ))}
                {aReceber > 0.009 && (
                  <Barra
                    rotulo="Ainda na conta das mesas"
                    valor={aReceber}
                    base={basePagamento}
                    apagada
                  />
                )}
              </ul>
              {(descontoPedidos + descontoContas > 0.009 || entregas > 0.009) && (
                <dl className="mt-5 space-y-1.5 border-t border-borda pt-4 text-sm">
                  {descontoPedidos + descontoContas > 0.009 && (
                    <Linha
                      rotulo="Descontos dados"
                      valor={reais(descontoPedidos + descontoContas)}
                    />
                  )}
                  {entregas > 0.009 && (
                    <Linha rotulo="Taxas de entrega cobradas" valor={reais(entregas)} />
                  )}
                </dl>
              )}
            </>
          )}
        </Secao>

        <Secao titulo="Por onde vendeu" nota="Mesa, entrega e retirada no período.">
          {porTipo.size === 0 ? (
            <p className="text-sm text-creme-fraco">Nenhuma venda neste período.</p>
          ) : (
            <ul className="space-y-3">
              {[...porTipo.entries()]
                .sort((a, b) => b[1].valor - a[1].valor)
                .map(([tipo, d]) => (
                  <Barra
                    key={tipo}
                    rotulo={`${NOME_TIPO[tipo] ?? tipo} · ${d.qtd} pedido(s)`}
                    valor={d.valor}
                    base={baseTipo}
                  />
                ))}
            </ul>
          )}
        </Secao>
      </div>

      {mostrarDias && (
        <div className="mb-6">
          <Secao titulo="Venda por dia" nota="Pelo dia em que o pedido foi lançado.">
            <ul className="space-y-2">
              {periodo.dias.map((dia) => (
                <Barra
                  key={dia}
                  rotulo={diaCurto(dia)}
                  valor={porDia.get(dia) ?? 0}
                  base={baseDia}
                  estreita
                />
              ))}
            </ul>
          </Secao>
        </div>
      )}

      {horasComMovimento && (
        <div className="mb-6">
          <Secao
            titulo="Movimento por hora"
            nota="Soma de todos os dias do período — serve pra escalar gente no horário certo."
          >
            <div className="flex items-end gap-1 overflow-x-auto pb-1">
              {porHora.map((h, i) => (
                <div key={i} className="flex min-w-6 flex-1 flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t bg-ouro/80"
                    style={{ height: `${Math.round((h.valor / picoHora) * 96) + (h.valor > 0 ? 2 : 0)}px` }}
                    title={`${i}h — ${h.qtd} pedido(s), ${reais(h.valor)}`}
                  />
                  <span className="tabular text-[10px] text-creme-fraco">{i}</span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-creme-fraco">Hora do dia, 0 a 23.</p>
          </Secao>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Secao
          titulo="Mais vendidos"
          nota="Contado por produto — observação diferente não vira produto diferente."
        >
          {ranking.length === 0 ? (
            <Vazio titulo="Sem vendas" texto="Nenhum produto vendido neste período." />
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
        </Secao>

        <Secao titulo="Quem lançou" nota="Pedido feito pelo celular do cliente não tem atendente.">
          {porPessoa.size === 0 ? (
            <p className="text-sm text-creme-fraco">Nenhuma venda neste período.</p>
          ) : (
            <ul className="space-y-3">
              {[...porPessoa.entries()]
                .sort((a, b) => b[1].valor - a[1].valor)
                .map(([id, d]) => (
                  <Barra
                    key={id || "qr"}
                    rotulo={`${id ? (nomes.get(id) ?? "Conta apagada") : "Cliente pelo QR"} · ${d.qtd} pedido(s)`}
                    valor={d.valor}
                    base={basePessoa}
                  />
                ))}
            </ul>
          )}
        </Secao>
      </div>

      {/*
        Cancelado fica no pé da página, fora dos cartões, e com cara de nota de
        rodapé: é informação de conferência, não faturamento. Misturado ali em
        cima parecia que estava somando em algum lugar — e não soma em nenhum.
      */}
      {(cancelados ?? []).length > 0 && (
        <p className="mt-6 border-t border-borda pt-4 text-xs text-creme-fraco">
          Fora de tudo acima: {(cancelados ?? []).length} pedido(s) cancelado(s) no período,
          somando <span className="tabular">{reais(canceladoValor)}</span> que não entraram em
          nenhum número desta tela.{" "}
          <Link
            href={`/pedidos?${buscaDoPeriodo(periodo)}`}
            className="underline hover:text-ouro"
          >
            Ver quais foram
          </Link>
          .
        </p>
      )}
    </div>
  );
}

function Secao({
  titulo,
  nota,
  children,
}: {
  titulo: string;
  nota?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-borda bg-carvao p-6">
      <h2 className="font-display text-lg font-bold uppercase tracking-wide text-creme">
        {titulo}
      </h2>
      {nota && <p className="mb-4 mt-1 text-xs text-creme-fraco">{nota}</p>}
      {!nota && <div className="mb-4" />}
      {children}
    </section>
  );
}

function Linha({
  rotulo,
  valor,
  destaque,
  forte,
}: {
  rotulo: string;
  valor: string;
  /** A parcela que vem de outro dia: é a resposta de "de onde saiu isso". */
  destaque?: boolean;
  forte?: boolean;
}) {
  return (
    <div className="flex justify-between gap-4">
      <dt className={destaque ? "text-ouro" : "text-creme-suave"}>{rotulo}</dt>
      <dd
        className={
          "tabular shrink-0 " +
          (forte
            ? "font-display text-base font-bold text-ouro"
            : destaque
              ? "font-medium text-ouro"
              : "font-medium text-creme")
        }
      >
        {valor}
      </dd>
    </div>
  );
}

function Barra({
  rotulo,
  valor,
  base,
  apagada,
  estreita,
}: {
  rotulo: string;
  valor: number;
  base: number;
  apagada?: boolean;
  estreita?: boolean;
}) {
  return (
    <li>
      <div className={"flex justify-between text-sm " + (estreita ? "mb-0.5" : "mb-1")}>
        <span className="text-creme-suave">{rotulo}</span>
        <span className="tabular font-medium text-creme">{reais(valor)}</span>
      </div>
      <div className={"overflow-hidden rounded-full bg-breu " + (estreita ? "h-1" : "h-1.5")}>
        <div
          className={"h-full rounded-full " + (apagada ? "bg-borda-forte" : "bg-ouro")}
          style={{ width: `${(valor / base) * 100}%` }}
        />
      </div>
    </li>
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
          "tabular mt-1 font-display text-2xl font-bold " +
          (destaque ? "text-ouro" : "text-creme")
        }
      >
        {valor}
      </p>
      <p className="mt-0.5 text-xs text-creme-suave">{nota}</p>
    </div>
  );
}
