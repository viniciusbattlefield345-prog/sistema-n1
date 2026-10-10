"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Cabecalho, Vazio } from "@/components/Cabecalho";
import { mudarStatus } from "./acoes";
import { useAoVivo } from "@/lib/aoVivo";
import { extraComVezes, hora, minutosDesde, numeroPedido, rotuloPedido } from "@/lib/formato";
import type { Pedido, StatusPedido } from "@/lib/tipos";

/** As três colunas da produção, na ordem em que o pedido anda. */
const COLUNAS: { status: StatusPedido; titulo: string }[] = [
  { status: "PENDENTE", titulo: "Na fila" },
  { status: "EM PREPARO", titulo: "Preparando" },
  { status: "PRONTO", titulo: "Pronto" },
];

/** Depois de pronto, cada tipo de pedido termina de um jeito. */
function proximoPasso(p: Pedido): { status: StatusPedido; rotulo: string } | null {
  switch (p.status) {
    case "PENDENTE":
      return { status: "EM PREPARO", rotulo: "Começar" };
    case "EM PREPARO":
      return { status: "PRONTO", rotulo: "Ficou pronto" };
    case "PRONTO":
      if (p.tipo === "ENTREGA") return { status: "SAIU PARA ENTREGA", rotulo: "Saiu para entrega" };
      return { status: "CONCLUIDO", rotulo: p.tipo === "MESA" ? "Servido na mesa" : "Retirado" };
    case "SAIU PARA ENTREGA":
      return { status: "CONCLUIDO", rotulo: "Entregue" };
    default:
      return null;
  }
}

export function PainelCozinha({ pedidos }: { pedidos: Pedido[] }) {
  const router = useRouter();
  const [, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  // A cozinha não fica apertando F5: pedido aprovado aparece na hora.
  useAoVivo(["pedidos"], 20);

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
        descricao="Atualiza sozinho. Pedido do QR só aparece aqui depois que alguém da equipe aprova."
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
          texto="Assim que um pedido for aprovado ou lançado, ele aparece aqui sozinho."
        >
          <Link href="/mesas" className="btn btn-ouro">
            Ver as mesas
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
                  <h2 className="font-display text-sm font-bold uppercase tracking-[0.14em] text-creme-suave">
                    {coluna.titulo}
                  </h2>
                  <span className="tabular rounded-full bg-madeira px-2 py-0.5 text-xs text-creme-suave">
                    {daColuna.length}
                  </span>
                </div>

                <div className="flex flex-col gap-3">
                  {daColuna.map((p) => {
                    const passo = proximoPasso(p);
                    return (
                      <Ficha
                        key={p.id}
                        pedido={p}
                        rotuloAcao={passo?.rotulo ?? ""}
                        aoAvancar={() => passo && avancar(p.id, passo.status)}
                      />
                    );
                  })}
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
          <h2 className="mb-3 font-display text-sm font-bold uppercase tracking-[0.14em] text-creme-suave">
            Saiu para entrega
          </h2>
          <div className="flex flex-wrap gap-3">
            {saiu.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-3 rounded-xl border border-borda bg-carvao px-4 py-3"
              >
                <span className="font-display text-xl font-bold text-ouro">
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
  const minutos = minutosDesde(pedido.aprovado_em ?? pedido.criado_em);
  // 20 minutos é quando um lanche começa a incomodar quem espera.
  const atrasado = minutos >= 20;
  const rotulo = rotuloPedido(pedido);
  const nome = pedido.cliente_nome !== rotulo ? pedido.cliente_nome : null;

  return (
    <article
      className={
        "rounded-xl border bg-carvao p-4 " +
        (atrasado ? "border-cancelado/60" : "border-borda")
      }
    >
      <header className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className="block font-display text-2xl font-extrabold uppercase leading-none text-ouro">
            {rotulo}
          </span>
          <p className="mt-1 text-xs text-creme-fraco">
            {numeroPedido(pedido.numero_dia)} · {hora(pedido.criado_em)}
          </p>
          {nome && <p className="truncate text-sm font-semibold text-creme">{nome}</p>}
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
                + {(item.item_adicionais ?? []).map(extraComVezes).join(" · ")}
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

      {pedido.observacao && (
        <p className="mb-3 text-xs font-semibold text-preparo">Obs.: {pedido.observacao}</p>
      )}

      <div className="flex gap-2">
        {rotuloAcao && (
          <button className="btn btn-ouro flex-1 py-2 text-sm" onClick={aoAvancar}>
            {rotuloAcao}
          </button>
        )}
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
