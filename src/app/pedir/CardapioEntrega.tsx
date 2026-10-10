"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Marca } from "@/components/Marca";
import { EscolhaProduto } from "@/components/cardapio/EscolhaProduto";
import { Folha, SAIDA_FOLHA } from "@/components/cardapio/Folha";
import { ItensCarrinho } from "@/components/cardapio/ItensCarrinho";
import { ListaCardapio } from "@/components/cardapio/ListaCardapio";
import { MeusPedidos } from "@/components/cardapio/MeusPedidos";
import { PortaEntrega } from "./PortaEntrega";
import { consultarPedidosEntrega, enviarPedidoEntrega, type SituacaoEntrega } from "./acoes";
import {
  CLIENTE_VAZIO,
  dadosServem,
  type BairroAtendido,
  type DadosCliente,
} from "./dados";
import { FORMAS_PAGAMENTO, curarCarrinho, nomePagamento, numeroPedido, paraNumero, reais, subtotalCarrinho, telefone as formatarTelefone } from "@/lib/formato";
import { gravar, ler } from "@/lib/memoria";
import type {
  Adicional,
  Categoria,
  FormaPagamento,
  ItemCarrinho,
  Produto,
  StatusPedido,
} from "@/lib/tipos";

type Enviado = { id: number; em: number };

const DOZE_HORAS = 12 * 3600_000;
const FINAIS: StatusPedido[] = ["CONCLUIDO", "CANCELADO"];

const CHAVE_CLIENTE = "gb:entrega:cliente";
const CHAVE_CARRINHO = "gb:entrega:carrinho";
const CHAVE_ENVIADOS = "gb:entrega:pedidos";

/**
 * O cardápio do link público de delivery.
 *
 * Mesma lista e mesma folha de produto da mesa — o que muda é a porta de
 * entrada (quem é você, e pra onde vai) e o fechamento (taxa do bairro,
 * forma de pagamento e troco).
 */
export function CardapioEntrega({
  lojaAberta,
  categorias,
  produtos,
  adicionais,
  bairros,
  instagram,
  telefoneLoja,
}: {
  lojaAberta: boolean;
  categorias: Categoria[];
  produtos: Produto[];
  adicionais: Adicional[];
  bairros: BairroAtendido[];
  instagram: string;
  telefoneLoja: string;
}) {
  const [cliente, setCliente] = useState<DadosCliente>(CLIENTE_VAZIO);
  const [entrou, setEntrou] = useState(false);
  const [leuMemoria, setLeuMemoria] = useState(false);

  const [itens, setItens] = useState<ItemCarrinho[]>([]);
  const [pagamento, setPagamento] = useState<FormaPagamento>("Dinheiro");
  const [trocoPara, setTrocoPara] = useState("");
  const [observacao, setObservacao] = useState("");

  const [escolhendo, setEscolhendo] = useState<Produto | null>(null);
  const [verCarrinho, setVerCarrinho] = useState(false);
  const [saindo, setSaindo] = useState<"carrinho" | "escolha" | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [confirmado, setConfirmado] = useState<number | null>(null);
  const [meus, setMeus] = useState<SituacaoEntrega[]>([]);
  const [enviando, iniciar] = useTransition();

  const carregou = useRef(false);
  const temPendente = useRef(false);

  // --- memória do celular -------------------------------------------------
  useEffect(() => {
    setItens(curarCarrinho(ler<ItemCarrinho[]>(CHAVE_CARRINHO, [])));
    const guardado = ler<DadosCliente | null>(CHAVE_CLIENTE, null);
    if (guardado && dadosServem(guardado)) {
      setCliente(guardado);
      setEntrou(true);
    }
    setLeuMemoria(true);
    carregou.current = true;
  }, []);

  useEffect(() => {
    if (carregou.current) gravar(CHAVE_CARRINHO, itens);
  }, [itens]);

  // --- andamento dos pedidos já enviados ---------------------------------
  const atualizar = useCallback(async () => {
    if (!cliente.telefone) return;
    const lista = ler<Enviado[]>(CHAVE_ENVIADOS, []).filter((e) => Date.now() - e.em < DOZE_HORAS);
    gravar(CHAVE_ENVIADOS, lista);
    if (lista.length === 0) {
      setMeus([]);
      temPendente.current = false;
      return;
    }
    try {
      const situacao = await consultarPedidosEntrega(
        cliente.telefone,
        lista.map((e) => e.id),
      );
      setMeus(situacao);
      temPendente.current = situacao.some((p) => !FINAIS.includes(p.status));
    } catch {
      // sem sinal agora: tenta de novo no próximo ciclo
    }
  }, [cliente.telefone]);

  useEffect(() => {
    void atualizar();
    const relogio = setInterval(() => {
      if (temPendente.current && document.visibilityState === "visible") void atualizar();
    }, 8000);
    const aoVoltar = () => {
      if (document.visibilityState === "visible") void atualizar();
    };
    document.addEventListener("visibilitychange", aoVoltar);
    return () => {
      clearInterval(relogio);
      document.removeEventListener("visibilitychange", aoVoltar);
    };
  }, [atualizar]);

  const ehEntrega = cliente.tipo === "ENTREGA";
  const bairro = bairros.find((b) => b.id === cliente.bairro_id) ?? null;
  const taxa = ehEntrega && bairro ? Number(bairro.taxa) : 0;
  const subtotal = subtotalCarrinho(itens);
  const total = subtotal + taxa;
  const quantidadeItens = itens.reduce((s, i) => s + i.quantidade, 0);

  const troco = paraNumero(trocoPara);
  const trocoCurto = pagamento === "Dinheiro" && troco > 0 && troco < total;

  function entrar(d: DadosCliente) {
    setCliente(d);
    gravar(CHAVE_CLIENTE, d);
    setEntrou(true);
  }

  function fecharCarrinho() {
    setSaindo("carrinho");
    setTimeout(() => {
      setVerCarrinho(false);
      setSaindo(null);
    }, SAIDA_FOLHA);
  }

  function fecharEscolha() {
    setSaindo("escolha");
    setTimeout(() => {
      setEscolhendo(null);
      setSaindo(null);
    }, SAIDA_FOLHA);
  }

  function adicionar(item: ItemCarrinho) {
    setItens((atual) => [...atual, item]);
    setErro(null);
    setConfirmado(null);
    fecharEscolha();
  }

  function mudarQuantidade(chave: string, delta: number) {
    setItens((atual) =>
      atual.flatMap((i) => {
        if (i.chave !== chave) return [i];
        const nova = i.quantidade + delta;
        return nova <= 0 ? [] : [{ ...i, quantidade: Math.min(nova, 99) }];
      }),
    );
  }

  function enviar() {
    setErro(null);
    if (!dadosServem(cliente)) {
      setErro("Faltou algum dado seu. Toque em “Meus dados” pra completar.");
      return;
    }
    if (trocoCurto) {
      setErro("O troco não pode ser menor que o total do pedido.");
      return;
    }
    iniciar(async () => {
      try {
        const r = await enviarPedidoEntrega({
          ...cliente,
          forma_pagamento: pagamento,
          troco_para: pagamento === "Dinheiro" && troco > 0 ? troco : null,
          observacao,
          itens: itens.map((i) => ({
            produto_id: i.produto_id,
            segundo_produto_id: i.segundo_produto_id ?? null,
            variacao_id: i.variacao_id,
            quantidade: i.quantidade,
            observacao: i.observacao,
            adicionais: i.adicionais.map((a) => ({
              adicional_id: a.adicional_id,
              quantidade: a.quantidade,
            })),
          })),
        });
        if (!r.ok) {
          setErro(r.erro);
          return;
        }
        const lista = ler<Enviado[]>(CHAVE_ENVIADOS, []);
        gravar(CHAVE_ENVIADOS, [{ id: r.pedido_id, em: Date.now() }, ...lista].slice(0, 20));
        gravar(CHAVE_CLIENTE, cliente);
        setItens([]);
        setObservacao("");
        setTrocoPara("");
        fecharCarrinho();
        setConfirmado(r.numero_dia ?? 0);
        void atualizar();
      } catch {
        setErro("Não consegui enviar — confira a internet do celular e tente de novo.");
      }
    });
  }

  return (
    <div className="mx-auto min-h-screen max-w-2xl bg-breu pb-32 text-creme">
      {leuMemoria && !entrou && (
        <PortaEntrega bairros={bairros} inicial={cliente} aoEntrar={entrar} />
      )}

      <header className="relative overflow-hidden bg-black px-5 pb-12 pt-6">
        <div className="flex items-start justify-between gap-4">
          <Marca tamanho={1.4} alinhamento="esquerda" />
          <span className="shrink-0 whitespace-nowrap rounded-full border border-ouro/60 bg-ouro/10 px-3.5 py-1.5 font-display text-sm font-bold uppercase tracking-wide text-ouro">
            {ehEntrega ? "Entrega" : "Retirada"}
          </span>
        </div>
        <p className="mt-6 font-script text-6xl leading-none text-creme">Delivery</p>
        <p className="mt-3 max-w-xs text-sm text-creme-suave">
          Escolha, envie e acompanhe seu pedido daqui mesmo.
        </p>
        <svg
          aria-hidden
          viewBox="0 0 400 40"
          preserveAspectRatio="none"
          className="absolute inset-x-0 bottom-0 h-10 w-full"
        >
          <path d="M0 40 L0 30 Q 210 -4 400 16 L400 40 Z" className="fill-breu" />
          <path d="M0 30 Q 210 -4 400 16" fill="none" strokeWidth="6" className="stroke-ouro" />
        </svg>
      </header>

      {!lojaAberta && (
        <div
          role="status"
          className="mx-4 mt-2 rounded-2xl border border-cancelado/40 bg-cancelado/10 px-4 py-3 text-sm text-cancelado"
        >
          <strong className="block">Estamos fechados agora.</strong>
          Dá pra olhar o cardápio; os pedidos abrem quando a loja abre.
        </div>
      )}

      {entrou && (
        <section className="mx-4 mt-3 flex items-start justify-between gap-3 rounded-2xl border border-borda bg-carvao px-4 py-3">
          <div className="min-w-0 text-sm">
            <p className="font-semibold">{cliente.nome}</p>
            <p className="truncate text-xs text-creme-suave">
              {ehEntrega
                ? `${cliente.endereco}${cliente.numero ? `, ${cliente.numero}` : ""}${bairro ? ` — ${bairro.nome}` : ""}`
                : "Retirada na loja"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setEntrou(false)}
            className="shrink-0 text-xs text-creme-suave underline underline-offset-2"
          >
            Meus dados
          </button>
        </section>
      )}

      <MeusPedidos pedidos={meus} />

      <main className="px-4">
        <ListaCardapio produtos={produtos} categorias={categorias} aoEscolher={setEscolhendo} />

        <footer className="py-12 text-center text-xs leading-relaxed text-creme-fraco">
          {instagram && <p className="mb-1 text-creme-suave">{instagram}</p>}
          {telefoneLoja && <p className="mb-1">{formatarTelefone(telefoneLoja)}</p>}
          <p>A loja confirma seu pedido antes de começar a preparar.</p>
        </footer>
      </main>

      {confirmado !== null && itens.length === 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-2xl px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div
            role="status"
            className="anim-aviso rounded-2xl border border-pronto/50 bg-carvao p-4 shadow-2xl shadow-black"
          >
            <p className="font-display text-lg font-extrabold uppercase text-pronto">
              Pedido {numeroPedido(confirmado)} enviado!
            </p>
            <p className="mt-1 text-sm text-creme-suave">
              A loja vai confirmar em instantes. Acompanhe em “Seus pedidos”, lá em cima.
            </p>
            <button
              type="button"
              onClick={() => setConfirmado(null)}
              className="btn btn-quieto mt-3 w-full py-2.5 text-sm"
            >
              Pedir mais alguma coisa
            </button>
          </div>
        </div>
      )}

      {itens.length > 0 && !verCarrinho && (
        <div className="anim-barra fixed inset-x-0 bottom-0 z-40 mx-auto max-w-2xl bg-gradient-to-t from-breu via-breu/95 to-transparent px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-8">
          <button
            type="button"
            onClick={() => setVerCarrinho(true)}
            className="btn btn-ouro w-full justify-between px-5 py-4 text-base"
          >
            <span>
              Ver pedido ·{" "}
              <span key={quantidadeItens} className="anim-pulo inline-block">
                {quantidadeItens}
              </span>{" "}
              {quantidadeItens === 1 ? "item" : "itens"}
            </span>
            <span className="tabular">{reais(subtotal)}</span>
          </button>
        </div>
      )}

      {verCarrinho && (
        <Folha rotulo="Seu pedido" saindo={saindo === "carrinho"} aoFechar={fecharCarrinho}>
          <header className="flex items-center justify-between gap-3 border-b border-borda px-5 py-4">
            <h2 className="font-display text-lg font-extrabold uppercase">
              Seu pedido · {ehEntrega ? "Entrega" : "Retirada"}
            </h2>
            <button
              type="button"
              onClick={fecharCarrinho}
              className="text-sm text-creme-suave underline underline-offset-2"
            >
              Voltar
            </button>
          </header>

          <div className="flex-1 overflow-y-auto px-5 py-4">
            <ItensCarrinho
              itens={itens}
              aoMudarQuantidade={mudarQuantidade}
              aoRemover={(chave) => setItens((a) => a.filter((x) => x.chave !== chave))}
            />

            <div className="mt-7 space-y-4">
              <fieldset>
                <legend className="rotulo">Como você vai pagar?</legend>
                <div className="grid grid-cols-2 gap-2">
                  {FORMAS_PAGAMENTO.map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setPagamento(f)}
                      aria-pressed={pagamento === f}
                      className={
                        "rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors " +
                        (pagamento === f
                          ? "border-ouro bg-ouro/15 text-ouro"
                          : "border-borda text-creme-suave")
                      }
                    >
                      {nomePagamento(f)}
                    </button>
                  ))}
                </div>
              </fieldset>

              {pagamento === "Dinheiro" && (
                <div>
                  <label className="rotulo" htmlFor="entrega-troco">
                    Precisa de troco pra quanto? (opcional)
                  </label>
                  <input
                    id="entrega-troco"
                    className="campo"
                    inputMode="decimal"
                    value={trocoPara}
                    onChange={(e) => setTrocoPara(e.target.value)}
                    placeholder="Ex.: 50,00"
                    aria-invalid={trocoCurto}
                  />
                  <p className="mt-1.5 text-xs text-creme-fraco">
                    {trocoCurto
                      ? "Esse valor é menor que o total do pedido."
                      : troco > 0
                        ? `Levamos ${reais(Math.max(troco - total, 0))} de troco.`
                        : "Deixe em branco se tiver o valor certo."}
                  </p>
                </div>
              )}

              <div>
                <label className="rotulo" htmlFor="entrega-obs">
                  Observação do pedido (opcional)
                </label>
                <input
                  id="entrega-obs"
                  className="campo"
                  maxLength={200}
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                  placeholder="Ex.: interfone quebrado, ligar ao chegar"
                />
              </div>
            </div>
          </div>

          <footer className="border-t border-borda px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
            {erro && (
              <p
                role="alert"
                className="mb-3 rounded-xl border border-cancelado/40 bg-cancelado/10 px-3 py-2 text-sm text-cancelado"
              >
                {erro}
              </p>
            )}

            <dl className="mb-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <dt className="text-creme-suave">Itens</dt>
                <dd className="tabular">{reais(subtotal)}</dd>
              </div>
              {ehEntrega && (
                <div className="flex justify-between">
                  <dt className="text-creme-suave">
                    Entrega{bairro ? ` · ${bairro.nome}` : ""}
                  </dt>
                  <dd className="tabular">{taxa > 0 ? reais(taxa) : "Grátis"}</dd>
                </div>
              )}
              <div className="flex items-baseline justify-between pt-1">
                <dt className="text-sm text-creme-suave">Total</dt>
                <dd className="tabular font-display text-2xl font-extrabold text-ouro">
                  {reais(total)}
                </dd>
              </div>
            </dl>

            <button
              type="button"
              className="btn btn-ouro w-full py-4 text-base"
              disabled={enviando || !lojaAberta || itens.length === 0 || !dadosServem(cliente)}
              onClick={enviar}
            >
              {enviando ? "Enviando…" : lojaAberta ? "Enviar pedido" : "Fechado agora"}
            </button>
          </footer>
        </Folha>
      )}

      {escolhendo && (
        <EscolhaProduto
          produto={escolhendo}
          produtos={produtos}
          categorias={categorias}
          adicionais={adicionais}
          lojaAberta={lojaAberta}
          saindo={saindo === "escolha"}
          aoFechar={fecharEscolha}
          aoAdicionar={adicionar}
        />
      )}
    </div>
  );
}
