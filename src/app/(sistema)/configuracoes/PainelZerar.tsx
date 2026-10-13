"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useMensagens } from "@/components/Mensagens";
import { copiaDoMovimento, zerarMovimento } from "./acoes";

export interface Contagem {
  pedidos: number;
  itens: number;
  comandas: number;
  pagamentos: number;
  caixas: number;
  /** Fica: só pra tela poder dizer, com número, o que não vai embora. */
  produtos: number;
  clientes: number;
  mesas: number;
}

/**
 * Zerar o movimento: começar o mês (ou a vida do sistema) do zero.
 *
 * Isto existe pra não ter que digitar `truncate` no painel do banco. Lá,
 * um nome de tabela trocado leva o cardápio inteiro junto e não tem volta;
 * aqui a lista de tabelas está escrita no servidor e não muda.
 *
 * A seção começa fechada, é a única coisa vermelha da tela e pede a
 * palavra digitada. Nada disso é enfeite: botão de apagar tudo que fica
 * do lado de "salvar telefone" é acidente esperando acontecer.
 */
export function PainelZerar({ contagem }: { contagem: Contagem }) {
  const router = useRouter();
  const { pedir, sucesso, falha, painel } = useMensagens();
  const [aberto, setAberto] = useState(false);
  const [palavra, setPalavra] = useState("");
  const [ocupado, iniciar] = useTransition();

  const temMovimento = contagem.pedidos > 0 || contagem.caixas > 0;
  const liberado = palavra.trim().toUpperCase() === "ZERAR";

  function baixarCopia() {
    iniciar(async () => {
      const r = await copiaDoMovimento();
      if (!r.ok) {
        falha(r.erro);
        return;
      }
      /**
       * O arquivo nasce no navegador e vai direto pra pasta de downloads:
       * nada é gravado no servidor, e a cópia fica no computador dele.
       */
      const hoje = new Date().toISOString().slice(0, 10);
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(r.dados, null, 2)], { type: "application/json" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `general-burguer-movimento-${hoje}.json`;
      link.click();
      URL.revokeObjectURL(url);
      sucesso("Cópia baixada. Confira na pasta de downloads antes de apagar.");
    });
  }

  function zerar() {
    pedir(
      {
        titulo: "Apagar todo o movimento?",
        texto: `Vão embora ${contagem.pedidos} pedido(s), ${contagem.comandas} conta(s) de mesa, ${contagem.pagamentos} pagamento(s) e ${contagem.caixas} caixa(s). Não tem como desfazer, e o relatório volta a zero. O cardápio, os clientes e as mesas ficam.`,
        confirmar: "Apagar tudo",
        perigo: true,
      },
      () =>
        iniciar(async () => {
          const r = await zerarMovimento(palavra);
          if (!r.ok) {
            falha(r.erro);
            return;
          }
          setPalavra("");
          setAberto(false);
          sucesso(
            `Movimento zerado — ${r.apagados} pedido(s) apagados. Abra um caixa novo pra voltar a vender.`,
          );
          router.refresh();
        }),
    );
  }

  return (
    <section className="rounded-2xl border border-cancelado/40 bg-cancelado/5 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold uppercase tracking-wide text-cancelado">
            Zerar o movimento
          </h2>
          <p className="mt-1 max-w-xl text-sm text-creme-suave">
            Apaga pedidos, contas de mesa, pagamentos e caixas pra começar do zero.
            Cardápio, clientes, bairros e mesas continuam como estão.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAberto((a) => !a)}
          className="btn btn-quieto shrink-0 px-4 py-1.5 text-sm"
        >
          {aberto ? "Fechar" : "Abrir"}
        </button>
      </div>

      {aberto && (
        <div className="mt-5 border-t border-cancelado/30 pt-5">
          {!temMovimento ? (
            <p className="text-sm text-creme-suave">
              Não há movimento pra apagar — o sistema já está zerado.
            </p>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="rotulo text-cancelado">Vai embora</p>
                  <ul className="space-y-1 text-sm text-creme-suave">
                    <Linha rotulo="Pedidos" valor={contagem.pedidos} />
                    <Linha rotulo="Itens dos pedidos" valor={contagem.itens} />
                    <Linha rotulo="Contas de mesa" valor={contagem.comandas} />
                    <Linha rotulo="Pagamentos" valor={contagem.pagamentos} />
                    <Linha rotulo="Caixas" valor={contagem.caixas} />
                  </ul>
                </div>
                <div>
                  <p className="rotulo text-pronto">Fica</p>
                  <ul className="space-y-1 text-sm text-creme-suave">
                    <Linha rotulo="Produtos do cardápio" valor={contagem.produtos} />
                    <Linha rotulo="Clientes" valor={contagem.clientes} />
                    <Linha rotulo="Mesas e QR codes" valor={contagem.mesas} />
                    <li className="text-creme-fraco">
                      Categorias, adicionais, bairros, acessos e configurações
                    </li>
                  </ul>
                </div>
              </div>

              <p className="mt-5 rounded-lg border border-ouro/40 bg-ouro/10 px-3 py-2.5 text-sm text-ouro">
                O banco não tem backup automático. Baixe a cópia primeiro — depois de
                apagar, não tem de onde voltar.
              </p>

              <button
                type="button"
                onClick={baixarCopia}
                disabled={ocupado}
                className="btn btn-quieto mt-3"
              >
                Baixar cópia do movimento
              </button>

              <div className="mt-6 border-t border-cancelado/30 pt-5">
                <label className="rotulo" htmlFor="palavra-zerar">
                  Pra destravar, digite ZERAR
                </label>
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    id="palavra-zerar"
                    className="campo w-40"
                    value={palavra}
                    onChange={(e) => setPalavra(e.target.value)}
                    placeholder="ZERAR"
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <button
                    type="button"
                    onClick={zerar}
                    disabled={!liberado || ocupado}
                    className="btn btn-perigo"
                  >
                    {ocupado ? "Apagando…" : "Apagar todo o movimento"}
                  </button>
                </div>
                <p className="mt-2 text-xs text-creme-fraco">
                  Mesa com conta aberta ou pedido esperando aprovação barra o apagamento —
                  resolva essas primeiro. Depois de zerar, abra um caixa novo.
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {painel}
    </section>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: number }) {
  return (
    <li className="flex justify-between gap-4">
      <span>{rotulo}</span>
      <span className="tabular font-medium text-creme">{valor}</span>
    </li>
  );
}
