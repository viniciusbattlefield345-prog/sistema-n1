"use client";

import Link from "next/link";
import { useState } from "react";
import { Cabecalho, Vazio } from "@/components/Cabecalho";
import { CartaoAprovacao } from "../mesas/CartaoAprovacao";
import { CartaoEntrega } from "./CartaoEntrega";
import { useAoVivo } from "@/lib/aoVivo";
import { reais } from "@/lib/formato";
import type { Pedido } from "@/lib/tipos";

/**
 * A tela de tele-entrega: o que chegou pelo link, em ordem de urgência.
 *
 * Separada da tela de Mesas de propósito — são dois ritmos diferentes. Na
 * mesa o cliente está sentado esperando; aqui ele está em casa, e o que
 * importa é endereço, troco e quem já saiu pra rua.
 */
export function PainelEntregas({
  pedidos,
  bairrosAtivos,
  caixaAberto,
}: {
  pedidos: Pedido[];
  bairrosAtivos: number;
  caixaAberto: boolean;
}) {
  useAoVivo(["pedidos"], 10);

  const esperando = pedidos.filter((p) => p.status === "AGUARDANDO");
  const naCozinha = pedidos.filter((p) => p.status === "PENDENTE" || p.status === "EM PREPARO");
  const prontos = pedidos.filter((p) => p.status === "PRONTO");
  const naRua = pedidos.filter((p) => p.status === "SAIU PARA ENTREGA");
  const entregues = pedidos.filter((p) => p.status === "CONCLUIDO");

  const faturado = entregues.reduce((s, p) => s + Number(p.total), 0);
  const vazio = pedidos.length === 0;

  return (
    <div className="p-4 lg:p-8">
      <Cabecalho
        fita="Delivery"
        titulo="Entregas"
        descricao="Pedido feito pelo link chega aqui primeiro. Aprovou, sai o cupom e a cozinha começa."
      >
        <BotaoLink />
      </Cabecalho>

      <div className="mb-5 space-y-2">
        {!caixaAberto && (
          <Aviso tom="perigo">
            <strong>Caixa fechado:</strong> o link não aceita pedido nenhum agora.{" "}
            <Link href="/caixa" className="underline underline-offset-2">
              Abrir o caixa
            </Link>
          </Aviso>
        )}
        {bairrosAtivos === 0 && (
          <Aviso tom="perigo">
            <strong>Nenhum bairro liberado:</strong> ninguém consegue pedir entrega pelo
            link — só retirada.{" "}
            <Link href="/bairros" className="underline underline-offset-2">
              Liberar bairros e taxas
            </Link>
          </Aviso>
        )}
        {bairrosAtivos > 0 && bairrosAtivos < 5 && (
          <Aviso tom="alerta">
            Só <strong>{bairrosAtivos} bairro(s)</strong> liberado(s) pra entrega. Quem
            mora fora deles não consegue concluir o pedido.{" "}
            <Link href="/bairros" className="underline underline-offset-2">
              Ver bairros
            </Link>
          </Aviso>
        )}
      </div>

      {esperando.length > 0 && (
        <Secao
          titulo={`Esperando aprovação (${esperando.length})`}
          pulsando
          cor="text-ouro"
        >
          {esperando.map((p, i) => (
            <CartaoAprovacao key={p.id} pedido={p} indice={i} />
          ))}
        </Secao>
      )}

      {prontos.length > 0 && (
        <Secao titulo={`Prontos pra sair (${prontos.length})`} cor="text-pronto">
          {prontos.map((p, i) => (
            <CartaoEntrega key={p.id} pedido={p} indice={i} />
          ))}
        </Secao>
      )}

      {naRua.length > 0 && (
        <Secao titulo={`A caminho (${naRua.length})`} cor="text-pronto">
          {naRua.map((p, i) => (
            <CartaoEntrega key={p.id} pedido={p} indice={i} />
          ))}
        </Secao>
      )}

      {naCozinha.length > 0 && (
        <Secao titulo={`Na cozinha (${naCozinha.length})`} cor="text-preparo">
          {naCozinha.map((p, i) => (
            <CartaoEntrega key={p.id} pedido={p} indice={i} />
          ))}
        </Secao>
      )}

      {entregues.length > 0 && (
        <p className="mt-2 text-sm text-creme-suave">
          <strong className="text-creme">{entregues.length}</strong> entregue(s) nas últimas
          18h · <span className="tabular">{reais(faturado)}</span>
        </p>
      )}

      {vazio && (
        <Vazio
          titulo="Nenhum pedido de delivery ainda"
          texto="Compartilhe o link com os clientes. Assim que alguém pedir, aparece aqui na hora."
        >
          <BotaoLink destaque />
        </Vazio>
      )}
    </div>
  );
}

function Secao({
  titulo,
  cor,
  pulsando = false,
  children,
}: {
  titulo: string;
  cor: string;
  pulsando?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-8" aria-live={pulsando ? "polite" : undefined}>
      <h2
        className={
          "mb-3 flex items-center gap-2 font-display text-sm font-bold uppercase tracking-[0.14em] " +
          cor
        }
      >
        {pulsando && (
          <span className="relative flex size-2.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-ouro opacity-75" />
            <span className="relative inline-flex size-2.5 rounded-full bg-ouro" />
          </span>
        )}
        {titulo}
      </h2>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{children}</div>
    </section>
  );
}

/** O link é o produto aqui: tem que estar a um toque de ser compartilhado. */
function BotaoLink({ destaque = false }: { destaque?: boolean }) {
  const [copiou, setCopiou] = useState(false);

  async function copiar() {
    const endereco = `${window.location.origin}/pedir`;
    try {
      await navigator.clipboard.writeText(endereco);
      setCopiou(true);
      setTimeout(() => setCopiou(false), 2500);
    } catch {
      // navegador sem permissão de área de transferência: mostra pra copiar na mão
      window.prompt("Copie o link do delivery:", endereco);
    }
  }

  return (
    <button
      type="button"
      onClick={copiar}
      className={"btn px-3 py-2 text-sm " + (destaque ? "btn-ouro" : "btn-quieto")}
    >
      {copiou ? "Link copiado!" : "Copiar link do delivery"}
    </button>
  );
}

function Aviso({ tom, children }: { tom: "perigo" | "alerta"; children: React.ReactNode }) {
  return (
    <p
      role="status"
      className={
        "rounded-xl border px-4 py-3 text-sm " +
        (tom === "perigo"
          ? "border-cancelado/40 bg-cancelado/10 text-cancelado"
          : "border-ouro/40 bg-ouro/10 text-ouro")
      }
    >
      {children}
    </p>
  );
}
