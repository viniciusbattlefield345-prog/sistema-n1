"use client";

import { useState, useTransition } from "react";
import { Cabecalho, Vazio } from "./Cabecalho";
import { salvarCadastro, excluirCadastro, type Tabela } from "@/app/(sistema)/cadastros";
import { paraNumero, numero } from "@/lib/formato";

export type TipoCampo = "texto" | "dinheiro" | "inteiro" | "lista";

export interface Campo {
  chave: string;
  rotulo: string;
  tipo: TipoCampo;
  largura?: string;
  placeholder?: string;
  opcoes?: string[];
}

export interface Linha {
  id: number;
  ativo: boolean;
  [chave: string]: unknown;
}

/**
 * Tabela de cadastro com edição na própria linha.
 * Serve categorias, adicionais e bairros — muda só a lista de campos.
 *
 * Excluir é o último recurso: o normal é desativar, que preserva o
 * histórico dos pedidos que já usaram aquele item.
 */
export function Cadastro({
  tabela,
  fita,
  titulo,
  descricao,
  campos,
  linhas,
  textoVazio,
}: {
  tabela: Tabela;
  fita: string;
  titulo: string;
  descricao: string;
  campos: Campo[];
  linhas: Linha[];
  textoVazio: string;
}) {
  const [rascunho, setRascunho] = useState<Record<string, string> | null>(null);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();

  const vazio = () =>
    Object.fromEntries(campos.map((c) => [c.chave, ""])) as Record<string, string>;

  function paraBanco(r: Record<string, string>) {
    const saida: Record<string, unknown> = {};
    for (const c of campos) {
      const v = r[c.chave] ?? "";
      saida[c.chave] =
        c.tipo === "dinheiro"
          ? paraNumero(v)
          : c.tipo === "inteiro"
            ? Math.trunc(paraNumero(v))
            : v.trim() || null;
    }
    return saida;
  }

  function salvar(id?: number) {
    if (!rascunho) return;
    setErro(null);
    iniciar(async () => {
      const r = await salvarCadastro(tabela, paraBanco(rascunho), id);
      if (!r.ok) return setErro(r.erro);
      setRascunho(null);
      setEditandoId(null);
    });
  }

  function alternarAtivo(linha: Linha) {
    setErro(null);
    iniciar(async () => {
      const r = await salvarCadastro(tabela, { ativo: !linha.ativo }, linha.id);
      if (!r.ok) setErro(r.erro);
    });
  }

  function excluir(linha: Linha) {
    if (!confirm(`Excluir "${linha.nome}"?`)) return;
    setErro(null);
    iniciar(async () => {
      const r = await excluirCadastro(tabela, linha.id);
      if (!r.ok) setErro(r.erro);
    });
  }

  const mostrar = (linha: Linha, c: Campo) => {
    const v = linha[c.chave];
    if (v === null || v === undefined || v === "") return "—";
    if (c.tipo === "dinheiro") return "R$ " + numero(Number(v));
    return String(v);
  };

  return (
    <div className="p-4 lg:p-8">
      <Cabecalho fita={fita} titulo={titulo} descricao={descricao}>
        <button
          className="btn btn-ouro"
          onClick={() => {
            setEditandoId(null);
            setRascunho(vazio());
          }}
        >
          Adicionar
        </button>
      </Cabecalho>

      {erro && (
        <p
          role="alert"
          className="mb-4 rounded-lg border border-cancelado/40 bg-cancelado/10 px-3 py-2 text-sm text-cancelado"
        >
          {erro}
        </p>
      )}

      {/* linha nova */}
      {rascunho && editandoId === null && (
        <EditorLinha
          campos={campos}
          rascunho={rascunho}
          setRascunho={setRascunho}
          ocupado={ocupado}
          aoSalvar={() => salvar()}
          aoCancelar={() => setRascunho(null)}
        />
      )}

      {linhas.length === 0 && !rascunho ? (
        <Vazio titulo="Nada cadastrado ainda" texto={textoVazio}>
          <button className="btn btn-ouro" onClick={() => setRascunho(vazio())}>
            Adicionar o primeiro
          </button>
        </Vazio>
      ) : (
        linhas.length > 0 && (
          <div className="overflow-x-auto rounded-2xl border border-borda">
            <table className="w-full min-w-[42rem] text-sm">
              <thead className="bg-carvao text-left text-xs uppercase tracking-wide text-creme-suave">
                <tr>
                  {campos.map((c) => (
                    <th key={c.chave} className="px-4 py-3 font-semibold">
                      {c.rotulo}
                    </th>
                  ))}
                  <th className="px-4 py-3 font-semibold">Situação</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {linhas.map((linha) =>
                  editandoId === linha.id && rascunho ? (
                    <tr key={linha.id} className="border-t border-borda/60">
                      <td colSpan={campos.length + 2} className="p-3">
                        <EditorLinha
                          embutido
                          campos={campos}
                          rascunho={rascunho}
                          setRascunho={setRascunho}
                          ocupado={ocupado}
                          aoSalvar={() => salvar(linha.id)}
                          aoCancelar={() => {
                            setRascunho(null);
                            setEditandoId(null);
                          }}
                        />
                      </td>
                    </tr>
                  ) : (
                    <tr
                      key={linha.id}
                      className={
                        "border-t border-borda/60 " + (linha.ativo ? "" : "opacity-45")
                      }
                    >
                      {campos.map((c) => (
                        <td
                          key={c.chave}
                          className={
                            "px-4 py-3 " +
                            (c.tipo === "dinheiro" ? "tabular text-creme" : "text-creme-suave")
                          }
                        >
                          {mostrar(linha, c)}
                        </td>
                      ))}
                      <td className="px-4 py-3">
                        <button
                          onClick={() => alternarAtivo(linha)}
                          className={
                            "rounded-full px-2.5 py-1 text-xs font-semibold " +
                            (linha.ativo
                              ? "bg-pronto/15 text-pronto"
                              : "bg-madeira text-creme-fraco")
                          }
                        >
                          {linha.ativo ? "Ativo" : "Desativado"}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button
                          className="text-xs text-creme-suave underline hover:text-ouro"
                          onClick={() => {
                            setEditandoId(linha.id);
                            setRascunho(
                              Object.fromEntries(
                                campos.map((c) => [
                                  c.chave,
                                  linha[c.chave] === null || linha[c.chave] === undefined
                                    ? ""
                                    : String(linha[c.chave]),
                                ]),
                              ),
                            );
                          }}
                        >
                          Editar
                        </button>
                        <button
                          className="ml-4 text-xs text-creme-fraco underline hover:text-cancelado"
                          onClick={() => excluir(linha)}
                        >
                          Excluir
                        </button>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  );
}

function EditorLinha({
  campos,
  rascunho,
  setRascunho,
  ocupado,
  aoSalvar,
  aoCancelar,
  embutido,
}: {
  campos: Campo[];
  rascunho: Record<string, string>;
  setRascunho: (r: Record<string, string>) => void;
  ocupado: boolean;
  aoSalvar: () => void;
  aoCancelar: () => void;
  embutido?: boolean;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        aoSalvar();
      }}
      className={
        "flex flex-wrap items-end gap-3 " +
        (embutido ? "" : "mb-4 rounded-2xl border border-ouro/40 bg-carvao p-4")
      }
    >
      {campos.map((c, i) => (
        <div key={c.chave} style={{ width: c.largura ?? "12rem" }}>
          <label className="rotulo" htmlFor={`c-${c.chave}`}>
            {c.rotulo}
          </label>
          {c.tipo === "lista" ? (
            <input
              id={`c-${c.chave}`}
              list={`op-${c.chave}`}
              className="campo"
              autoFocus={i === 0}
              value={rascunho[c.chave] ?? ""}
              onChange={(e) =>
                setRascunho({ ...rascunho, [c.chave]: e.target.value })
              }
              placeholder={c.placeholder}
            />
          ) : (
            <input
              id={`c-${c.chave}`}
              className="campo"
              autoFocus={i === 0}
              inputMode={c.tipo === "texto" ? undefined : "decimal"}
              value={rascunho[c.chave] ?? ""}
              onChange={(e) =>
                setRascunho({ ...rascunho, [c.chave]: e.target.value })
              }
              placeholder={c.placeholder}
            />
          )}
          {c.opcoes && (
            <datalist id={`op-${c.chave}`}>
              {c.opcoes.map((o) => (
                <option key={o} value={o} />
              ))}
            </datalist>
          )}
        </div>
      ))}

      <button type="submit" className="btn btn-ouro" disabled={ocupado}>
        {ocupado ? "Salvando…" : "Salvar"}
      </button>
      <button type="button" className="btn btn-quieto" onClick={aoCancelar}>
        Cancelar
      </button>
    </form>
  );
}
