"use client";

import { useEffect, useState, useTransition } from "react";
import { salvarCliente, type DadosCliente } from "./acoes";
import type { Bairro, Cliente } from "@/lib/tipos";

const VAZIO: DadosCliente = {
  nome: "",
  telefone: "",
  endereco: "",
  numero: "",
  bairro_id: null,
  referencia: "",
  observacao: "",
};

/** Formulário de cliente. Serve tanto na tela de Clientes quanto dentro
 *  do PDV — a atendente está no telefone e não pode sair da venda. */
export function FormularioCliente({
  cliente,
  bairros,
  aoFechar,
  aoSalvar,
  nomeInicial,
}: {
  cliente?: Cliente | null;
  bairros: Bairro[];
  aoFechar: () => void;
  aoSalvar?: (id: number) => void;
  /** Vem do PDV: o nome que a atendente ja tinha digitado na busca. */
  nomeInicial?: string;
}) {
  const [dados, setDados] = useState<DadosCliente>(
    cliente
      ? {
          id: cliente.id,
          nome: cliente.nome,
          telefone: cliente.telefone ?? "",
          endereco: cliente.endereco ?? "",
          numero: cliente.numero ?? "",
          bairro_id: cliente.bairro_id,
          referencia: cliente.referencia ?? "",
          observacao: cliente.observacao ?? "",
        }
      : { ...VAZIO, nome: nomeInicial ?? "" },
  );
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, iniciar] = useTransition();

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && aoFechar();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [aoFechar]);

  const campo = <K extends keyof DadosCliente>(chave: K, valor: DadosCliente[K]) =>
    setDados((d) => ({ ...d, [chave]: valor }));

  function enviar() {
    setErro(null);
    iniciar(async () => {
      const r = await salvarCliente(dados);
      if (!r.ok) return setErro(r.erro);
      aoSalvar?.(r.id);
      aoFechar();
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"
      onClick={aoFechar}
      role="presentation"
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-label={cliente ? "Editar cliente" : "Novo cliente"}
        className="flex max-h-[88vh] w-full max-w-lg flex-col rounded-2xl border border-borda bg-carvao"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          enviar();
        }}
      >
        <header className="border-b border-borda px-6 py-4">
          <h2 className="font-display text-xl uppercase tracking-wide text-creme">
            {cliente ? "Editar cliente" : "Novo cliente"}
          </h2>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-[1fr_auto] gap-3">
            <div>
              <label className="rotulo" htmlFor="cli-nome">
                Nome
              </label>
              <input
                id="cli-nome"
                className="campo"
                autoFocus
                required
                value={dados.nome}
                onChange={(e) => campo("nome", e.target.value)}
                placeholder="Maria da Silva"
              />
            </div>
            <div className="w-44">
              <label className="rotulo" htmlFor="cli-tel">
                Telefone
              </label>
              <input
                id="cli-tel"
                className="campo"
                inputMode="tel"
                value={dados.telefone}
                onChange={(e) => campo("telefone", e.target.value)}
                placeholder="28 99999-0000"
              />
            </div>
          </div>

          <div className="grid grid-cols-[1fr_7rem] gap-3">
            <div>
              <label className="rotulo" htmlFor="cli-end">
                Rua
              </label>
              <input
                id="cli-end"
                className="campo"
                value={dados.endereco}
                onChange={(e) => campo("endereco", e.target.value)}
                placeholder="Rua Florcinda Leal"
              />
            </div>
            <div>
              <label className="rotulo" htmlFor="cli-num">
                Número
              </label>
              <input
                id="cli-num"
                className="campo"
                value={dados.numero}
                onChange={(e) => campo("numero", e.target.value)}
                placeholder="120"
              />
            </div>
          </div>

          <div>
            <label className="rotulo" htmlFor="cli-bairro">
              Bairro
            </label>
            <select
              id="cli-bairro"
              className="campo"
              value={dados.bairro_id ?? ""}
              onChange={(e) =>
                campo("bairro_id", e.target.value ? Number(e.target.value) : null)
              }
            >
              <option value="">Sem bairro</option>
              {bairros.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nome}
                  {Number(b.taxa) > 0 &&
                    ` — taxa R$ ${Number(b.taxa).toFixed(2).replace(".", ",")}`}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-creme-fraco">
              A taxa do bairro entra sozinha no pedido de entrega.
            </p>
          </div>

          <div>
            <label className="rotulo" htmlFor="cli-ref">
              Ponto de referência
            </label>
            <input
              id="cli-ref"
              className="campo"
              value={dados.referencia}
              onChange={(e) => campo("referencia", e.target.value)}
              placeholder="Casa azul, em frente à padaria"
            />
          </div>

          <div>
            <label className="rotulo" htmlFor="cli-obs">
              Observação
            </label>
            <input
              id="cli-obs"
              className="campo"
              value={dados.observacao}
              onChange={(e) => campo("observacao", e.target.value)}
              placeholder="Não tem interfone, ligar ao chegar"
            />
          </div>

          {erro && (
            <p
              role="alert"
              className="rounded-lg border border-cancelado/40 bg-cancelado/10 px-3 py-2 text-sm text-cancelado"
            >
              {erro}
            </p>
          )}
        </div>

        <footer className="flex gap-3 border-t border-borda px-6 py-4">
          <button type="button" className="btn btn-quieto" onClick={aoFechar}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-ouro flex-1" disabled={salvando}>
            {salvando ? "Salvando…" : "Salvar cliente"}
          </button>
        </footer>
      </form>
    </div>
  );
}
