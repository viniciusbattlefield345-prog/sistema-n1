"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Comanda } from "./Comanda";
import { ModalItem } from "./ModalItem";
import { FormularioCliente } from "../clientes/FormularioCliente";
import { salvarPedido } from "./acoes";
import { reais, telefone as formatarTelefone } from "@/lib/formato";
import type {
  Adicional,
  Bairro,
  Categoria,
  Cliente,
  FormaPagamento,
  ItemCarrinho,
  Produto,
  TipoEntrega,
} from "@/lib/tipos";

const PAGAMENTOS: FormaPagamento[] = [
  "Dinheiro",
  "Pix",
  "Cartao Debito",
  "Cartao Credito",
];

const NOME_PAGAMENTO: Record<FormaPagamento, string> = {
  Dinheiro: "Dinheiro",
  Pix: "Pix",
  "Cartao Debito": "Débito",
  "Cartao Credito": "Crédito",
};

export function PainelPdv({
  caixaId,
  categorias,
  produtos,
  adicionais,
  clientes,
  bairros,
}: {
  caixaId: number;
  categorias: Categoria[];
  produtos: Produto[];
  adicionais: Adicional[];
  clientes: Cliente[];
  bairros: Bairro[];
}) {
  const router = useRouter();
  const [salvando, iniciarSalvamento] = useTransition();

  const [busca, setBusca] = useState("");
  const [categoriaId, setCategoriaId] = useState<number | null>(null);
  const [itens, setItens] = useState<ItemCarrinho[]>([]);
  const [produtoAberto, setProdutoAberto] = useState<Produto | null>(null);

  const [tipo, setTipo] = useState<TipoEntrega>("ENTREGA");
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [nomeAvulso, setNomeAvulso] = useState("");
  const [buscaCliente, setBuscaCliente] = useState("");
  const [cadastrando, setCadastrando] = useState(false);
  // No celular a comanda nao cabe ao lado do cardapio: vira gaveta.
  const [verComanda, setVerComanda] = useState(false);

  const [forma, setForma] = useState<FormaPagamento>("Dinheiro");
  const [trocoTexto, setTrocoTexto] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const bairro = bairros.find((b) => b.id === cliente?.bairro_id) ?? null;
  const taxa = tipo === "ENTREGA" ? Number(bairro?.taxa ?? 0) : 0;

  const clienteNome = tipo === "ENTREGA" ? (cliente?.nome ?? "") : nomeAvulso;
  const endereco = cliente
    ? [cliente.endereco, cliente.numero].filter(Boolean).join(", ") +
      (bairro ? ` — ${bairro.nome}` : "") +
      (cliente.referencia ? ` (${cliente.referencia})` : "")
    : "";

  const produtosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return produtos.filter((p) => {
      if (categoriaId !== null && p.categoria_id !== categoriaId) return false;
      if (!termo) return true;
      return (
        p.nome.toLowerCase().includes(termo) ||
        (p.descricao ?? "").toLowerCase().includes(termo)
      );
    });
  }, [produtos, busca, categoriaId]);

  const clientesFiltrados = useMemo(() => {
    const termo = buscaCliente.trim().toLowerCase();
    if (!termo) return [];
    const digitos = termo.replace(/\D/g, "");
    return clientes
      .filter(
        (c) =>
          c.nome.toLowerCase().includes(termo) ||
          (digitos.length >= 3 && (c.telefone ?? "").includes(digitos)),
      )
      .slice(0, 6);
  }, [clientes, buscaCliente]);

  const subtotal = itens.reduce(
    (s, i) =>
      s +
      (i.preco_unitario + i.adicionais.reduce((x, a) => x + a.preco, 0)) *
        i.quantidade,
    0,
  );
  const total = Math.max(subtotal + taxa, 0);
  const troco = Math.max(Number(trocoTexto.replace(",", ".") || 0) - total, 0);

  function escolherProduto(produto: Produto) {
    const temEscolha =
      (produto.produto_variacoes?.length ?? 0) > 0 ||
      (produto.produto_adicionais?.length ?? 0) > 0;

    if (temEscolha) {
      setProdutoAberto(produto);
      return;
    }
    adicionar({
      chave: crypto.randomUUID(),
      produto_id: produto.id,
      produto_nome: produto.nome,
      variacao_id: null,
      variacao_nome: null,
      preco_unitario: Number(produto.preco_base),
      quantidade: 1,
      observacao: "",
      adicionais: [],
    });
  }

  function adicionar(item: ItemCarrinho) {
    setItens((atual) => [...atual, item]);
    setProdutoAberto(null);
    setErro(null);
  }

  function mudarQuantidade(chave: string, delta: number) {
    setItens((atual) =>
      atual.flatMap((i) => {
        if (i.chave !== chave) return [i];
        const nova = i.quantidade + delta;
        return nova <= 0 ? [] : [{ ...i, quantidade: nova }];
      }),
    );
  }

  function fecharPedido() {
    setErro(null);
    iniciarSalvamento(async () => {
      const resultado = await salvarPedido({
        caixa_id: caixaId,
        tipo_entrega: tipo,
        cliente_id: tipo === "ENTREGA" ? (cliente?.id ?? null) : null,
        cliente_nome: clienteNome,
        cliente_telefone: cliente?.telefone ?? null,
        endereco_entrega: tipo === "ENTREGA" ? endereco : null,
        bairro_id: cliente?.bairro_id ?? null,
        forma_pagamento: forma,
        troco_para:
          forma === "Dinheiro" && trocoTexto
            ? Number(trocoTexto.replace(",", "."))
            : null,
        desconto: 0,
        observacao: null,
        itens: itens.map((i) => ({
          produto_id: i.produto_id,
          variacao_id: i.variacao_id,
          quantidade: i.quantidade,
          observacao: i.observacao,
          adicionais: i.adicionais.map((a) => a.adicional_id),
        })),
      });

      if (!resultado.ok) {
        setErro(resultado.erro);
        return;
      }
      router.push(`/imprimir/${resultado.pedido_id}`);
    });
  }

  const podeFechar =
    itens.length > 0 &&
    clienteNome.trim().length > 0 &&
    (tipo === "RETIRADA" || Boolean(cliente));

  return (
    <div className="flex h-[calc(100vh-3.25rem)] lg:h-screen">
      {/* ---------------- CARDÁPIO ---------------- */}
      <section className="flex min-w-0 flex-1 flex-col pb-20 lg:pb-0">
        <header className="border-b border-borda px-6 py-4">
          <div className="mb-4 flex items-center gap-4">
            <h1 className="font-display text-2xl uppercase tracking-wide text-creme">
              Novo pedido
            </h1>
            <input
              className="campo max-w-xs"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar no cardápio…"
              aria-label="Buscar produto"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Pilula
              ativa={categoriaId === null}
              aoClicar={() => setCategoriaId(null)}
            >
              Tudo
            </Pilula>
            {categorias.map((c) => (
              <Pilula
                key={c.id}
                ativa={categoriaId === c.id}
                aoClicar={() => setCategoriaId(c.id)}
              >
                {c.nome}
              </Pilula>
            ))}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6">
          {produtosFiltrados.length === 0 ? (
            <div className="grid h-full place-items-center text-center">
              <div>
                <p className="font-display text-lg uppercase tracking-wide text-creme-suave">
                  Nada por aqui
                </p>
                <p className="mt-1 text-sm text-creme-fraco">
                  {produtos.length === 0
                    ? "Cadastre os pratos em Cardápio para começar a vender."
                    : "Nenhum produto com esse nome nesta categoria."}
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3">
              {produtosFiltrados.map((produto) => (
                <CartaoProduto
                  key={produto.id}
                  produto={produto}
                  aoClicar={() => escolherProduto(produto)}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ---------------- COMANDA ---------------- */}
      <aside
        className={
          "z-40 flex flex-col border-borda bg-carvao " +
          "fixed inset-0 transition-transform lg:static lg:w-[390px] lg:shrink-0 lg:translate-y-0 lg:border-l " +
          (verComanda ? "translate-y-0" : "translate-y-full lg:translate-y-0")
        }
      >
        <button
          type="button"
          onClick={() => setVerComanda(false)}
          className="flex items-center justify-between border-b border-borda px-4 py-3 text-sm text-creme-suave lg:hidden"
        >
          <span className="font-display uppercase tracking-wide">Comanda</span>
          <span>fechar</span>
        </button>
        {/* tipo + cliente */}
        <div className="border-b border-borda p-4">
          <div className="mb-3 grid grid-cols-2 gap-2">
            {(["ENTREGA", "RETIRADA"] as TipoEntrega[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTipo(t)}
                className={
                  "btn text-sm " + (tipo === t ? "btn-ouro" : "btn-quieto")
                }
              >
                {t === "ENTREGA" ? "Entrega" : "Retirada"}
              </button>
            ))}
          </div>

          {tipo === "ENTREGA" ? (
            cliente ? (
              <div className="rounded-lg border border-borda bg-breu px-3 py-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-creme">
                      {cliente.nome}
                    </p>
                    <p className="text-xs text-creme-suave">
                      {formatarTelefone(cliente.telefone)}
                    </p>
                    <p className="mt-1 text-xs leading-snug text-creme-suave">
                      {endereco || "Sem endereço cadastrado"}
                    </p>
                    {taxa > 0 && (
                      <p className="mt-1 text-xs text-ouro">
                        Taxa de entrega {reais(taxa)}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setCliente(null);
                      setBuscaCliente("");
                    }}
                    className="shrink-0 text-xs text-creme-fraco underline hover:text-ouro"
                  >
                    Trocar
                  </button>
                </div>
              </div>
            ) : (
              <div className="relative">
                <input
                  className="campo"
                  value={buscaCliente}
                  onChange={(e) => setBuscaCliente(e.target.value)}
                  placeholder="Cliente: nome ou telefone"
                  aria-label="Buscar cliente"
                />
                {clientesFiltrados.length > 0 && (
                  <ul className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-lg border border-borda-forte bg-madeira shadow-xl">
                    {clientesFiltrados.map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setCliente(c);
                            setBuscaCliente("");
                          }}
                          className="block w-full px-3 py-2 text-left text-sm hover:bg-ouro/15"
                        >
                          <span className="font-medium text-creme">{c.nome}</span>
                          <span className="ml-2 text-xs text-creme-suave">
                            {formatarTelefone(c.telefone)}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <button
                  type="button"
                  onClick={() => setCadastrando(true)}
                  className="mt-2 text-xs text-ouro underline hover:text-ouro-claro"
                >
                  {buscaCliente.trim() && clientesFiltrados.length === 0
                    ? `Nenhum encontrado — cadastrar "${buscaCliente.trim()}"`
                    : "Cadastrar cliente novo"}
                </button>
              </div>
            )
          ) : (
            <input
              className="campo"
              value={nomeAvulso}
              onChange={(e) => setNomeAvulso(e.target.value)}
              placeholder="Nome de quem vai retirar"
              aria-label="Nome do cliente"
            />
          )}
        </div>

        <Comanda
          itens={itens}
          tipo={tipo}
          clienteNome={clienteNome}
          endereco={endereco}
          taxa={taxa}
          desconto={0}
          aoRemover={(chave) =>
            setItens((atual) => atual.filter((i) => i.chave !== chave))
          }
          aoMudarQuantidade={mudarQuantidade}
        />

        {/* pagamento + fechar */}
        <div className="border-t border-borda p-4">
          <span className="rotulo">Pagamento</span>
          <div className="mb-3 grid grid-cols-4 gap-1.5">
            {PAGAMENTOS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setForma(p)}
                className={
                  "rounded-lg border px-1 py-2 text-xs font-medium transition-colors " +
                  (forma === p
                    ? "border-ouro bg-ouro/15 text-ouro"
                    : "border-borda text-creme-suave hover:border-borda-forte")
                }
              >
                {NOME_PAGAMENTO[p]}
              </button>
            ))}
          </div>

          {forma === "Dinheiro" && (
            <div className="mb-3 flex items-center gap-3">
              <input
                className="campo"
                inputMode="decimal"
                value={trocoTexto}
                onChange={(e) => setTrocoTexto(e.target.value)}
                placeholder="Troco para quanto?"
                aria-label="Troco para"
              />
              {troco > 0 && (
                <span className="shrink-0 text-sm text-creme-suave">
                  Levar <strong className="text-ouro">{reais(troco)}</strong>
                </span>
              )}
            </div>
          )}

          {erro && (
            <p
              role="alert"
              className="mb-3 rounded-lg border border-cancelado/40 bg-cancelado/10 px-3 py-2 text-sm text-cancelado"
            >
              {erro}
            </p>
          )}

          <button
            type="button"
            className="btn btn-ouro w-full py-4 text-base"
            disabled={!podeFechar || salvando}
            onClick={fecharPedido}
          >
            {salvando ? "Salvando…" : `Fechar pedido · ${reais(total)}`}
          </button>
        </div>
      </aside>

      {/* rodapé do celular: total sempre à vista, um toque abre a comanda */}
      <button
        type="button"
        onClick={() => setVerComanda(true)}
        className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between border-t border-borda bg-carvao px-4 py-3 lg:hidden"
      >
        <span className="text-sm text-creme-suave">
          {itens.length === 0
            ? "Nenhum item"
            : `${itens.length} ${itens.length === 1 ? "item" : "itens"} na comanda`}
        </span>
        <span className="flex items-center gap-3">
          <span className="tabular font-display text-xl text-ouro">
            {reais(total)}
          </span>
          <span className="rounded-lg bg-ouro/15 px-3 py-1.5 text-xs font-semibold text-ouro">
            Ver comanda
          </span>
        </span>
      </button>

      {cadastrando && (
        <FormularioCliente
          bairros={bairros}
          aoFechar={() => setCadastrando(false)}
          aoSalvar={() => router.refresh()}
        />
      )}

      {produtoAberto && (
        <ModalItem
          produto={produtoAberto}
          adicionais={adicionais}
          aoFechar={() => setProdutoAberto(null)}
          aoAdicionar={adicionar}
        />
      )}
    </div>
  );
}

function Pilula({
  ativa,
  aoClicar,
  children,
}: {
  ativa: boolean;
  aoClicar: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={aoClicar}
      aria-pressed={ativa}
      className={
        "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors " +
        (ativa
          ? "border-ouro bg-ouro/15 text-ouro"
          : "border-borda text-creme-suave hover:border-borda-forte hover:text-creme")
      }
    >
      {children}
    </button>
  );
}

function CartaoProduto({
  produto,
  aoClicar,
}: {
  produto: Produto;
  aoClicar: () => void;
}) {
  const variacoes = produto.produto_variacoes ?? [];
  const menorPreco = variacoes.length
    ? Math.min(...variacoes.map((v) => Number(v.preco)))
    : Number(produto.preco_base);

  return (
    <button
      type="button"
      onClick={aoClicar}
      disabled={!produto.disponivel}
      className="group flex h-full flex-col justify-between rounded-xl border border-borda bg-carvao p-4 text-left transition-colors hover:border-ouro disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-borda"
    >
      <div>
        <p className="font-medium leading-snug text-creme">{produto.nome}</p>
        {produto.descricao && (
          <p className="mt-1 line-clamp-2 text-xs leading-snug text-creme-suave">
            {produto.descricao}
          </p>
        )}
      </div>
      <p className="mt-3 font-display text-lg text-ouro tabular">
        {variacoes.length > 0 && (
          <span className="mr-1 text-xs text-creme-fraco">a partir de</span>
        )}
        {reais(menorPreco)}
      </p>
      {!produto.disponivel && (
        <p className="mt-1 text-xs font-semibold uppercase text-cancelado">
          Acabou hoje
        </p>
      )}
    </button>
  );
}
