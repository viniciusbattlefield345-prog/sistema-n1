"use client";

import { useState, useTransition } from "react";
import { Cabecalho, Vazio } from "@/components/Cabecalho";
import { FormularioProduto } from "./FormularioProduto";
import { alternarDisponivel, excluirProduto } from "./acoes";
import { reais } from "@/lib/formato";
import type { Adicional, Categoria, Produto } from "@/lib/tipos";

export function ListaProdutos({
  produtos,
  categorias,
  adicionais,
}: {
  produtos: Produto[];
  categorias: Categoria[];
  adicionais: Adicional[];
}) {
  const [editando, setEditando] = useState<Produto | null | undefined>(undefined);
  const [erro, setErro] = useState<string | null>(null);
  const [, iniciar] = useTransition();

  const nomeCategoria = new Map(categorias.map((c) => [c.id, c.nome]));

  function alternar(p: Produto) {
    setErro(null);
    iniciar(async () => {
      const r = await alternarDisponivel(p.id, !p.disponivel);
      if (!r.ok) setErro(r.erro);
    });
  }

  function remover(p: Produto) {
    if (!confirm(`Excluir "${p.nome}" do cardápio?`)) return;
    setErro(null);
    iniciar(async () => {
      const r = await excluirProduto(p.id);
      if (!r.ok) setErro(r.erro);
    });
  }

  return (
    <div className="p-8">
      <Cabecalho
        fita="Cardápio"
        titulo="Cardápio"
        descricao="Acabou um prato no meio do almoço? Use “acabou hoje” — ele some do PDV na hora e volta amanhã com um clique."
      >
        <button className="btn btn-ouro" onClick={() => setEditando(null)}>
          Novo produto
        </button>
      </Cabecalho>

      {erro && (
        <p
          role="alert"
          className="mb-4 rounded-lg border border-cancelado/40 bg-cancelado/10 px-3 py-2 text-sm text-cancelado"
        >
          {erro}
        </p>
      )}

      {produtos.length === 0 ? (
        <Vazio
          titulo="Cardápio vazio"
          texto="Sem produto cadastrado, o PDV não tem o que vender."
        >
          <button className="btn btn-ouro" onClick={() => setEditando(null)}>
            Cadastrar produto
          </button>
        </Vazio>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {produtos.map((p) => {
            const tamanhos = p.produto_variacoes ?? [];
            const qtdItens = (p.produto_adicionais ?? []).length;
            return (
              <article
                key={p.id}
                className={
                  "flex flex-col rounded-2xl border bg-carvao p-5 " +
                  (p.disponivel && p.ativo
                    ? "border-borda"
                    : "border-borda/50 opacity-55")
                }
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="font-display text-lg uppercase tracking-wide text-creme">
                      {p.nome}
                    </h2>
                    <p className="text-xs text-creme-fraco">
                      {p.categoria_id
                        ? nomeCategoria.get(p.categoria_id)
                        : "Sem categoria"}
                    </p>
                  </div>
                  {!p.disponivel && (
                    <span className="shrink-0 rounded-full bg-cancelado/20 px-2 py-0.5 text-xs font-semibold text-cancelado">
                      Acabou
                    </span>
                  )}
                </div>

                {p.descricao && (
                  <p className="mb-3 text-sm leading-snug text-creme-suave">
                    {p.descricao}
                  </p>
                )}

                <div className="mb-4 flex flex-wrap gap-1.5">
                  {tamanhos.length > 0 ? (
                    tamanhos.map((v) => (
                      <span
                        key={v.id}
                        className="tabular rounded-lg border border-borda px-2 py-1 text-xs text-creme"
                      >
                        <strong className="text-ouro">{v.nome}</strong>{" "}
                        {reais(Number(v.preco))}
                      </span>
                    ))
                  ) : (
                    <span className="tabular font-display text-xl text-ouro">
                      {reais(Number(p.preco_base))}
                    </span>
                  )}
                </div>

                {qtdItens > 0 && (
                  <p className="mb-4 text-xs text-creme-fraco">
                    {qtdItens} {qtdItens === 1 ? "item pode ir" : "itens podem ir"} dentro
                  </p>
                )}

                <div className="mt-auto flex gap-2 border-t border-borda pt-3">
                  <button
                    className={
                      "btn flex-1 py-2 text-xs " +
                      (p.disponivel ? "btn-quieto" : "btn-ouro")
                    }
                    onClick={() => alternar(p)}
                  >
                    {p.disponivel ? "Acabou hoje" : "Voltou"}
                  </button>
                  <button
                    className="btn btn-quieto px-3 py-2 text-xs"
                    onClick={() => setEditando(p)}
                  >
                    Editar
                  </button>
                  <button
                    className="px-2 text-xs text-creme-fraco underline hover:text-cancelado"
                    onClick={() => remover(p)}
                  >
                    Excluir
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {editando !== undefined && (
        <FormularioProduto
          produto={editando}
          categorias={categorias}
          adicionais={adicionais}
          aoFechar={() => setEditando(undefined)}
        />
      )}
    </div>
  );
}
