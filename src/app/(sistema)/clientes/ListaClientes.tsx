"use client";

import { useMemo, useState, useTransition } from "react";
import { Cabecalho, Vazio } from "@/components/Cabecalho";
import { FormularioCliente } from "./FormularioCliente";
import { excluirCliente } from "./acoes";
import { telefone as formatarTelefone } from "@/lib/formato";
import type { Bairro, Cliente } from "@/lib/tipos";

export function ListaClientes({
  clientes,
  bairros,
}: {
  clientes: Cliente[];
  bairros: Bairro[];
}) {
  const [busca, setBusca] = useState("");
  const [editando, setEditando] = useState<Cliente | null | undefined>(undefined);
  const [erro, setErro] = useState<string | null>(null);
  const [, iniciar] = useTransition();

  const bairroPorId = useMemo(
    () => new Map(bairros.map((b) => [b.id, b])),
    [bairros],
  );

  const filtrados = useMemo(() => {
    const t = busca.trim().toLowerCase();
    if (!t) return clientes;
    const d = t.replace(/\D/g, "");
    return clientes.filter(
      (c) =>
        c.nome.toLowerCase().includes(t) ||
        (c.endereco ?? "").toLowerCase().includes(t) ||
        (d.length >= 3 && (c.telefone ?? "").includes(d)),
    );
  }, [clientes, busca]);

  function remover(c: Cliente) {
    if (!confirm(`Excluir ${c.nome}?`)) return;
    setErro(null);
    iniciar(async () => {
      const r = await excluirCliente(c.id);
      if (!r.ok) setErro(r.erro);
    });
  }

  return (
    <div className="p-8">
      <Cabecalho
        fita="Entrega"
        titulo="Clientes"
        descricao="Quem já pediu fica salvo aqui com endereço e bairro — no próximo pedido é só buscar pelo telefone."
      >
        <button className="btn btn-ouro" onClick={() => setEditando(null)}>
          Novo cliente
        </button>
      </Cabecalho>

      {clientes.length > 0 && (
        <input
          className="campo mb-4 max-w-sm"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome, telefone ou rua…"
          aria-label="Buscar cliente"
        />
      )}

      {erro && (
        <p
          role="alert"
          className="mb-4 rounded-lg border border-cancelado/40 bg-cancelado/10 px-3 py-2 text-sm text-cancelado"
        >
          {erro}
        </p>
      )}

      {clientes.length === 0 ? (
        <Vazio
          titulo="Nenhum cliente ainda"
          texto="Cadastre o primeiro para conseguir lançar pedidos de entrega."
        >
          <button className="btn btn-ouro" onClick={() => setEditando(null)}>
            Cadastrar cliente
          </button>
        </Vazio>
      ) : filtrados.length === 0 ? (
        <Vazio titulo="Nada encontrado" texto="Nenhum cliente com esse nome, telefone ou rua." />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-borda">
          <table className="w-full text-sm">
            <thead className="bg-carvao text-left text-xs uppercase tracking-wide text-creme-suave">
              <tr>
                <th className="px-4 py-3 font-semibold">Nome</th>
                <th className="px-4 py-3 font-semibold">Telefone</th>
                <th className="px-4 py-3 font-semibold">Endereço</th>
                <th className="px-4 py-3 font-semibold">Bairro</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtrados.map((c) => {
                const bairro = c.bairro_id ? bairroPorId.get(c.bairro_id) : null;
                return (
                  <tr key={c.id} className="border-t border-borda/60">
                    <td className="px-4 py-3">
                      <span className="font-medium text-creme">{c.nome}</span>
                      {c.referencia && (
                        <span className="block text-xs text-creme-fraco">
                          {c.referencia}
                        </span>
                      )}
                    </td>
                    <td className="tabular px-4 py-3 text-creme-suave">
                      {formatarTelefone(c.telefone) || "—"}
                    </td>
                    <td className="px-4 py-3 text-creme-suave">
                      {[c.endereco, c.numero].filter(Boolean).join(", ") || "—"}
                    </td>
                    <td className="px-4 py-3 text-creme-suave">
                      {bairro ? bairro.nome : "—"}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        className="text-xs text-creme-suave underline hover:text-ouro"
                        onClick={() => setEditando(c)}
                      >
                        Editar
                      </button>
                      <button
                        className="ml-4 text-xs text-creme-fraco underline hover:text-cancelado"
                        onClick={() => remover(c)}
                      >
                        Excluir
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {editando !== undefined && (
        <FormularioCliente
          cliente={editando}
          bairros={bairros}
          aoFechar={() => setEditando(undefined)}
        />
      )}
    </div>
  );
}
