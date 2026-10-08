"use client";

import { useState, useTransition } from "react";
import { Marca } from "@/components/Marca";
import { buscarCliente } from "./acoes";
import {
  dadosServem,
  soDigitos,
  type BairroAtendido,
  type DadosCliente,
  NOME_MINIMO,
  TELEFONE_MINIMO,
} from "./dados";
import { reais, telefone as formatarTelefone } from "@/lib/formato";

type Passo = "tipo" | "telefone" | "dados";

/**
 * A porta do delivery: três perguntas antes do cardápio.
 *
 * 1. Receber em casa ou buscar na loja?
 * 2. Qual o seu telefone?
 * 3. Se o telefone já é conhecido, só confirma. Se não, preenche uma vez.
 *
 * Quem já pediu antes passa por aqui em dois toques — é esse o ponto. O
 * cardápio fica visível atrás, pra pessoa ver que chegou no lugar certo.
 */
export function PortaEntrega({
  bairros,
  inicial,
  aoEntrar,
}: {
  bairros: BairroAtendido[];
  inicial: DadosCliente;
  aoEntrar: (d: DadosCliente) => void;
}) {
  const [passo, setPasso] = useState<Passo>("tipo");
  const [dados, setDados] = useState<DadosCliente>(inicial);
  const [conhecido, setConhecido] = useState(false);
  const [editando, setEditando] = useState(false);
  const [procurando, iniciar] = useTransition();

  const ehEntrega = dados.tipo === "ENTREGA";
  const campo = <C extends keyof DadosCliente>(chave: C, valor: DadosCliente[C]) =>
    setDados((d) => ({ ...d, [chave]: valor }));

  function escolherTipo(tipo: DadosCliente["tipo"]) {
    setDados((d) => ({ ...d, tipo }));
    setPasso("telefone");
  }

  function procurarTelefone() {
    const tel = soDigitos(dados.telefone);
    if (tel.length < TELEFONE_MINIMO) return;
    iniciar(async () => {
      try {
        const achado = await buscarCliente(tel);
        if (achado) {
          setDados((d) => ({ ...d, ...achado, telefone: tel }));
          setConhecido(true);
          setEditando(false);
        } else {
          setConhecido(false);
          setEditando(true);
        }
      } catch {
        // sem sinal pra consultar: a pessoa preenche na mão e segue
        setConhecido(false);
        setEditando(true);
      }
      setPasso("dados");
    });
  }

  const bairro = bairros.find((b) => b.id === dados.bairro_id) ?? null;
  const pronto = dadosServem(dados);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="porta-entrega-titulo"
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-breu/95 px-5 py-8 backdrop-blur-sm"
    >
      <div className="anim-entrar w-full max-w-sm">
        <Marca tamanho={1.5} alinhamento="centro" />

        {passo === "tipo" && (
          <>
            <h1
              id="porta-entrega-titulo"
              className="mt-7 text-center font-display text-3xl font-extrabold uppercase leading-tight"
            >
              Como você quer receber?
            </h1>
            <p className="mt-2 text-center text-sm text-creme-suave">
              Monte seu pedido aqui mesmo e acompanhe pelo celular.
            </p>

            <button
              type="button"
              onClick={() => escolherTipo("ENTREGA")}
              className="btn btn-ouro mt-7 w-full py-4 text-base"
            >
              Receber em casa
            </button>
            <button
              type="button"
              onClick={() => escolherTipo("RETIRADA")}
              className="btn btn-quieto mt-3 w-full py-4 text-base"
            >
              Buscar na loja
            </button>
          </>
        )}

        {passo === "telefone" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              procurarTelefone();
            }}
          >
            <h1
              id="porta-entrega-titulo"
              className="mt-7 text-center font-display text-3xl font-extrabold uppercase leading-tight"
            >
              Qual é o seu telefone?
            </h1>
            <p className="mt-2 text-center text-sm text-creme-suave">
              É por ele que a gente te acha — e se você já pediu antes, seus dados
              voltam preenchidos.
            </p>

            <input
              autoFocus
              className="campo mt-6 text-center text-lg"
              inputMode="numeric"
              autoComplete="tel"
              enterKeyHint="go"
              maxLength={11}
              value={dados.telefone}
              onChange={(e) => campo("telefone", soDigitos(e.target.value))}
              placeholder="28999999999"
              aria-label="Seu telefone com DDD"
            />

            <button
              type="submit"
              disabled={procurando || soDigitos(dados.telefone).length < TELEFONE_MINIMO}
              className="btn btn-ouro mt-4 w-full py-3.5 text-base"
            >
              {procurando ? "Procurando…" : "Continuar"}
            </button>
            <button
              type="button"
              onClick={() => setPasso("tipo")}
              className="mt-3 w-full text-center text-sm text-creme-suave underline underline-offset-2"
            >
              Voltar
            </button>
          </form>
        )}

        {passo === "dados" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (pronto) aoEntrar({ ...dados, telefone: soDigitos(dados.telefone) });
            }}
          >
            {conhecido && !editando ? (
              <>
                <h1
                  id="porta-entrega-titulo"
                  className="mt-7 text-center font-display text-3xl font-extrabold uppercase leading-tight"
                >
                  Oi, {dados.nome.split(" ")[0]}!
                </h1>
                <p className="mt-2 text-center text-sm text-creme-suave">
                  {ehEntrega ? "Confirma onde é a entrega?" : "Confirma seus dados?"}
                </p>

                <div className="mt-6 rounded-2xl border border-borda bg-carvao p-4 text-sm">
                  <p className="font-semibold">{dados.nome}</p>
                  <p className="text-creme-suave">{formatarTelefone(dados.telefone)}</p>
                  {ehEntrega && (
                    <p className="mt-2 leading-snug text-creme-suave">
                      {dados.endereco}
                      {dados.numero && `, ${dados.numero}`}
                      {bairro && ` — ${bairro.nome}`}
                      {dados.referencia && (
                        <span className="block text-creme-fraco">{dados.referencia}</span>
                      )}
                    </p>
                  )}
                  {ehEntrega && bairro && (
                    <p className="mt-2 text-xs text-ouro">
                      Taxa de entrega {reais(Number(bairro.taxa))}
                    </p>
                  )}
                </div>

                {ehEntrega && !bairro && (
                  <p className="mt-3 text-center text-xs text-cancelado">
                    O bairro do seu cadastro não está sendo atendido agora. Toque em
                    “Mudar meus dados” pra escolher outro.
                  </p>
                )}

                <button
                  type="submit"
                  disabled={!pronto}
                  className="btn btn-ouro mt-5 w-full py-3.5 text-base"
                >
                  É isso, ver o cardápio
                </button>
                <button
                  type="button"
                  onClick={() => setEditando(true)}
                  className="mt-3 w-full text-center text-sm text-creme-suave underline underline-offset-2"
                >
                  Mudar meus dados
                </button>
              </>
            ) : (
              <>
                <h1
                  id="porta-entrega-titulo"
                  className="mt-7 text-center font-display text-2xl font-extrabold uppercase leading-tight"
                >
                  {ehEntrega ? "Onde você está?" : "Como te chamamos?"}
                </h1>

                <div className="mt-5 space-y-3 text-left">
                  <div>
                    <label className="rotulo" htmlFor="entrega-nome">
                      Nome completo
                    </label>
                    <input
                      id="entrega-nome"
                      autoFocus
                      className="campo"
                      maxLength={80}
                      autoComplete="name"
                      value={dados.nome}
                      onChange={(e) => campo("nome", e.target.value)}
                      placeholder="Ex.: Maria Oliveira"
                    />
                  </div>

                  {ehEntrega && (
                    <>
                      <div className="flex gap-3">
                        <div className="flex-1">
                          <label className="rotulo" htmlFor="entrega-rua">
                            Rua
                          </label>
                          <input
                            id="entrega-rua"
                            className="campo"
                            maxLength={120}
                            autoComplete="address-line1"
                            value={dados.endereco}
                            onChange={(e) => campo("endereco", e.target.value)}
                            placeholder="Rua das Flores"
                          />
                        </div>
                        <div className="w-24">
                          <label className="rotulo" htmlFor="entrega-numero">
                            Número
                          </label>
                          <input
                            id="entrega-numero"
                            className="campo"
                            maxLength={20}
                            inputMode="numeric"
                            value={dados.numero}
                            onChange={(e) => campo("numero", e.target.value)}
                            placeholder="123"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="rotulo" htmlFor="entrega-bairro">
                          Bairro
                        </label>
                        {bairros.length === 0 ? (
                          <p className="rounded-xl border border-cancelado/40 bg-cancelado/10 px-3 py-2.5 text-sm text-cancelado">
                            Nenhum bairro liberado pra entrega ainda. Volte e escolha
                            “Buscar na loja”, ou fale com a gente.
                          </p>
                        ) : (
                          <select
                            id="entrega-bairro"
                            className="campo"
                            value={dados.bairro_id ?? ""}
                            onChange={(e) =>
                              campo("bairro_id", e.target.value ? Number(e.target.value) : null)
                            }
                          >
                            <option value="">Escolha o seu bairro…</option>
                            {bairros.map((b) => (
                              <option key={b.id} value={b.id}>
                                {b.nome}
                                {Number(b.taxa) > 0 ? ` — entrega ${reais(Number(b.taxa))}` : " — entrega grátis"}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>

                      <div>
                        <label className="rotulo" htmlFor="entrega-referencia">
                          Ponto de referência (opcional)
                        </label>
                        <input
                          id="entrega-referencia"
                          className="campo"
                          maxLength={120}
                          value={dados.referencia}
                          onChange={(e) => campo("referencia", e.target.value)}
                          placeholder="Ex.: portão verde, ao lado da padaria"
                        />
                      </div>
                    </>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={!pronto}
                  className="btn btn-ouro mt-5 w-full py-3.5 text-base"
                >
                  Ver o cardápio
                </button>
                {!pronto && dados.nome.trim().length > 0 && (
                  <p className="mt-2 text-center text-xs text-creme-fraco">
                    {dados.nome.trim().length < NOME_MINIMO
                      ? `Escreva pelo menos ${NOME_MINIMO} letras no nome.`
                      : "Falta a rua e o bairro."}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => (conhecido ? setEditando(false) : setPasso("telefone"))}
                  className="mt-3 w-full text-center text-sm text-creme-suave underline underline-offset-2"
                >
                  Voltar
                </button>
              </>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
