"use client";

import { useEffect, useMemo, useState } from "react";
import { Foto } from "./Foto";
import { reais } from "@/lib/formato";
import type { Categoria, Produto } from "@/lib/tipos";

/** Produto com tamanhos mostra "a partir de" — o menor preço entre eles. */
function menorPreco(p: Produto) {
  const variacoes = p.produto_variacoes ?? [];
  return variacoes.length
    ? Math.min(...variacoes.map((v) => Number(v.preco)))
    : Number(p.preco_base);
}

/**
 * O cardápio em si: a fila de categorias que gruda no topo e as seções de
 * produtos embaixo. A categoria acesa acompanha a rolagem.
 *
 * É a mesma lista na mesa e no link de entrega — o que muda em volta dela é
 * quem está pedindo e pra onde o pedido vai.
 */
export function ListaCardapio({
  produtos,
  categorias,
  aoEscolher,
}: {
  produtos: Produto[];
  categorias: Categoria[];
  aoEscolher: (p: Produto) => void;
}) {
  const [ativa, setAtiva] = useState<string | null>(null);

  const secoes = useMemo(() => {
    const ativas = new Set(categorias.map((c) => c.id));
    const porCategoria = new Map<number | null, Produto[]>();
    for (const p of produtos) {
      // produto de categoria desativada some junto com a categoria
      if (p.categoria_id !== null && !ativas.has(p.categoria_id)) continue;
      const lista = porCategoria.get(p.categoria_id) ?? [];
      lista.push(p);
      porCategoria.set(p.categoria_id, lista);
    }
    const lista = categorias.map((c) => ({
      id: `secao-${c.id}`,
      titulo: c.nome,
      descricao: c.descricao,
      produtos: porCategoria.get(c.id) ?? [],
    }));
    const soltos = porCategoria.get(null);
    if (soltos?.length) {
      lista.push({ id: "secao-outros", titulo: "Outros", descricao: null, produtos: soltos });
    }
    return lista.filter((s) => s.produtos.length > 0);
  }, [produtos, categorias]);

  useEffect(() => {
    const alvos = secoes
      .map((s) => document.getElementById(s.id))
      .filter((el): el is HTMLElement => el !== null);
    if (alvos.length === 0) return;
    const observador = new IntersectionObserver(
      (entradas) => {
        const primeira = entradas
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (primeira) setAtiva(primeira.target.id);
      },
      { rootMargin: "-90px 0px -55% 0px" },
    );
    alvos.forEach((a) => observador.observe(a));
    return () => observador.disconnect();
  }, [secoes]);

  useEffect(() => {
    if (!ativa) return;
    document
      .querySelector(`[data-chip="${ativa}"]`)
      ?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [ativa]);

  return (
    <>
      <nav
        aria-label="Categorias do cardápio"
        className="sticky top-0 z-30 mt-3 border-b border-borda bg-breu/95 backdrop-blur"
      >
        <div className="flex gap-2 overflow-x-auto px-4 py-3 [scrollbar-width:none]">
          {secoes.map((s) => (
            <button
              key={s.id}
              type="button"
              data-chip={s.id}
              aria-current={ativa === s.id ? "true" : undefined}
              onClick={() =>
                document
                  .getElementById(s.id)
                  ?.scrollIntoView({ behavior: "smooth", block: "start" })
              }
              className={
                "shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition-colors " +
                (ativa === s.id
                  ? "border-ouro bg-ouro text-black"
                  : "border-borda text-creme-suave")
              }
            >
              {s.titulo}
            </button>
          ))}
        </div>
      </nav>

      {secoes.length === 0 && (
        <p className="py-16 text-center text-sm text-creme-suave">
          O cardápio está sendo atualizado. Tente de novo daqui a pouco.
        </p>
      )}

      {secoes.map((s) => (
        <section key={s.id} id={s.id} className="scroll-mt-16 pt-8">
          <header className="mb-2">
            <h2 className="flex flex-wrap items-baseline gap-x-2 font-display text-xl font-extrabold uppercase tracking-wide">
              <span aria-hidden className="text-ouro">
                ★
              </span>
              {s.titulo}
              {s.descricao && (
                <span className="text-xs font-semibold normal-case tracking-normal text-creme-suave">
                  {s.descricao}
                </span>
              )}
            </h2>
            <div className="ml-7 mt-1.5 h-[3px] w-14 rounded-full bg-ouro" />
          </header>

          <ul className="divide-y divide-borda">
            {s.produtos.map((p, indice) => (
              <li
                key={p.id}
                style={{ "--i": Math.min(indice, 6) } as React.CSSProperties}
                className="anim-entrar"
              >
                <button
                  type="button"
                  onClick={() => aoEscolher(p)}
                  disabled={!p.disponivel}
                  className="toque flex w-full items-start gap-3 rounded-2xl py-4 text-left disabled:opacity-45"
                >
                  <div className="min-w-0 flex-1">
                    <h3 className="font-display text-[0.95rem] font-bold uppercase leading-snug text-ouro">
                      {p.nome}
                    </h3>
                    {p.descricao && (
                      <p className="mt-1 text-sm leading-snug text-creme-suave">{p.descricao}</p>
                    )}
                    <p className="tabular mt-1.5 font-display font-bold text-creme">
                      {(p.produto_variacoes?.length ?? 0) > 0 && (
                        <span className="mr-1 text-xs font-normal text-creme-fraco">
                          a partir de
                        </span>
                      )}
                      {reais(menorPreco(p))}
                    </p>
                    {!p.disponivel && (
                      <p className="mt-1 text-xs font-bold uppercase text-cancelado">
                        Esgotado hoje
                      </p>
                    )}
                  </div>
                  {p.foto_url && <Foto url={p.foto_url} className="size-24 shrink-0 rounded-2xl" />}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
