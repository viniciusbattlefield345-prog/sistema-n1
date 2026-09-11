"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, useTransition } from "react";
import { conectar, imprimirCru, listarImpressoras } from "@/lib/impressora";
import { cupomDeTeste } from "@/lib/cupom";
import { salvarImpressoras } from "./acoes";
import type { ConfigImpressoras, ConfigRestaurante } from "@/lib/tipos";

type EstadoQz = "procurando" | "ligado" | "desligado";

export function PainelImpressoras({
  inicial,
  restaurante,
}: {
  inicial: ConfigImpressoras;
  restaurante: ConfigRestaurante;
}) {
  const [qz, setQz] = useState<EstadoQz>("procurando");
  const [impressoras, setImpressoras] = useState<string[]>([]);
  const [cfg, setCfg] = useState<ConfigImpressoras>(inicial);
  const [aviso, setAviso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, iniciar] = useTransition();

  const procurar = useCallback(async () => {
    setQz("procurando");
    setErro(null);
    try {
      await conectar();
      setImpressoras(await listarImpressoras());
      setQz("ligado");
    } catch {
      setQz("desligado");
    }
  }, []);

  useEffect(() => {
    void procurar();
  }, [procurar]);

  function salvar() {
    setErro(null);
    setAviso(null);
    iniciar(async () => {
      const r = await salvarImpressoras(cfg);
      if (!r.ok) return setErro(r.erro);
      setAviso("Impressora salva.");
    });
  }

  async function testar() {
    setErro(null);
    setAviso(null);
    try {
      await imprimirCru(cfg.impressora, cupomDeTeste(restaurante, cfg), 1);
      setAviso(`Enviado para "${cfg.impressora}". Saiu papel?`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não consegui imprimir.");
    }
  }

  const campo = <K extends keyof ConfigImpressoras>(k: K, v: ConfigImpressoras[K]) =>
    setCfg((c) => ({ ...c, [k]: v }));

  return (
    <section className="rounded-2xl border border-borda bg-carvao p-6">
      <h2 className="mb-1 font-display text-xl font-bold uppercase tracking-wide text-creme">
        Impressora
      </h2>
      <p className="mb-5 text-sm text-creme-suave">
        Uma impressora só, no computador do balcão, recebe todos os cupons. A impressão automática
        acontece na tela <Link href="/impressao" className="text-ouro underline">Impressão</Link>,
        que fica aberta nesse computador.
      </p>

      <div
        className={
          "mb-5 rounded-xl border px-4 py-3 text-sm " +
          (qz === "ligado"
            ? "border-pronto/40 bg-pronto/10 text-pronto"
            : qz === "desligado"
              ? "border-preparo/40 bg-preparo/10 text-preparo"
              : "border-borda bg-breu text-creme-suave")
        }
      >
        {qz === "procurando" && "Procurando o QZ Tray neste computador…"}
        {qz === "ligado" && <>QZ Tray conectado — {impressoras.length} impressora(s) encontrada(s).</>}
        {qz === "desligado" && (
          <>
            <strong className="block">QZ Tray não está aberto neste computador.</strong>
            Sem ele o navegador não enxerga a impressora. Baixe em{" "}
            <a href="https://qz.io/download/" target="_blank" rel="noreferrer" className="underline">
              qz.io/download
            </a>
            , instale e deixe aberto na bandeja do Windows.
          </>
        )}
        <button type="button" onClick={procurar} className="ml-2 underline underline-offset-2">
          procurar de novo
        </button>
      </div>

      <div className="max-w-md">
        <label className="rotulo" htmlFor="impressora">
          Nome da impressora
        </label>
        {impressoras.length > 0 ? (
          <select
            id="impressora"
            className="campo"
            value={cfg.impressora}
            onChange={(e) => campo("impressora", e.target.value)}
          >
            <option value="">Escolha…</option>
            {cfg.impressora && !impressoras.includes(cfg.impressora) && (
              <option value={cfg.impressora}>{cfg.impressora} (não encontrada agora)</option>
            )}
            {impressoras.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </select>
        ) : (
          <input
            id="impressora"
            className="campo"
            value={cfg.impressora}
            onChange={(e) => campo("impressora", e.target.value)}
            placeholder="Nome exato, como aparece no Windows"
          />
        )}
        <button
          type="button"
          className="btn btn-quieto mt-2 w-full py-2 text-xs"
          onClick={testar}
          disabled={qz !== "ligado" || !cfg.impressora}
        >
          Imprimir um teste
        </button>
      </div>

      <div className="mt-5 grid max-w-md gap-4 sm:grid-cols-2">
        <div>
          <label className="rotulo" htmlFor="colunas">
            Largura do papel
          </label>
          <select
            id="colunas"
            className="campo"
            value={cfg.colunas}
            onChange={(e) => campo("colunas", Number(e.target.value))}
          >
            <option value={48}>80 mm (48 colunas)</option>
            <option value={32}>58 mm (32 colunas)</option>
          </select>
        </div>
        <div>
          <label className="rotulo" htmlFor="vias">
            Vias de cada cupom
          </label>
          <input
            id="vias"
            className="campo"
            inputMode="numeric"
            value={cfg.vias}
            onChange={(e) => campo("vias", Math.min(5, Math.max(1, Number(e.target.value) || 1)))}
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-5">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-creme-suave">
          <input
            type="checkbox"
            className="accent-ouro"
            checked={cfg.cortar}
            onChange={(e) => campo("cortar", e.target.checked)}
          />
          Cortar o papel no fim
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-creme-suave">
          <input
            type="checkbox"
            className="accent-ouro"
            checked={cfg.abrir_gaveta}
            onChange={(e) => campo("abrir_gaveta", e.target.checked)}
          />
          Abrir a gaveta em entrega/retirada paga em dinheiro
        </label>
      </div>

      {aviso && (
        <p className="mt-4 rounded-lg border border-pronto/40 bg-pronto/10 px-3 py-2 text-sm text-pronto">
          {aviso}
        </p>
      )}
      {erro && (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-cancelado/40 bg-cancelado/10 px-3 py-2 text-sm text-cancelado"
        >
          {erro}
        </p>
      )}

      <button className="btn btn-ouro mt-5" onClick={salvar} disabled={salvando}>
        {salvando ? "Salvando…" : "Salvar impressora"}
      </button>
    </section>
  );
}
