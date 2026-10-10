"use client";

import { useState } from "react";
import { Folha } from "./Folha";
import { Foto } from "./Foto";
import { Passo } from "./Passo";
import { reais } from "@/lib/formato";
import type { Adicional, Categoria, ItemCarrinho, Produto } from "@/lib/tipos";

/**
 * A folha que abre quando o cliente toca num produto: tamanho, adicionais,
 * observação e quantidade. Serve tanto o cardápio da mesa quanto o do link
 * de entrega — o produto é o mesmo nos dois.
 */
export function EscolhaProduto({
  produto,
  produtos,
  categorias,
  adicionais,
  lojaAberta,
  saindo,
  aoFechar,
  aoAdicionar,
}: {
  produto: Produto;
  /** O cardapio inteiro: e dele que saem os sabores da outra metade. */
  produtos: Produto[];
  categorias: Categoria[];
  adicionais: Adicional[];
  lojaAberta: boolean;
  saindo: boolean;
  aoFechar: () => void;
  aoAdicionar: (item: ItemCarrinho) => void;
}) {
  const variacoes = produto.produto_variacoes ?? [];

  /**
   * Meia a meia so existe onde a categoria permite — hoje, Pizzas. Fora dela
   * a pergunta nem aparece, pra nao atrapalhar quem esta pedindo um lanche.
   */
  const categoria = categorias.find((c) => c.id === produto.categoria_id) ?? null;
  const sabores = categoria?.meio_a_meio
    ? produtos.filter(
        (p) => p.categoria_id === produto.categoria_id && p.id !== produto.id && p.ativo && p.disponivel,
      )
    : [];
  const permitidos = new Set((produto.produto_adicionais ?? []).map((p) => p.adicional_id));
  const extras = adicionais.filter((a) => permitidos.has(a.id));

  const [variacaoId, setVariacaoId] = useState<number | null>(variacoes[0]?.id ?? null);
  const [segundoId, setSegundoId] = useState<number | null>(null);
  const [escolhidos, setEscolhidos] = useState<number[]>([]);
  const [quantidade, setQuantidade] = useState(1);
  const [observacao, setObservacao] = useState("");

  const variacao = variacoes.find((v) => v.id === variacaoId) ?? null;
  const segundo = sabores.find((s) => s.id === segundoId) ?? null;
  const precoSozinho = Number(variacao ? variacao.preco : produto.preco_base);
  /**
   * Meia a meia vale o sabor mais caro dos dois. Quem decide isso de verdade
   * e o servidor, que rele o cardapio no banco; aqui e so pra tela nao
   * mostrar um valor e o pedido sair com outro.
   */
  const precoUnitario = segundo
    ? Math.max(precoSozinho, Number(segundo.preco_base))
    : precoSozinho;
  const nomeItem = segundo ? `1/2 ${produto.nome} + 1/2 ${segundo.nome}` : produto.nome;
  const marcados = extras.filter((a) => escolhidos.includes(a.id));
  const total =
    (precoUnitario + marcados.reduce((s, a) => s + Number(a.preco), 0)) * quantidade;

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
          {produto.fatias ? (
            <p className="mt-2 text-sm font-semibold text-ouro/80">
              Vem cortada em {produto.fatias} fatias
            </p>
          ) : null}
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

        {sabores.length > 0 && (
          <div className="px-5 pt-5">
            <fieldset>
              <legend className="rotulo">Quer a outra metade de outro sabor?</legend>
              <p className="mb-2 text-xs text-creme-fraco">
                Sai meia a meia. Vale o preço do sabor mais caro dos dois.
              </p>
              <div className="divide-y divide-borda overflow-hidden rounded-2xl border border-borda">
                <label className="flex cursor-pointer items-center gap-3 px-4 py-3.5 text-sm">
                  <input
                    type="radio"
                    name="segundo-sabor"
                    className="size-5 accent-ouro"
                    checked={segundoId === null}
                    onChange={() => setSegundoId(null)}
                  />
                  Inteira de {produto.nome}
                </label>
                {sabores.map((s) => (
                  <label
                    key={s.id}
                    className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3.5"
                  >
                    <span className="flex items-center gap-3 text-sm">
                      <input
                        type="radio"
                        name="segundo-sabor"
                        className="size-5 accent-ouro"
                        checked={segundoId === s.id}
                        onChange={() => setSegundoId(s.id)}
                      />
                      1/2 {s.nome}
                    </span>
                    <span className="tabular text-sm text-creme-suave">
                      {reais(Math.max(precoSozinho, Number(s.preco_base)))}
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
