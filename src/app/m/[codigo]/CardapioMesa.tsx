"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Marca } from "@/components/Marca";
import { EscolhaProduto } from "@/components/cardapio/EscolhaProduto";
import { Folha, SAIDA_FOLHA } from "@/components/cardapio/Folha";
import { ItensCarrinho } from "@/components/cardapio/ItensCarrinho";
import { ListaCardapio } from "@/components/cardapio/ListaCardapio";
import { MeusPedidos } from "@/components/cardapio/MeusPedidos";
import { consultarPedidos, enviarPedido, type SituacaoPedido } from "./acoes";
import { numeroPedido, reais, subtotalCarrinho } from "@/lib/formato";
import { gravar, ler } from "@/lib/memoria";
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
/** Menor nome aceito. O servidor exige o mesmo; aqui é só pra avisar antes. */
const NOME_MINIMO = 2;
const FINAIS: StatusPedido[] = ["CONCLUIDO", "CANCELADO"];

function nomeServe(n: string): boolean {
  return n.trim().length >= NOME_MINIMO;
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
        <PortaNome mesa={mesa.numero} nome={nome} aoMudar={setNome} aoEntrar={confirmarNome} />
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

      <MeusPedidos pedidos={meus} />

      <main className="px-4">
        <ListaCardapio produtos={produtos} categorias={categorias} aoEscolher={setEscolhendo} />

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
            <ItensCarrinho
              itens={itens}
              aoMudarQuantidade={mudarQuantidade}
              aoRemover={(chave) => setItens((a) => a.filter((x) => x.chave !== chave))}
            />

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
