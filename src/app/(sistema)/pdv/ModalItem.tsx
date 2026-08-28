"use client";

import { useEffect, useMemo, useState } from "react";
import { numero, reais } from "@/lib/formato";
import type { Adicional, ItemCarrinho, Produto } from "@/lib/tipos";

/**
 * Monta um item: tamanho, adicionais, quantidade e observacao.
 * So aparece quando o produto tem escolha a fazer — produto simples
 * cai direto na comanda com um toque.
 */
export function ModalItem({
  produto,
  adicionais,
  aoFechar,
  aoAdicionar,
}: {
  produto: Produto;
  adicionais: Adicional[];
  aoFechar: () => void;
  aoAdicionar: (item: ItemCarrinho) => void;
}) {
  const variacoes = produto.produto_variacoes ?? [];
  const permitidos = new Set(
    (produto.produto_adicionais ?? []).map((p) => p.adicional_id),
  );
  const extrasDisponiveis = adicionais.filter((a) => permitidos.has(a.id));

  const [variacaoId, setVariacaoId] = useState<number | null>(
    variacoes.length > 0 ? variacoes[0].id : null,
  );
  const [escolhidos, setEscolhidos] = useState<number[]>([]);
  const [quantidade, setQuantidade] = useState(1);
  const [observacao, setObservacao] = useState("");

  // Separa por secao ("Acompanhamentos", "Carnes"...) mantendo a ordem
  // do cardapio. Sem grupo, tudo cai num bloco so chamado "Adicionais".
  const grupos = useMemo(() => {
    const mapa = new Map<string, Adicional[]>();
    for (const a of [...extrasDisponiveis].sort(
      (x, y) => x.ordem - y.ordem || x.nome.localeCompare(y.nome, "pt-BR"),
    )) {
      const chave = a.grupo?.trim() || "Adicionais";
      if (!mapa.has(chave)) mapa.set(chave, []);
      mapa.get(chave)!.push(a);
    }
    return [...mapa.entries()];
  }, [extrasDisponiveis]);

  useEffect(() => {
    const fechaNoEsc = (e: KeyboardEvent) => e.key === "Escape" && aoFechar();
    window.addEventListener("keydown", fechaNoEsc);
    return () => window.removeEventListener("keydown", fechaNoEsc);
  }, [aoFechar]);

  const variacao = variacoes.find((v) => v.id === variacaoId) ?? null;
  const precoUnitario = Number(variacao ? variacao.preco : produto.preco_base);
  const extras = extrasDisponiveis.filter((a) => escolhidos.includes(a.id));
  const total = (precoUnitario + extras.reduce((s, a) => s + Number(a.preco), 0)) * quantidade;

  function confirmar() {
    aoAdicionar({
      chave: crypto.randomUUID(),
      produto_id: produto.id,
      produto_nome: produto.nome,
      variacao_id: variacao?.id ?? null,
      variacao_nome: variacao?.nome ?? null,
      preco_unitario: precoUnitario,
      quantidade,
      observacao,
      adicionais: extras.map((a) => ({
        adicional_id: a.id,
        nome: a.nome,
        preco: Number(a.preco),
      })),
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"
      onClick={aoFechar}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Montar ${produto.nome}`}
        className="flex max-h-[88vh] w-full max-w-2xl flex-col rounded-2xl border border-borda bg-carvao"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="border-b border-borda px-6 py-4">
          <h2 className="font-display text-xl uppercase tracking-wide text-creme">
            {produto.nome}
          </h2>
          {produto.descricao && (
            <p className="mt-0.5 text-sm text-creme-suave">{produto.descricao}</p>
          )}
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {variacoes.length > 0 && (
            <fieldset className="mb-5">
              <legend className="rotulo">Tamanho</legend>
              <div className="flex flex-col gap-2">
                {variacoes.map((v) => (
                  <label
                    key={v.id}
                    className={
                      "flex cursor-pointer items-center justify-between rounded-lg border px-4 py-3 text-sm transition-colors " +
                      (variacaoId === v.id
                        ? "border-ouro bg-ouro/10 text-creme"
                        : "border-borda text-creme-suave hover:border-borda-forte")
                    }
                  >
                    <span className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="variacao"
                        className="accent-ouro"
                        checked={variacaoId === v.id}
                        onChange={() => setVariacaoId(v.id)}
                      />
                      {v.nome}
                    </span>
                    <span className="tabular font-medium">{reais(Number(v.preco))}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          {grupos.map(([grupo, itens]) => (
            <fieldset key={grupo} className="mb-5">
              <legend className="rotulo">{grupo}</legend>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {itens.map((a) => {
                  const marcado = escolhidos.includes(a.id);
                  const custa = Number(a.preco) > 0;
                  return (
                    <label
                      key={a.id}
                      className={
                        "flex cursor-pointer items-center justify-between gap-1.5 rounded-lg border px-2.5 py-2.5 text-sm transition-colors " +
                        (marcado
                          ? "border-ouro bg-ouro/15 text-creme"
                          : "border-borda text-creme-suave hover:border-borda-forte")
                      }
                    >
                      <span className="flex min-w-0 items-center gap-2">
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
                      </span>
                      {/* item de marmita nao custa nada: mostrar "+0,00" e ruido */}
                      {custa && (
                        <span className="tabular shrink-0 text-xs">
                          +{numero(Number(a.preco))}
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          ))}

          <div className="mb-5">
            <label className="rotulo" htmlFor="obs-item">
              Observação para a cozinha
            </label>
            <input
              id="obs-item"
              className="campo"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Ex: sem cebola, ponto da carne, embalar separado"
            />
          </div>

          <div>
            <span className="rotulo">Quantidade</span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="btn btn-quieto size-11 p-0 text-xl"
                onClick={() => setQuantidade((q) => Math.max(1, q - 1))}
                aria-label="Diminuir quantidade"
              >
                −
              </button>
              <span className="tabular w-12 text-center font-display text-2xl">
                {quantidade}
              </span>
              <button
                type="button"
                className="btn btn-quieto size-11 p-0 text-xl"
                onClick={() => setQuantidade((q) => q + 1)}
                aria-label="Aumentar quantidade"
              >
                +
              </button>
            </div>
          </div>
        </div>

        <footer className="flex items-center gap-3 border-t border-borda px-6 py-4">
          <button type="button" className="btn btn-quieto" onClick={aoFechar}>
            Cancelar
          </button>
          <button type="button" className="btn btn-ouro flex-1" onClick={confirmar}>
            Adicionar · {reais(total)}
          </button>
        </footer>
      </div>
    </div>
  );
}
