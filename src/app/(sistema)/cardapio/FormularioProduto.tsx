"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { salvarProduto, type DadosProduto } from "./acoes";
import { paraNumero, numero } from "@/lib/formato";
import type { Adicional, Categoria, Produto } from "@/lib/tipos";

type Tamanho = { nome: string; preco: string };

export function FormularioProduto({
  produto,
  categorias,
  adicionais,
  aoFechar,
}: {
  produto: Produto | null;
  categorias: Categoria[];
  adicionais: Adicional[];
  aoFechar: () => void;
}) {
  const [nome, setNome] = useState(produto?.nome ?? "");
  const [descricao, setDescricao] = useState(produto?.descricao ?? "");
  const [categoriaId, setCategoriaId] = useState<number | null>(
    produto?.categoria_id ?? categorias[0]?.id ?? null,
  );
  const [precoBase, setPrecoBase] = useState(
    produto && (produto.produto_variacoes?.length ?? 0) === 0
      ? numero(Number(produto.preco_base))
      : "",
  );
  const [ordem, setOrdem] = useState(String(produto?.ordem ?? 0));
  const [tamanhos, setTamanhos] = useState<Tamanho[]>(
    (produto?.produto_variacoes ?? []).map((v) => ({
      nome: v.nome,
      preco: numero(Number(v.preco)),
    })),
  );
  const [escolhidos, setEscolhidos] = useState<number[]>(
    (produto?.produto_adicionais ?? []).map((p) => p.adicional_id),
  );
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, iniciar] = useTransition();

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && aoFechar();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [aoFechar]);

  const grupos = useMemo(() => {
    const mapa = new Map<string, Adicional[]>();
    for (const a of adicionais) {
      const chave = a.grupo?.trim() || "Sem seção";
      if (!mapa.has(chave)) mapa.set(chave, []);
      mapa.get(chave)!.push(a);
    }
    return [...mapa.entries()];
  }, [adicionais]);

  function enviar() {
    setErro(null);
    const dados: DadosProduto = {
      id: produto?.id,
      categoria_id: categoriaId,
      nome,
      descricao,
      preco_base: paraNumero(precoBase),
      ativo: produto?.ativo ?? true,
      disponivel: produto?.disponivel ?? true,
      ordem: Math.trunc(paraNumero(ordem)),
      variacoes: tamanhos.map((t, i) => ({
        nome: t.nome,
        preco: paraNumero(t.preco),
        ordem: i + 1,
      })),
      adicionais: escolhidos,
    };
    iniciar(async () => {
      const r = await salvarProduto(dados);
      if (!r.ok) return setErro(r.erro);
      aoFechar();
    });
  }

  const grupoTodoMarcado = (itens: Adicional[]) =>
    itens.every((a) => escolhidos.includes(a.id));

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"
      onClick={aoFechar}
      role="presentation"
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-label={produto ? "Editar produto" : "Novo produto"}
        className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl border border-borda bg-carvao"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          enviar();
        }}
      >
        <header className="border-b border-borda px-6 py-4">
          <h2 className="font-display text-xl uppercase tracking-wide text-creme">
            {produto ? "Editar produto" : "Novo produto"}
          </h2>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-[1fr_12rem] gap-3">
            <div>
              <label className="rotulo" htmlFor="p-nome">Nome</label>
              <input
                id="p-nome"
                className="campo"
                autoFocus
                required
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Marmita"
              />
            </div>
            <div>
              <label className="rotulo" htmlFor="p-cat">Categoria</label>
              <select
                id="p-cat"
                className="campo"
                value={categoriaId ?? ""}
                onChange={(e) =>
                  setCategoriaId(e.target.value ? Number(e.target.value) : null)
                }
              >
                <option value="">Sem categoria</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="rotulo" htmlFor="p-desc">Descrição</label>
            <input
              id="p-desc"
              className="campo"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Escolha o tamanho e monte a marmita"
            />
          </div>

          {/* tamanhos */}
          <fieldset>
            <legend className="rotulo">Tamanhos</legend>
            <p className="mb-2 text-xs text-creme-fraco">
              Deixe vazio se o produto tem preço único. Com tamanhos, quem manda
              no preço é o tamanho escolhido.
            </p>

            <div className="space-y-2">
              {tamanhos.map((t, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    className="campo"
                    style={{ width: "10rem" }}
                    value={t.nome}
                    onChange={(e) =>
                      setTamanhos((a) =>
                        a.map((x, j) => (j === i ? { ...x, nome: e.target.value } : x)),
                      )
                    }
                    placeholder="P"
                    aria-label={`Nome do tamanho ${i + 1}`}
                  />
                  <input
                    className="campo"
                    style={{ width: "9rem" }}
                    inputMode="decimal"
                    value={t.preco}
                    onChange={(e) =>
                      setTamanhos((a) =>
                        a.map((x, j) => (j === i ? { ...x, preco: e.target.value } : x)),
                      )
                    }
                    placeholder="18,00"
                    aria-label={`Preço do tamanho ${i + 1}`}
                  />
                  <button
                    type="button"
                    className="text-xs text-creme-fraco underline hover:text-cancelado"
                    onClick={() => setTamanhos((a) => a.filter((_, j) => j !== i))}
                  >
                    Remover
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              className="btn btn-quieto mt-2 px-3 py-1.5 text-xs"
              onClick={() => setTamanhos((a) => [...a, { nome: "", preco: "" }])}
            >
              Adicionar tamanho
            </button>
          </fieldset>

          {tamanhos.length === 0 && (
            <div className="w-40">
              <label className="rotulo" htmlFor="p-preco">Preço</label>
              <input
                id="p-preco"
                className="campo"
                inputMode="decimal"
                value={precoBase}
                onChange={(e) => setPrecoBase(e.target.value)}
                placeholder="18,00"
              />
            </div>
          )}

          {/* itens que o produto aceita */}
          {adicionais.length > 0 && (
            <fieldset>
              <legend className="rotulo">O que pode ir dentro</legend>
              <p className="mb-2 text-xs text-creme-fraco">
                Marque o que a atendente poderá escolher ao montar este produto.
              </p>

              {grupos.map(([grupo, itens]) => (
                <div key={grupo} className="mb-3">
                  <div className="mb-1.5 flex items-center gap-3">
                    <span className="text-xs font-semibold uppercase tracking-wide text-creme-suave">
                      {grupo}
                    </span>
                    <button
                      type="button"
                      className="text-xs text-ouro underline"
                      onClick={() => {
                        const ids = itens.map((a) => a.id);
                        setEscolhidos((atual) =>
                          grupoTodoMarcado(itens)
                            ? atual.filter((id) => !ids.includes(id))
                            : [...new Set([...atual, ...ids])],
                        );
                      }}
                    >
                      {grupoTodoMarcado(itens) ? "desmarcar todos" : "marcar todos"}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                    {itens.map((a) => {
                      const marcado = escolhidos.includes(a.id);
                      return (
                        <label
                          key={a.id}
                          className={
                            "flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-2 text-sm " +
                            (marcado
                              ? "border-ouro bg-ouro/15 text-creme"
                              : "border-borda text-creme-suave")
                          }
                        >
                          <input
                            type="checkbox"
                            className="accent-ouro"
                            checked={marcado}
                            onChange={() =>
                              setEscolhidos((atual) =>
                                marcado
                                  ? atual.filter((id) => id !== a.id)
                                  : [...atual, a.id],
                              )
                            }
                          />
                          <span className="truncate">{a.nome}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </fieldset>
          )}

          <div className="w-32">
            <label className="rotulo" htmlFor="p-ordem">Ordem no PDV</label>
            <input
              id="p-ordem"
              className="campo"
              inputMode="numeric"
              value={ordem}
              onChange={(e) => setOrdem(e.target.value)}
            />
          </div>

          {erro && (
            <p
              role="alert"
              className="rounded-lg border border-cancelado/40 bg-cancelado/10 px-3 py-2 text-sm text-cancelado"
            >
              {erro}
            </p>
          )}
        </div>

        <footer className="flex gap-3 border-t border-borda px-6 py-4">
          <button type="button" className="btn btn-quieto" onClick={aoFechar}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-ouro flex-1" disabled={salvando}>
            {salvando ? "Salvando…" : "Salvar produto"}
          </button>
        </footer>
      </form>
    </div>
  );
}
