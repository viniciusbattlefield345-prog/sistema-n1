"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Marca } from "@/components/Marca";
import { consultarPedidos, enviarPedido, type SituacaoPedido } from "./acoes";
import { numeroPedido, reais, subtotalCarrinho, totalItem } from "@/lib/formato";
import type { Adicional, Categoria, ItemCarrinho, Produto, StatusPedido } from "@/lib/tipos";

/**
 * Cardápio do cliente, aberto pelo QR da mesa.
 *
 * O carrinho e a lista de pedidos enviados ficam guardados no próprio
 * celular: recarregar a página ou bloquear a tela não perde nada. Preço
 * guardado aqui é só pra mostrar — quem soma de verdade é o servidor.
 */

type Enviado = { id: number; em: number };

const DOZE_HORAS = 12 * 3600_000;
/** Tempo que a folha leva pra descer antes de sumir da tela. */
const SAIDA_FOLHA = 180;
/** Menor nome aceito. O servidor exige o mesmo; aqui é só pra avisar antes. */
const NOME_MINIMO = 2;
const FINAIS: StatusPedido[] = ["CONCLUIDO", "CANCELADO"];

const SITUACAO: Record<StatusPedido, { texto: string; cor: string }> = {
  AGUARDANDO: { texto: "Esperando o atendente confirmar", cor: "text-ouro" },
  PENDENTE: { texto: "Confirmado · na fila da cozinha", cor: "text-preparo" },
  "EM PREPARO": { texto: "Sendo preparado", cor: "text-preparo" },
  PRONTO: { texto: "Pronto! Já vai pra sua mesa", cor: "text-pronto" },
  "SAIU PARA ENTREGA": { texto: "A caminho", cor: "text-pronto" },
  CONCLUIDO: { texto: "Entregue", cor: "text-creme-suave" },
  CANCELADO: { texto: "Não foi aceito", cor: "text-cancelado" },
};

function ler<T>(chave: string, padrao: T): T {
  try {
    const bruto = localStorage.getItem(chave);
    return bruto ? (JSON.parse(bruto) as T) : padrao;
  } catch {
    return padrao;
  }
}

function gravar(chave: string, valor: unknown) {
  try {
    localStorage.setItem(chave, JSON.stringify(valor));
  } catch {
    // navegador anônimo ou sem espaço: o pedido funciona, só não lembra
  }
}

function nomeServe(n: string): boolean {
  return n.trim().length >= NOME_MINIMO;
}

function menorPreco(p: Produto) {
  const variacoes = p.produto_variacoes ?? [];
  return variacoes.length
    ? Math.min(...variacoes.map((v) => Number(v.preco)))
    : Number(p.preco_base);
}

export function CardapioMesa({
  mesa,
  lojaAberta,
  categorias,
  produtos,
  adicionais,
  instagram,
}: {
  mesa: { numero: number; codigo: string };
  lojaAberta: boolean;
  categorias: Categoria[];
  produtos: Produto[];
  adicionais: Adicional[];
  instagram: string;
}) {
  const chaveCarrinho = `gb:carrinho:${mesa.codigo}`;
  const chaveEnviados = `gb:pedidos:${mesa.codigo}`;

  const [itens, setItens] = useState<ItemCarrinho[]>([]);
  const [nome, setNome] = useState("");
  const [nomeConfirmado, setNomeConfirmado] = useState(false);
  const [leuMemoria, setLeuMemoria] = useState(false);
  const [observacao, setObservacao] = useState("");
  const [escolhendo, setEscolhendo] = useState<Produto | null>(null);
  const [verCarrinho, setVerCarrinho] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [confirmado, setConfirmado] = useState<number | null>(null);
  const [meus, setMeus] = useState<SituacaoPedido[]>([]);
  const [ativa, setAtiva] = useState<string | null>(null);
  const [saindo, setSaindo] = useState<"carrinho" | "escolha" | null>(null);
  const [enviando, iniciar] = useTransition();

  const carregou = useRef(false);
  const temPendente = useRef(false);

  // --- memória do celular -------------------------------------------------
  useEffect(() => {
    setItens(ler<ItemCarrinho[]>(chaveCarrinho, []));
    const guardado = ler("gb:nome", "");
    setNome(guardado);
    // O nome vale pelo turno: 12h depois, quem está nesta mesa é outra pessoa.
    if (nomeServe(guardado) && Date.now() < ler<number>("gb:nome:vale-ate", 0))
      setNomeConfirmado(true);
    setLeuMemoria(true);
    carregou.current = true;
  }, [chaveCarrinho]);

  useEffect(() => {
    if (carregou.current) gravar(chaveCarrinho, itens);
  }, [itens, chaveCarrinho]);

  // --- andamento dos pedidos já enviados ---------------------------------
  const atualizar = useCallback(async () => {
    const lista = ler<Enviado[]>(chaveEnviados, []).filter(
      (e) => Date.now() - e.em < DOZE_HORAS,
    );
    gravar(chaveEnviados, lista);
    if (lista.length === 0) {
      setMeus([]);
      temPendente.current = false;
      return;
    }
    try {
      const situacao = await consultarPedidos(mesa.codigo, lista.map((e) => e.id));
      setMeus(situacao);
      temPendente.current = situacao.some((p) => !FINAIS.includes(p.status));
    } catch {
      // sem sinal agora: tenta de novo no próximo ciclo
    }
  }, [chaveEnviados, mesa.codigo]);

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

  // --- cardápio por seção -------------------------------------------------
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

  const quantidadeItens = itens.reduce((s, i) => s + i.quantidade, 0);
  const subtotal = subtotalCarrinho(itens);

  /* Fechar é em dois tempos: a folha desce, e só então sai da tela. */
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

  function lembrarNome(valor: string) {
    gravar("gb:nome", valor);
    gravar("gb:nome:vale-ate", Date.now() + DOZE_HORAS);
  }

  function confirmarNome() {
    if (!nomeServe(nome)) return;
    const limpo = nome.trim();
    setNome(limpo);
    lembrarNome(limpo);
    setNomeConfirmado(true);
  }

  function enviar() {
    setErro(null);
    if (!nomeServe(nome)) {
      setErro("Diga seu nome antes de enviar — é por ele que o atendente te acha.");
      return;
    }
    iniciar(async () => {
      try {
        const r = await enviarPedido(mesa.codigo, {
          nome,
          observacao,
          itens: itens.map((i) => ({
            produto_id: i.produto_id,
            variacao_id: i.variacao_id,
            quantidade: i.quantidade,
            observacao: i.observacao,
            adicionais: i.adicionais.map((a) => a.adicional_id),
          })),
        });
        if (!r.ok) {
          setErro(r.erro);
          return;
        }
        const lista = ler<Enviado[]>(chaveEnviados, []);
        gravar(chaveEnviados, [{ id: r.pedido_id, em: Date.now() }, ...lista].slice(0, 20));
        lembrarNome(nome.trim());
        setItens([]);
        setObservacao("");
        fecharCarrinho();
        setConfirmado(r.numero_dia ?? 0);
        void atualizar();
      } catch {
        setErro("Não consegui enviar — confira a internet do celular e tente de novo.");
      }
    });
  }

  return (
    // O cardápio é feito pra uma mão: no computador ele fica numa coluna
    // central em vez de esticar a linha do produto pela tela toda.
    <div className="mx-auto min-h-screen max-w-2xl bg-breu pb-32 text-creme">
      {/* Antes do cardápio: quem é você? Sem isso o pedido chega sem dono na
          tela do atendente. Só aparece depois de ler a memória do celular,
          senão piscaria pra quem já disse o nome. */}
      {leuMemoria && !nomeConfirmado && (
        <PortaNome
          mesa={mesa.numero}
          nome={nome}
          aoMudar={setNome}
          aoEntrar={confirmarNome}
        />
      )}

      {/* topo com a curva laranja do cardápio impresso */}
      <header className="relative overflow-hidden bg-black px-5 pb-12 pt-6">
        <div className="flex items-start justify-between gap-4">
          <Marca tamanho={1.4} alinhamento="esquerda" />
          <span className="shrink-0 whitespace-nowrap rounded-full border border-ouro/60 bg-ouro/10 px-3.5 py-1.5 font-display text-sm font-bold uppercase tracking-wide text-ouro">
            Mesa {mesa.numero}
          </span>
        </div>
        <p className="mt-6 font-script text-6xl leading-none text-creme">Cardápio</p>
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
          Dá pra olhar o cardápio; os pedidos abrem junto com o caixa.
        </div>
      )}

      {meus.length > 0 && (
        <section
          aria-live="polite"
          className="mx-4 mt-3 rounded-2xl border border-borda bg-carvao p-4"
        >
          <h2 className="mb-3 font-display text-xs font-bold uppercase tracking-[0.16em] text-creme-suave">
            Seus pedidos
          </h2>
          <ul className="space-y-3">
            {meus.map((p, indice) => (
              <li
                key={p.id}
                style={{ "--i": Math.min(indice, 5) } as React.CSSProperties}
                className="anim-entrar border-t border-borda pt-3 first:border-0 first:pt-0"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-display font-bold">
                    Pedido {numeroPedido(p.numero_dia)}
                  </span>
                  <span className="tabular text-sm text-creme-suave">{reais(p.total)}</span>
                </div>
                <p
                  className={
                    "mt-0.5 flex items-center gap-1.5 text-sm font-semibold " +
                    SITUACAO[p.status].cor
                  }
                >
                  {/* pedido ainda andando: o pontinho pisca pra mostrar que está vivo */}
                  {!FINAIS.includes(p.status) && (
                    <span
                      aria-hidden
                      className="anim-batida size-1.5 shrink-0 rounded-full bg-current"
                    />
                  )}
                  {SITUACAO[p.status].texto}
                </p>
                {p.status === "CANCELADO" && p.motivo_recusa && (
                  <p className="text-xs text-creme-suave">Motivo: {p.motivo_recusa}</p>
                )}
                <p className="mt-1 text-xs leading-snug text-creme-fraco">
                  {p.itens.map((i) => `${i.quantidade}x ${i.nome}`).join(" · ")}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* categorias */}
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
                document.getElementById(s.id)?.scrollIntoView({ behavior: "smooth", block: "start" })
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

      <main className="px-4">
        {secoes.length === 0 && (
          <p className="py-16 text-center text-sm text-creme-suave">
            O cardápio está sendo atualizado. Chame o atendente.
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
                    onClick={() => setEscolhendo(p)}
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
                          <span className="mr-1 text-xs font-normal text-creme-fraco">a partir de</span>
                        )}
                        {reais(menorPreco(p))}
                      </p>
                      {!p.disponivel && (
                        <p className="mt-1 text-xs font-bold uppercase text-cancelado">
                          Esgotado hoje
                        </p>
                      )}
                    </div>
                    {p.foto_url && (
                      <Foto url={p.foto_url} className="size-24 shrink-0 rounded-2xl" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}

        <footer className="py-12 text-center text-xs leading-relaxed text-creme-fraco">
          {instagram && <p className="mb-1 text-creme-suave">{instagram}</p>}
          <p>O atendente confirma cada pedido antes de ir pra cozinha.</p>
          <p>Você paga no fim, na conta da mesa.</p>
        </footer>
      </main>

      {/* pedido enviado */}
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
              Assim que o atendente confirmar, ele vai pra cozinha. Acompanhe em “Seus pedidos”, lá em cima.
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

      {/* barra do carrinho */}
      {itens.length > 0 && !verCarrinho && (
        <div className="anim-barra fixed inset-x-0 bottom-0 z-40 mx-auto max-w-2xl bg-gradient-to-t from-breu via-breu/95 to-transparent px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-8">
          <button
            type="button"
            onClick={() => setVerCarrinho(true)}
            className="btn btn-ouro w-full justify-between px-5 py-4 text-base"
          >
            <span>
              Ver pedido ·{" "}
              {/* a key troca a cada item: é o que faz o número pular de novo */}
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
              Seu pedido · Mesa {mesa.numero}
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
            {itens.length === 0 ? (
              <p className="py-10 text-center text-sm text-creme-suave">Seu pedido está vazio.</p>
            ) : (
              <ul className="space-y-5">
                {itens.map((i) => (
                  <li key={i.chave} className="flex gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold leading-snug">
                        {i.produto_nome}
                        {i.variacao_nome && ` (${i.variacao_nome})`}
                      </p>
                      {i.adicionais.length > 0 && (
                        <p className="text-xs text-creme-suave">
                          + {i.adicionais.map((a) => a.nome).join(", ")}
                        </p>
                      )}
                      {i.observacao && (
                        <p className="text-xs italic text-preparo">“{i.observacao}”</p>
                      )}
                      <div className="mt-2 flex items-center gap-2">
                        <Passo rotulo={`Tirar um ${i.produto_nome}`} aoTocar={() => mudarQuantidade(i.chave, -1)}>
                          −
                        </Passo>
                        <span className="tabular w-6 text-center font-display font-bold">
                          {i.quantidade}
                        </span>
                        <Passo rotulo={`Somar um ${i.produto_nome}`} aoTocar={() => mudarQuantidade(i.chave, 1)}>
                          +
                        </Passo>
                        <button
                          type="button"
                          onClick={() => setItens((a) => a.filter((x) => x.chave !== i.chave))}
                          className="ml-2 text-xs text-creme-fraco underline"
                        >
                          Remover
                        </button>
                      </div>
                    </div>
                    <span className="tabular shrink-0 font-semibold">{reais(totalItem(i))}</span>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-7 space-y-4">
              <div>
                <label className="rotulo" htmlFor="cliente-nome">
                  Quem está pedindo?
                </label>
                <input
                  id="cliente-nome"
                  className="campo"
                  maxLength={40}
                  autoComplete="given-name"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex.: Vinícius"
                  aria-invalid={!nomeServe(nome)}
                />
                <p className="mt-1.5 text-xs text-creme-fraco">
                  Passou o celular pra outra pessoa? Troque o nome aqui. A conta
                  continua uma só, da mesa.
                </p>
              </div>
              <div>
                <label className="rotulo" htmlFor="pedido-obs">
                  Observação do pedido (opcional)
                </label>
                <input
                  id="pedido-obs"
                  className="campo"
                  maxLength={200}
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                  placeholder="Ex.: trazer tudo junto"
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
            <div className="mb-3 flex items-baseline justify-between">
              <span className="text-sm text-creme-suave">Total</span>
              <span className="tabular font-display text-2xl font-extrabold text-ouro">
                {reais(subtotal)}
              </span>
            </div>
            <button
              type="button"
              className="btn btn-ouro w-full py-4 text-base"
              disabled={enviando || !lojaAberta || itens.length === 0 || !nomeServe(nome)}
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

/** Folha que sobe de baixo no celular e vira janela no computador. */
/**
 * Porta de entrada da mesa: o nome, antes de qualquer coisa.
 *
 * Cobre a tela inteira porque é obrigatório — mas o cardápio fica visível
 * atrás, pra pessoa ver que chegou no lugar certo enquanto digita.
 */
function PortaNome({
  mesa,
  nome,
  aoMudar,
  aoEntrar,
}: {
  mesa: number;
  nome: string;
  aoMudar: (v: string) => void;
  aoEntrar: () => void;
}) {
  const serve = nomeServe(nome);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="porta-nome-titulo"
      className="fixed inset-0 z-50 flex items-center justify-center bg-breu/95 px-5 backdrop-blur-sm"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          aoEntrar();
        }}
        className="anim-entrar w-full max-w-sm"
      >
        <Marca tamanho={1.5} alinhamento="centro" />

        <span className="mx-auto mt-6 block w-fit rounded-full border border-ouro/60 bg-ouro/10 px-3.5 py-1.5 font-display text-sm font-bold uppercase tracking-wide text-ouro">
          Mesa {mesa}
        </span>

        <h1
          id="porta-nome-titulo"
          className="mt-5 text-center font-display text-3xl font-extrabold uppercase leading-tight"
        >
          Qual é o seu nome?
        </h1>
        <p className="mt-2 text-center text-sm text-creme-suave">
          É assim que o atendente sabe de quem é cada pedido quando a mesa tem
          mais gente. A conta continua sendo uma só, da mesa.
        </p>

        <input
          autoFocus
          className="campo mt-6 text-center text-lg"
          maxLength={40}
          autoComplete="given-name"
          enterKeyHint="go"
          value={nome}
          onChange={(e) => aoMudar(e.target.value)}
          placeholder="Seu nome"
          aria-label="Seu nome"
        />

        <button type="submit" disabled={!serve} className="btn btn-ouro mt-4 w-full py-3.5 text-base">
          Ver o cardápio
        </button>

        {!serve && nome.trim().length > 0 && (
          <p className="mt-2 text-center text-xs text-creme-fraco">
            Escreva pelo menos {NOME_MINIMO} letras.
          </p>
        )}
      </form>
    </div>
  );
}

function Folha({
  rotulo,
  aoFechar,
  saindo = false,
  children,
}: {
  rotulo: string;
  aoFechar: () => void;
  /** Ligado pelo pai durante os SAIDA_FOLHA ms em que a folha desce. */
  saindo?: boolean;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const esc = (e: KeyboardEvent) => e.key === "Escape" && aoFechar();
    window.addEventListener("keydown", esc);
    return () => {
      document.body.style.overflow = anterior;
      window.removeEventListener("keydown", esc);
    };
  }, [aoFechar]);

  return (
    <div
      className={
        "anim-fundo fixed inset-0 z-50 flex items-end justify-center bg-black/75 transition-opacity duration-150 sm:items-center sm:p-4 " +
        (saindo ? "opacity-0" : "opacity-100")
      }
      onClick={aoFechar}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={rotulo}
        onClick={(e) => e.stopPropagation()}
        className={
          "anim-folha flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-borda bg-carvao transition-transform duration-150 ease-in sm:rounded-3xl " +
          (saindo ? "translate-y-full sm:translate-y-0 sm:scale-95" : "translate-y-0")
        }
      >
        {children}
      </div>
    </div>
  );
}

/** Foto do produto: o lugar já fica reservado, brilhando, até ela chegar. */
function Foto({ url, className = "" }: { url: string; className?: string }) {
  const [pronta, setPronta] = useState(false);

  return (
    <span className={"relative block overflow-hidden " + className}>
      {!pronta && <span aria-hidden className="anim-brilho absolute inset-0" />}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt=""
        loading="lazy"
        onLoad={() => setPronta(true)}
        onError={() => setPronta(true)}
        className={
          "size-full object-cover transition-opacity duration-300 " +
          (pronta ? "opacity-100" : "opacity-0")
        }
      />
    </span>
  );
}

function Passo({
  rotulo,
  aoTocar,
  children,
}: {
  rotulo: string;
  aoTocar: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={aoTocar}
      aria-label={rotulo}
      className="grid size-9 place-items-center rounded-full border border-borda-forte text-lg leading-none text-creme"
    >
      {children}
    </button>
  );
}

function EscolhaProduto({
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
        {produto.foto_url && (
          <Foto url={produto.foto_url} className="aspect-[4/3] w-full" />
        )}
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
                <label key={v.id} className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3.5">
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
                  <span className="tabular text-sm text-creme-suave">{reais(Number(v.preco))}</span>
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
                  <label key={a.id} className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3.5">
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
                      <span className="tabular text-sm text-creme-suave">+ {reais(Number(a.preco))}</span>
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
          <Passo rotulo="Diminuir quantidade" aoTocar={() => setQuantidade((q) => Math.max(1, q - 1))}>
            −
          </Passo>
          <span className="tabular w-6 text-center font-display text-lg font-bold">{quantidade}</span>
          <Passo rotulo="Aumentar quantidade" aoTocar={() => setQuantidade((q) => Math.min(99, q + 1))}>
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
