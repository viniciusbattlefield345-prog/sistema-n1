"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { viaPedido } from "@/lib/cupom";
import { imprimirCru } from "@/lib/impressora";
import { useAoVivo } from "@/lib/aoVivo";
import { reimprimirPedido, tentarImpressaoDeNovo } from "../../mesas/acoes";
import {
  hora,
  nomePagamento,
  numero,
  numeroPedido,
  rotuloPedido,
  telefone,
} from "@/lib/formato";
import type {
  ConfigImpressoras,
  ConfigRestaurante,
  Pedido,
  TrabalhoImpressao,
} from "@/lib/tipos";

/**
 * O cupom de um pedido. A impressão normal já foi pra fila da impressora do
 * balcão quando o pedido foi lançado ou aprovado — aqui dá pra acompanhar,
 * mandar de novo, imprimir direto deste computador ou salvar em PDF.
 */
export function PainelImpressao({
  pedido,
  restaurante,
  impressoras,
  impressoes,
}: {
  pedido: Pedido;
  restaurante: ConfigRestaurante;
  impressoras: ConfigImpressoras;
  impressoes: TrabalhoImpressao[];
}) {
  useAoVivo(["fila_impressao"]);

  const [mensagem, setMensagem] = useState<{ tom: "ok" | "erro"; texto: string } | null>(null);
  const [ocupado, iniciar] = useTransition();

  const ultima = impressoes[0] ?? null;
  const itens = pedido.itens_pedido ?? [];
  const rotulo = rotuloPedido(pedido);

  function mandarPraFila() {
    setMensagem(null);
    iniciar(async () => {
      const r = await reimprimirPedido(pedido.id);
      setMensagem(
        r.ok
          ? { tom: "ok", texto: "Mandado pra impressora do balcão." }
          : { tom: "erro", texto: r.erro },
      );
    });
  }

  async function imprimirAqui() {
    setMensagem(null);
    try {
      await imprimirCru(
        impressoras.impressora,
        viaPedido(pedido, restaurante, impressoras),
        impressoras.vias,
      );
      setMensagem({ tom: "ok", texto: "Impresso por este computador." });
    } catch (e) {
      setMensagem({
        tom: "erro",
        texto: e instanceof Error ? e.message : "Não consegui falar com a impressora.",
      });
    }
  }

  return (
    <div className="folha-raiz mx-auto flex max-w-3xl flex-col gap-6 p-4 lg:p-8">
      <div className="nao-imprimir flex items-start justify-between gap-6">
        <div>
          <span className="fita mb-3">Pedido {numeroPedido(pedido.numero_dia)}</span>
          <h1 className="font-display text-3xl font-extrabold uppercase tracking-wide text-creme">
            {rotulo}
          </h1>
          <p className="text-sm text-creme-suave">
            {pedido.cliente_nome !== rotulo && `${pedido.cliente_nome} · `}
            {hora(pedido.criado_em)}
            {pedido.forma_pagamento && ` · ${nomePagamento(pedido.forma_pagamento)}`}
          </p>
        </div>
        {pedido.tipo === "MESA" && pedido.mesa_id ? (
          <Link href={`/mesas/${pedido.mesa_id}`} className="btn btn-quieto shrink-0">
            Voltar pra mesa
          </Link>
        ) : (
          <Link href="/pdv" className="btn btn-quieto shrink-0">
            Novo pedido
          </Link>
        )}
      </div>

      {/* situação na fila da impressora */}
      <div
        role="status"
        className={
          "nao-imprimir rounded-xl border px-4 py-3 text-sm " +
          (ultima?.status === "ERRO"
            ? "border-cancelado/40 bg-cancelado/10 text-cancelado"
            : ultima?.status === "IMPRESSO"
              ? "border-pronto/40 bg-pronto/10 text-pronto"
              : "border-borda bg-carvao text-creme-suave")
        }
      >
        {!ultima && "Este pedido ainda não foi pra impressora."}
        {ultima?.status === "PENDENTE" &&
          "Na fila da impressora do balcão. Sai assim que a tela Impressão pegar."}
        {ultima?.status === "IMPRIMINDO" && "Imprimindo no balcão…"}
        {ultima?.status === "IMPRESSO" && `Impresso no balcão às ${hora(ultima.atualizado_em)}.`}
        {ultima?.status === "ERRO" && (
          <>
            <strong className="block">Não imprimiu.</strong>
            {ultima.erro}{" "}
            <button
              type="button"
              onClick={() => iniciar(async () => void (await tentarImpressaoDeNovo(ultima.id)))}
              className="underline underline-offset-2"
            >
              Tentar de novo
            </button>
          </>
        )}
      </div>

      {mensagem && (
        <p
          className={
            "nao-imprimir rounded-xl border px-4 py-3 text-sm " +
            (mensagem.tom === "ok"
              ? "border-pronto/40 bg-pronto/10 text-pronto"
              : "border-cancelado/40 bg-cancelado/10 text-cancelado")
          }
        >
          {mensagem.texto}
        </p>
      )}

      <div className="nao-imprimir flex flex-wrap gap-2">
        <button className="btn btn-ouro" onClick={mandarPraFila} disabled={ocupado}>
          Mandar pra impressora do balcão
        </button>
        <button className="btn btn-quieto" onClick={imprimirAqui} disabled={!impressoras.impressora}>
          Imprimir neste computador
        </button>
        <button className="btn btn-quieto" onClick={() => window.print()}>
          Ver / salvar em PDF
        </button>
      </div>

      {/* pré-visualização: o mesmo cupom que sai no papel */}
      <div className="folha cupom w-full max-w-[340px] rounded-lg border border-borda bg-carvao p-4">
        <p className="text-center font-display text-base font-extrabold uppercase tracking-[0.1em] text-ouro">
          {restaurante.nome || "General Burguer"}
        </p>
        {restaurante.endereco && (
          <p className="text-center text-[0.7rem] text-creme-fraco">{restaurante.endereco}</p>
        )}

        <div className="cupom-linha my-2" />
        <p className="text-center font-display text-3xl font-extrabold uppercase text-creme">
          {rotulo}
        </p>
        <p className="text-center font-bold">PEDIDO {numeroPedido(pedido.numero_dia)}</p>
        <div className="cupom-linha my-2" />

        {pedido.cliente_nome !== rotulo && <p className="font-bold uppercase">{pedido.cliente_nome}</p>}
        {pedido.cliente_telefone && (
          <p className="text-creme-suave">{telefone(pedido.cliente_telefone)}</p>
        )}
        {pedido.tipo === "ENTREGA" && (
          <p className="text-[0.72rem] leading-snug text-creme-suave">{pedido.endereco_entrega}</p>
        )}

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
        {Number(pedido.taxa_entrega) > 0 && (
          <>
            <Par rotulo="Subtotal" valor={Number(pedido.subtotal)} />
            <Par rotulo="Taxa de entrega" valor={Number(pedido.taxa_entrega)} />
          </>
        )}
        <div className="mt-1 flex justify-between border-t-2 border-borda-forte pt-1 text-base font-bold">
          <span>TOTAL</span>
          <span className="tabular">{numero(Number(pedido.total))}</span>
        </div>

        <div className="cupom-linha my-2" />
        {pedido.tipo === "MESA" ? (
          <p className="text-center">Entra na conta da mesa</p>
        ) : (
          <>
            <p className="font-bold">
              PAGAMENTO: {pedido.forma_pagamento ? nomePagamento(pedido.forma_pagamento) : "-"}
            </p>
            {pedido.forma_pagamento === "Dinheiro" && Number(pedido.troco_para) > 0 && (
              <>
                <Par rotulo="Troco para" valor={Number(pedido.troco_para)} />
                <div className="flex justify-between text-base font-bold">
                  <span>TROCO</span>
                  <span className="tabular">
                    {numero(Math.max(Number(pedido.troco_para) - Number(pedido.total), 0))}
                  </span>
                </div>
              </>
            )}
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
