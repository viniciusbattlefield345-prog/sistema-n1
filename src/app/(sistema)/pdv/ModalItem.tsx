"use client";

import { useEffect, useMemo, useState } from "react";
import { numero, reais } from "@/lib/formato";
import type { Adicional, Categoria, ItemCarrinho, Produto } from "@/lib/tipos";

/**
 * Monta um item: tamanho, adicionais, quantidade e observacao.
 * So aparece quando o produto tem escolha a fazer — produto simples
 * cai direto na comanda com um toque.
 */
export function ModalItem({
  produto,
  produtos,
  categorias,
  adicionais,
  aoFechar,
  aoAdicionar,
}: {
  produto: Produto;
  /** O cardapio inteiro: e dele que saem os sabores da outra metade. */
  produtos: Produto[];
  categorias: Categoria[];
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
  const [quantidades, setQuantidades] = useState<Record<number, number>>({});
  const [segundoId, setSegundoId] = useState<number | null>(null);

  /**
   * Meia a meia no balcao: a mesma regra do cardapio do cliente, porque e o
   * mesmo pedido. So aparece em categoria marcada pra isso (hoje, Pizzas).
   */
  const categoria = categorias.find((c) => c.id === produto.categoria_id) ?? null;
  const sabores = categoria?.meio_a_meio
    ? produtos.filter(
        (p) =>
          p.categoria_id === produto.categoria_id && p.id !== produto.id && p.ativo && p.disponivel,
      )
    : [];

  /** Soma ou tira um do adicional, entre 0 e 10. */
  const mudar = (id: number, passo: number) =>
    setQuantidades((atual) => ({
      ...atual,
      [id]: Math.max(0, Math.min(10, (atual[id] ?? 0) + passo)),
    }));
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
  const segundo = sabores.find((s) => s.id === segundoId) ?? null;
  const precoSozinho = Number(variacao ? variacao.preco : produto.preco_base);
  // Vale o sabor mais caro dos dois. Quem confere e o servidor; aqui e so pra
  // o atendente ver na tela o mesmo valor que vai sair na comanda.
  const precoUnitario = segundo
    ? Math.max(precoSozinho, Number(segundo.preco_base))
    : precoSozinho;
  const nomeItem = segundo ? `1/2 ${produto.nome} + 1/2 ${segundo.nome}` : produto.nome;
  const extras = extrasDisponiveis
    .map((a) => ({ extra: a, vezes: quantidades[a.id] ?? 0 }))
    .filter((e) => e.vezes > 0);
  const total =
    (precoUnitario + extras.reduce((s, e) => s + Number(e.extra.preco) * e.vezes, 0)) *
    quantidade;

  function confirmar() {
    aoAdicionar({
      chave: crypto.randomUUID(),
      produto_id: produto.id,
      produto_nome: nomeItem,
      segundo_produto_id: segundo?.id ?? null,
      variacao_id: variacao?.id ?? null,
      variacao_nome: variacao?.nome ?? null,
      preco_unitario: precoUnitario,
      quantidade,
      observacao,
      adicionais: extras.map((e) => ({
        adicional_id: e.extra.id,
        nome: e.extra.nome,
        preco: Number(e.extra.preco),
        quantidade: e.vezes,
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

          {sabores.length > 0 && (
            <fieldset className="mb-5">
              <legend className="rotulo">Outra metade</legend>
              <p className="mb-1.5 text-xs text-creme-fraco">
                Vale o preço do sabor mais caro dos dois.
              </p>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={() => setSegundoId(null)}
                  className={
                    "rounded-lg border px-2.5 py-2.5 text-left text-sm transition-colors " +
                    (segundo === null
                      ? "border-ouro bg-ouro/15 text-creme"
                      : "border-borda text-creme-suave hover:border-borda-forte")
                  }
                >
                  Inteira
                </button>
                {sabores.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSegundoId(segundoId === s.id ? null : s.id)}
                    className={
                      "flex items-center justify-between gap-1.5 rounded-lg border px-2.5 py-2.5 text-left text-sm transition-colors " +
                      (segundoId === s.id
                        ? "border-ouro bg-ouro/15 text-creme"
                        : "border-borda text-creme-suave hover:border-borda-forte")
                    }
                  >
                    <span className="truncate">1/2 {s.nome}</span>
                    <span className="tabular shrink-0 text-xs">
                      {numero(Math.max(precoSozinho, Number(s.preco_base)))}
                    </span>
                  </button>
                ))}
              </div>
            </fieldset>
          )}

          {grupos.map(([grupo, itens]) => (
            <fieldset key={grupo} className="mb-5">
              <legend className="rotulo">{grupo}</legend>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {itens.map((a) => {
                  const vezes = quantidades[a.id] ?? 0;
                  const custa = Number(a.preco) > 0;
                  return (
                    <div
                      key={a.id}
                      className={
                        "flex items-stretch justify-between rounded-lg border text-sm transition-colors " +
                        (vezes > 0
                          ? "border-ouro bg-ouro/15 text-creme"
                          : "border-borda text-creme-suave hover:border-borda-forte")
                      }
                    >
                      {/*
                        O corpo inteiro soma mais um. No balcao tem fila
                        esperando: quem quer um adicional so da um toque, como
                        sempre deu, e quem quer dois da dois. O "-" so nasce
                        quando ja tem algo pra tirar, pra nao virar ruido.
                      */}
                      <button
                        type="button"
                        onClick={() => mudar(a.id, 1)}
                        aria-label={`Mais um ${a.nome}`}
                        className="flex min-w-0 flex-1 items-center justify-between gap-1.5 px-2.5 py-2.5 text-left"
                      >
                        <span className="flex min-w-0 items-center gap-1.5">
                          {vezes > 0 && (
                            <span className="tabular shrink-0 rounded bg-ouro px-1.5 py-0.5 text-xs font-bold text-breu">
                              {vezes}x
                            </span>
                          )}
                          <span className="truncate">{a.nome}</span>
                        </span>
                        {/* adicional gratis: mostrar "+0,00" seria ruido */}
                        {custa && (
                          <span className="tabular shrink-0 text-xs">
                            +{numero(Number(a.preco))}
                          </span>
                        )}
                      </button>
                      {vezes > 0 && (
                        <button
                          type="button"
                          onClick={() => mudar(a.id, -1)}
                          aria-label={`Tirar um ${a.nome}`}
                          className="shrink-0 border-l border-ouro/40 px-3 text-base font-bold leading-none text-creme"
                        >
                          −
                        </button>
                      )}
                    </div>
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
