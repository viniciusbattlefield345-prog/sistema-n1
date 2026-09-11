"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Cabecalho, Vazio } from "@/components/Cabecalho";
import { alternarMesa, criarMesa, excluirMesa, trocarCodigo } from "./acoes";
import type { Mesa } from "@/lib/tipos";

export function CadastroMesas({ mesas, endereco }: { mesas: Mesa[]; endereco: string }) {
  const proxima = (mesas.reduce((m, x) => Math.max(m, x.numero), 0) || 0) + 1;
  const [numero, setNumero] = useState(String(proxima));
  const [erro, setErro] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<number | null>(null);
  const [ocupado, iniciar] = useTransition();

  function acao(fn: () => Promise<{ ok: boolean; erro?: string }>, depois?: () => void) {
    setErro(null);
    iniciar(async () => {
      const r = await fn();
      if (!r.ok) setErro(r.erro ?? "Não deu certo.");
      else depois?.();
    });
  }

  async function copiar(m: Mesa) {
    try {
      await navigator.clipboard.writeText(`${endereco}/m/${m.codigo}`);
      setCopiado(m.id);
      setTimeout(() => setCopiado(null), 2000);
    } catch {
      setErro("Não consegui copiar. Segure o link e copie à mão.");
    }
  }

  return (
    <div className="p-4 lg:p-8">
      <Cabecalho
        fita="Gerência"
        titulo="Mesas e QR codes"
        descricao="Cada mesa tem um link próprio. O QR impresso leva o cliente direto pro cardápio daquela mesa."
      >
        <Link href="/mesas/qr" className="btn btn-ouro">
          Imprimir QR codes
        </Link>
      </Cabecalho>

      <p className="mb-5 max-w-2xl rounded-xl border border-borda bg-carvao px-4 py-3 text-sm text-creme-suave">
        Os QR codes usam o endereço <strong className="text-creme">{endereco}</strong>. Se o site
        mudar de endereço, imprima de novo — QR impresso com endereço antigo para de funcionar.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          acao(() => criarMesa(Number(numero)), () => setNumero(String(Number(numero) + 1)));
        }}
        className="mb-5 flex flex-wrap items-end gap-3 rounded-2xl border border-borda bg-carvao p-4"
      >
        <div className="w-36">
          <label className="rotulo" htmlFor="nova-mesa">
            Número da mesa
          </label>
          <input
            id="nova-mesa"
            className="campo"
            inputMode="numeric"
            value={numero}
            onChange={(e) => setNumero(e.target.value.replace(/\D/g, ""))}
          />
        </div>
        <button type="submit" className="btn btn-ouro" disabled={ocupado || !numero}>
          Adicionar mesa
        </button>
      </form>

      {erro && (
        <p
          role="alert"
          className="mb-4 rounded-lg border border-cancelado/40 bg-cancelado/10 px-3 py-2 text-sm text-cancelado"
        >
          {erro}
        </p>
      )}

      {mesas.length === 0 ? (
        <Vazio titulo="Nenhuma mesa" texto="Adicione a primeira mesa acima." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-borda">
          <table className="w-full min-w-[40rem] text-sm">
            <thead className="bg-carvao text-left text-xs uppercase tracking-wide text-creme-suave">
              <tr>
                <th className="px-4 py-3 font-semibold">Mesa</th>
                <th className="px-4 py-3 font-semibold">Link do cardápio</th>
                <th className="px-4 py-3 font-semibold">Situação</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {mesas.map((m) => (
                <tr key={m.id} className={"border-t border-borda/60 " + (m.ativo ? "" : "opacity-50")}>
                  <td className="px-4 py-3 font-display text-xl font-extrabold">{m.numero}</td>
                  <td className="px-4 py-3">
                    <a
                      href={`/m/${m.codigo}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-xs text-creme-suave underline hover:text-ouro"
                    >
                      /m/{m.codigo}
                    </a>
                    <button
                      type="button"
                      onClick={() => copiar(m)}
                      className="ml-3 text-xs text-ouro underline"
                    >
                      {copiado === m.id ? "Copiado!" : "Copiar"}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => acao(() => alternarMesa(m.id, !m.ativo))}
                      className={
                        "rounded-full px-2.5 py-1 text-xs font-semibold " +
                        (m.ativo ? "bg-pronto/15 text-pronto" : "bg-madeira text-creme-fraco")
                      }
                    >
                      {m.ativo ? "Ativa" : "Desativada"}
                    </button>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <button
                      type="button"
                      className="text-xs text-creme-suave underline hover:text-ouro"
                      onClick={() => {
                        if (
                          !confirm(
                            `Trocar o código da mesa ${m.numero}? O QR impresso dela para de funcionar e você vai precisar imprimir de novo.`,
                          )
                        )
                          return;
                        acao(() => trocarCodigo(m.id));
                      }}
                    >
                      Trocar código
                    </button>
                    <button
                      type="button"
                      className="ml-4 text-xs text-creme-fraco underline hover:text-cancelado"
                      onClick={() => {
                        if (!confirm(`Excluir a mesa ${m.numero}?`)) return;
                        acao(() => excluirMesa(m.id));
                      }}
                    >
                      Excluir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
