"use client";

import { useState, useTransition } from "react";
import { salvarRestaurante } from "./acoes";
import type { ConfigRestaurante } from "@/lib/tipos";

const CAMPOS: { chave: keyof ConfigRestaurante; rotulo: string; dica?: string }[] = [
  { chave: "nome", rotulo: "Nome no cupom", dica: "Sai no topo do papel, em letra grande." },
  { chave: "slogan", rotulo: "Slogan" },
  { chave: "endereco", rotulo: "Endereço" },
  { chave: "telefone", rotulo: "Telefone" },
  { chave: "whatsapp", rotulo: "WhatsApp (só números, com DDI)", dica: "Ex: 5528998839321" },
  { chave: "instagram", rotulo: "Instagram" },
  { chave: "horario", rotulo: "Horário de funcionamento" },
];

export function PainelRestaurante({ inicial }: { inicial: ConfigRestaurante }) {
  const [dados, setDados] = useState<ConfigRestaurante>(inicial);
  const [aviso, setAviso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, iniciar] = useTransition();

  function salvar() {
    setErro(null);
    setAviso(null);
    iniciar(async () => {
      const r = await salvarRestaurante(dados);
      if (!r.ok) return setErro(r.erro);
      setAviso("Dados salvos. O próximo cupom já sai com eles.");
    });
  }

  return (
    <section className="rounded-2xl border border-borda bg-carvao p-6">
      <h2 className="mb-1 font-display text-xl uppercase tracking-wide text-creme">
        Dados do restaurante
      </h2>
      <p className="mb-5 text-sm text-creme-suave">
        É o que sai impresso no cabeçalho e no rodapé do cupom do cliente.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        {CAMPOS.map((c) => (
          <div key={c.chave}>
            <label className="rotulo" htmlFor={`r-${c.chave}`}>{c.rotulo}</label>
            <input
              id={`r-${c.chave}`}
              className="campo"
              value={dados?.[c.chave] ?? ""}
              onChange={(e) => setDados({ ...dados, [c.chave]: e.target.value })}
            />
            {c.dica && <p className="mt-1 text-xs text-creme-fraco">{c.dica}</p>}
          </div>
        ))}
      </div>

      {aviso && (
        <p className="mt-4 rounded-lg border border-pronto/40 bg-pronto/10 px-3 py-2 text-sm text-pronto">
          {aviso}
        </p>
      )}
      {erro && (
        <p role="alert" className="mt-4 rounded-lg border border-cancelado/40 bg-cancelado/10 px-3 py-2 text-sm text-cancelado">
          {erro}
        </p>
      )}

      <button className="btn btn-ouro mt-5" onClick={salvar} disabled={salvando}>
        {salvando ? "Salvando…" : "Salvar dados"}
      </button>
    </section>
  );
}
