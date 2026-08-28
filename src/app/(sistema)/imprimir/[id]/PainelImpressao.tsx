"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { viaCozinha, viaEntrega } from "@/lib/cupom";
import { imprimirCru } from "@/lib/impressora";
import { numero, numeroPedido, hora, telefone } from "@/lib/formato";
import type { ConfigImpressoras, ConfigRestaurante, Pedido } from "@/lib/tipos";

type Estado = "pronto" | "imprimindo" | "impresso" | "erro";

export function PainelImpressao({
  pedido,
  restaurante,
  impressoras,
}: {
  pedido: Pedido;
  restaurante: ConfigRestaurante;
  impressoras: ConfigImpressoras;
}) {
  const [estado, setEstado] = useState<Estado>("pronto");
  const [mensagem, setMensagem] = useState("");
  const [jaTentou, setJaTentou] = useState(false);

  const imprimir = useCallback(
    async (quais: "tudo" | "cozinha" | "entrega") => {
      setEstado("imprimindo");
      setMensagem("");
      try {
        if (quais !== "entrega") {
          await imprimirCru(
            impressoras.cozinha,
            viaCozinha(pedido, impressoras),
            impressoras.vias_cozinha,
          );
        }
        if (quais !== "cozinha") {
          await imprimirCru(
            impressoras.entrega,
            viaEntrega(pedido, restaurante, impressoras),
            impressoras.vias_entrega,
          );
        }
        setEstado("impresso");
      } catch (e) {
        setEstado("erro");
        setMensagem(
          e instanceof Error ? e.message : "Não consegui falar com a impressora.",
        );
      }
    },
    [pedido, restaurante, impressoras],
  );

  // Imprime sozinho ao abrir: o fluxo normal é fechar o pedido e o papel sair.
  useEffect(() => {
    if (jaTentou) return;
    setJaTentou(true);
    void imprimir("tudo");
  }, [jaTentou, imprimir]);

  const itens = pedido.itens_pedido ?? [];

  return (
    <div className="folha-raiz mx-auto flex max-w-3xl flex-col gap-6 p-4 lg:p-8">
      <div className="nao-imprimir flex items-start justify-between gap-6">
        <div>
          <span className="fita mb-3">Pedido {numeroPedido(pedido.numero_dia)}</span>
          <h1 className="font-display text-3xl uppercase tracking-wide text-creme">
            {pedido.cliente_nome}
          </h1>
          <p className="text-sm text-creme-suave">
            {pedido.tipo_entrega === "ENTREGA" ? "Entrega" : "Retirada"} ·{" "}
            {hora(pedido.criado_em)} · {pedido.forma_pagamento}
          </p>
        </div>
        <Link href="/pdv" className="btn btn-quieto shrink-0">
          Novo pedido
        </Link>
      </div>

      {/* estado da impressão */}
      <div
        role="status"
        className={
          "nao-imprimir rounded-xl border px-4 py-3 text-sm " +
          (estado === "erro"
            ? "border-cancelado/40 bg-cancelado/10 text-cancelado"
            : estado === "impresso"
              ? "border-pronto/40 bg-pronto/10 text-pronto"
              : "border-borda bg-carvao text-creme-suave")
        }
      >
        {estado === "imprimindo" && "Enviando para a impressora…"}
        {estado === "impresso" && "Cupom impresso. Pode montar o pedido."}
        {estado === "pronto" && "Pronto para imprimir."}
        {estado === "erro" && (
          <>
            <strong className="block">Não imprimiu.</strong>
            {mensagem}
            <button
              onClick={() => window.print()}
              className="mt-2 block underline underline-offset-2"
            >
              Imprimir pelo navegador ou salvar em PDF
            </button>
          </>
        )}
      </div>

      <div className="nao-imprimir flex flex-wrap gap-2">
        <button
          className="btn btn-ouro"
          onClick={() => imprimir("tudo")}
          disabled={estado === "imprimindo"}
        >
          Imprimir as duas vias
        </button>
        <button
          className="btn btn-quieto"
          onClick={() => imprimir("cozinha")}
          disabled={estado === "imprimindo"}
        >
          Só cozinha
        </button>
        <button
          className="btn btn-quieto"
          onClick={() => imprimir("entrega")}
          disabled={estado === "imprimindo"}
        >
          Só entrega
        </button>
        <button className="btn btn-quieto" onClick={() => window.print()}>
          Ver / salvar em PDF
        </button>
      </div>

      {/* pré-visualização: o mesmo cupom que sai no papel */}
      <div className="folha cupom w-full max-w-[340px] rounded-lg border border-borda bg-carvao p-4">
        <p className="text-center font-display text-base uppercase tracking-[0.1em] text-ouro">
          {restaurante?.nome ?? "N°1 Restaurante e Choperia"}
        </p>
        <p className="text-center text-[0.7rem] text-creme-fraco">
          {restaurante?.endereco}
        </p>

        <div className="cupom-linha my-2" />
        <p className="text-center font-display text-3xl font-bold text-creme">
          {numeroPedido(pedido.numero_dia)}
        </p>
        <div className="cupom-linha my-2" />

        <p className="font-bold uppercase">{pedido.cliente_nome}</p>
        {pedido.cliente_telefone && (
          <p className="text-creme-suave">{telefone(pedido.cliente_telefone)}</p>
        )}
        <p className="text-[0.72rem] leading-snug text-creme-suave">
          {pedido.endereco_entrega}
        </p>

        <div className="cupom-linha-forte my-2" />

        {itens.map((item) => {
          const extras = item.item_adicionais ?? [];
          const soma = extras.reduce((s, e) => s + Number(e.preco) * e.quantidade, 0);
          const totalLinha =
            Number(item.quantidade) * (Number(item.preco_unitario) + soma);
          return (
            <div key={item.id} className="mb-1.5">
              <div className="flex items-start gap-2">
                <span className="w-7 shrink-0 font-bold">
                  {Number(item.quantidade)}x
                </span>
                <span className="min-w-0 flex-1">
                  {item.produto_nome}
                  {item.variacao_nome && ` (${item.variacao_nome})`}
                </span>
                <span className="w-[62px] shrink-0 text-right">
                  {numero(totalLinha)}
                </span>
              </div>
              {extras.map((e) => (
                <p key={e.id} className="pl-7 text-[0.7rem] text-creme-suave">
                  + {e.nome}
                </p>
              ))}
              {item.observacao && (
                <p className="pl-7 text-[0.7rem] italic text-preparo">
                  obs: {item.observacao}
                </p>
              )}
            </div>
          );
        })}

        <div className="cupom-linha my-2" />
        <Par rotulo="Subtotal" valor={Number(pedido.subtotal)} />
        {Number(pedido.taxa_entrega) > 0 && (
          <Par rotulo="Taxa de entrega" valor={Number(pedido.taxa_entrega)} />
        )}
        <div className="mt-1 flex justify-between border-t-2 border-borda-forte pt-1 text-base font-bold">
          <span>TOTAL</span>
          <span className="tabular">{numero(Number(pedido.total))}</span>
        </div>

        <div className="cupom-linha my-2" />
        <p className="font-bold">PAGAMENTO: {pedido.forma_pagamento}</p>
        {pedido.forma_pagamento === "Dinheiro" && Number(pedido.troco_para) > 0 && (
          <>
            <Par rotulo="Levar troco para" valor={Number(pedido.troco_para)} />
            <div className="flex justify-between text-base font-bold">
              <span>TROCO</span>
              <span className="tabular">
                {numero(Math.max(Number(pedido.troco_para) - Number(pedido.total), 0))}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Par({ rotulo, valor }: { rotulo: string; valor: number }) {
  return (
    <div className="flex justify-between text-creme-suave">
      <span>{rotulo}</span>
      <span className="tabular">{numero(valor)}</span>
    </div>
  );
}
