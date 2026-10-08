"use client";

import { useState } from "react";
import { Folha } from "./Folha";
import { Foto } from "./Foto";
import { Passo } from "./Passo";
import { reais } from "@/lib/formato";
import type { Adicional, ItemCarrinho, Produto } from "@/lib/tipos";

/**
 * A folha que abre quando o cliente toca num produto: tamanho, adicionais,
 * observação e quantidade. Serve tanto o cardápio da mesa quanto o do link
 * de entrega — o produto é o mesmo nos dois.
 */
export function EscolhaProduto({
  produto,
  adicionais,
  lojaAberta,
  saindo,
  aoFechar,
  aoAdicionar,
}: {
  produto: Produto;
  adicionais: Adicional[];
  lojaAberta: boolean;
  saindo: boolean;
  aoFechar: () => void;
  aoAdicionar: (item: ItemCarrinho) => void;
}) {
  const variacoes = produto.produto_variacoes ?? [];
  const permitidos = new Set((produto.produto_adicionais ?? []).map((p) => p.adicional_id));
  const extras = adicionais.filter((a) => permitidos.has(a.id));

  const [variacaoId, setVariacaoId] = useState<number | null>(variacoes[0]?.id ?? null);
  const [escolhidos, setEscolhidos] = useState<number[]>([]);
  const [quantidade, setQuantidade] = useState(1);
  const [observacao, setObservacao] = useState("");

  const variacao = variacoes.find((v) => v.id === variacaoId) ?? null;
  const precoUnitario = Number(variacao ? variacao.preco : produto.preco_base);
  const marcados = extras.filter((a) => escolhidos.includes(a.id));
  const total =
    (precoUnitario + marcados.reduce((s, a) => s + Number(a.preco), 0)) * quantidade;

  function confirmar() {
    aoAdicionar({
      chave: crypto.randomUUID(),
      produto_id: produto.id,
      produto_nome: produto.nome,
      variacao_id: variacao?.id ?? null,
      variacao_nome: variacao?.nome ?? null,
      preco_unitario: precoUnitario,
      quantidade,
      observacao: observacao.trim(),
      adicionais: marcados.map((a) => ({
        adicional_id: a.id,
        nome: a.nome,
        preco: Number(a.preco),
      })),
    });
  }

  return (
    <Folha rotulo={produto.nome} saindo={saindo} aoFechar={aoFechar}>
      <div className="flex-1 overflow-y-auto pb-4">
        {produto.foto_url && <Foto url={produto.foto_url} className="aspect-[4/3] w-full" />}
        <div className="px-5 pt-5">
          <h2 className="font-display text-xl font-extrabold uppercase leading-tight text-ouro">
            {produto.nome}
          </h2>
          {produto.descricao && (
            <p className="mt-2 text-sm leading-relaxed text-creme-suave">{produto.descricao}</p>
          )}
        </div>

        {/* O espaçamento fica num div por fora: padding de fieldset não empurra a legend. */}
        {variacoes.length > 0 && (
          <div className="px-5 pt-5">
            <fieldset>
              <legend className="rotulo">Tamanho</legend>
              <div className="divide-y divide-borda overflow-hidden rounded-2xl border border-borda">
                {variacoes.map((v) => (
                  <label
                    key={v.id}
                    className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3.5"
                  >
                    <span className="flex items-center gap-3 text-sm">
                      <input
                        type="radio"
                        name="tamanho"
                        className="size-5 accent-ouro"
                        checked={variacaoId === v.id}
                        onChange={() => setVariacaoId(v.id)}
                      />
                      {v.nome}
                    </span>
                    <span className="tabular text-sm text-creme-suave">
                      {reais(Number(v.preco))}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
        )}

        {extras.length > 0 && (
          <div className="px-5 pt-5">
            <fieldset>
              <legend className="rotulo">Adicionais</legend>
              <div className="divide-y divide-borda overflow-hidden rounded-2xl border border-borda">
                {extras.map((a) => {
                  const marcado = escolhidos.includes(a.id);
                  return (
                    <label
                      key={a.id}
                      className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3.5"
                    >
                      <span className="flex items-center gap-3 text-sm">
                        <input
                          type="checkbox"
                          className="size-5 accent-ouro"
                          checked={marcado}
                          onChange={() =>
                            setEscolhidos((atual) =>
                              marcado ? atual.filter((id) => id !== a.id) : [...atual, a.id],
                            )
                          }
                        />
                        {a.nome}
                      </span>
                      {Number(a.preco) > 0 && (
                        <span className="tabular text-sm text-creme-suave">
                          + {reais(Number(a.preco))}
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          </div>
        )}

        <div className="px-5 pt-5">
          <label className="rotulo" htmlFor="item-obs">
            Alguma observação?
          </label>
          <textarea
            id="item-obs"
            rows={2}
            maxLength={140}
            className="campo resize-none"
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            placeholder="Ex.: sem cebola, carne bem passada"
          />
        </div>
      </div>

      <footer className="flex items-center gap-3 border-t border-borda px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
        <div className="flex items-center gap-2">
          <Passo
            rotulo="Diminuir quantidade"
            aoTocar={() => setQuantidade((q) => Math.max(1, q - 1))}
          >
            −
          </Passo>
          <span className="tabular w-6 text-center font-display text-lg font-bold">
            {quantidade}
          </span>
          <Passo
            rotulo="Aumentar quantidade"
            aoTocar={() => setQuantidade((q) => Math.min(99, q + 1))}
          >
            +
          </Passo>
        </div>
        <button
          type="button"
          className="btn btn-ouro flex-1 justify-between px-4 py-3.5"
          onClick={confirmar}
          disabled={!lojaAberta}
        >
          <span>{lojaAberta ? "Adicionar" : "Fechado agora"}</span>
          <span className="tabular">{reais(total)}</span>
        </button>
      </footer>
    </Folha>
  );
}
