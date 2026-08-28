"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Cabecalho, Vazio } from "@/components/Cabecalho";
import { mudarStatus } from "./acoes";
import { hora, minutosDesde, numeroPedido } from "@/lib/formato";
import type { Pedido, StatusPedido } from "@/lib/tipos";

/** As três colunas da produção, na ordem em que o pedido anda. */
const COLUNAS: { status: StatusPedido; titulo: string; proximo: StatusPedido }[] = [
  { status: "PENDENTE", titulo: "Na fila", proximo: "EM PREPARO" },
  { status: "EM PREPARO", titulo: "Preparando", proximo: "PRONTO" },
  { status: "PRONTO", titulo: "Pronto", proximo: "SAIU PARA ENTREGA" },
];

const ACAO: Partial<Record<StatusPedido, string>> = {
  PENDENTE: "Começar",
  "EM PREPARO": "Ficou pronto",
  PRONTO: "Saiu para entrega",
  "SAIU PARA ENTREGA": "Entregue",
};

export function PainelCozinha({ pedidos }: { pedidos: Pedido[] }) {
  const router = useRouter();
  const [, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  // A cozinha não fica apertando F5: o painel se atualiza sozinho.
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 15000);
    return () => clearInterval(t);
  }, [router]);

  function avancar(id: number, status: StatusPedido) {
    setErro(null);
    iniciar(async () => {
      const r = await mudarStatus(id, status);
      if (!r.ok) setErro(r.erro);
      else router.refresh();
    });
  }

  const saiu = pedidos.filter((p) => p.status === "SAIU PARA ENTREGA");

  return (
    <div className="p-4 lg:p-8">
      <Cabecalho
        fita="Produção"
        titulo="Cozinha"
        descricao="Atualiza sozinho a cada 15 segundos. O número grande é o mesmo que sai no cupom."
      />

      {erro && (
        <p
          role="alert"
          className="mb-5 rounded-lg border border-cancelado/40 bg-cancelado/10 px-3 py-2 text-sm text-cancelado"
        >
          {erro}
        </p>
      )}

      {pedidos.length === 0 ? (
        <Vazio
          titulo="Nenhum pedido na cozinha"
          texto="Assim que a atendente fechar um pedido, ele aparece aqui sozinho."
        >
          <Link href="/pdv" className="btn btn-ouro">
            Ir para o PDV
          </Link>
        </Vazio>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {COLUNAS.map((coluna) => {
            const daColuna = pedidos.filter((p) => p.status === coluna.status);
            return (
              <section
                key={coluna.status}
                className="rounded-2xl border border-borda bg-carvao/40 p-3"
              >
                <div className="mb-3 flex items-center justify-between px-1">
                  <h2 className="font-display text-sm uppercase tracking-[0.14em] text-creme-suave">
                    {coluna.titulo}
                  </h2>
                  <span className="tabular rounded-full bg-madeira px-2 py-0.5 text-xs text-creme-suave">
                    {daColuna.length}
                  </span>
                </div>

                <div className="flex flex-col gap-3">
                  {daColuna.map((p) => (
                    <Ficha
                      key={p.id}
                      pedido={p}
                      rotuloAcao={ACAO[coluna.status]!}
                      aoAvancar={() => avancar(p.id, coluna.proximo)}
                    />
                  ))}
                  {daColuna.length === 0 && (
                    <p className="px-1 py-6 text-center text-xs text-creme-fraco">
                      Vazio
                    </p>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {saiu.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 font-display text-sm uppercase tracking-[0.14em] text-creme-suave">
            Saiu para entrega
          </h2>
          <div className="flex flex-wrap gap-3">
            {saiu.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-3 rounded-xl border border-borda bg-carvao px-4 py-3"
              >
                <span className="font-display text-xl text-ouro">
                  {numeroPedido(p.numero_dia)}
                </span>
                <span className="text-sm text-creme-suave">{p.cliente_nome}</span>
                <button
                  className="btn btn-quieto px-3 py-1.5 text-xs"
                  onClick={() => avancar(p.id, "CONCLUIDO")}
                >
                  Entregue
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Ficha({
  pedido,
  rotuloAcao,
  aoAvancar,
}: {
  pedido: Pedido;
  rotuloAcao: string;
  aoAvancar: () => void;
}) {
  const minutos = minutosDesde(pedido.criado_em);
  // 20 minutos é quando um pedido de almoço começa a incomodar.
  const atrasado = minutos >= 20;

  return (
    <article
      className={
        "rounded-xl border bg-carvao p-4 " +
        (atrasado ? "border-cancelado/60" : "border-borda")
      }
    >
      <header className="mb-3 flex items-start justify-between gap-2">
        <div>
          <span className="font-display text-3xl leading-none text-ouro">
            {numeroPedido(pedido.numero_dia)}
          </span>
          <p className="mt-1 text-sm font-semibold text-creme">
            {pedido.cliente_nome}
          </p>
          <p className="text-xs text-creme-fraco">
            {pedido.tipo_entrega === "ENTREGA" ? "Entrega" : "Retirada"} ·{" "}
            {hora(pedido.criado_em)}
          </p>
        </div>
        <span
          className={
            "tabular shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold " +
            (atrasado
              ? "bg-cancelado/20 text-cancelado"
              : "bg-madeira text-creme-suave")
          }
        >
          {minutos} min
        </span>
      </header>

      <ul className="mb-3 space-y-1.5 border-t border-borda pt-3 text-sm">
        {(pedido.itens_pedido ?? []).map((item) => (
          <li key={item.id}>
            <span className="font-bold text-ouro">{Number(item.quantidade)}x </span>
            <span className="font-medium text-creme">
              {item.produto_nome}
              {item.variacao_nome && ` (${item.variacao_nome})`}
            </span>
            {(item.item_adicionais ?? []).length > 0 && (
              <p className="pl-6 text-xs leading-snug text-creme-suave">
                {(item.item_adicionais ?? []).map((a) => a.nome).join(" · ")}
              </p>
            )}
            {item.observacao && (
              <p className="pl-6 text-xs font-semibold text-preparo">
                {item.observacao}
              </p>
            )}
          </li>
        ))}
      </ul>

      <div className="flex gap-2">
        <button className="btn btn-ouro flex-1 py-2 text-sm" onClick={aoAvancar}>
          {rotuloAcao}
        </button>
        <Link
          href={`/imprimir/${pedido.id}`}
          className="btn btn-quieto px-3 py-2 text-sm"
          title="Reimprimir"
        >
          Imprimir
        </Link>
      </div>
    </article>
  );
}
