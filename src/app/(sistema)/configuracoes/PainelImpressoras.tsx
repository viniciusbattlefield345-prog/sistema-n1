"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { listarImpressoras, imprimirCru, conectar } from "@/lib/impressora";
import { Cupom } from "@/lib/escpos";
import { salvarImpressoras } from "./acoes";
import type { ConfigImpressoras, ConfigRestaurante } from "@/lib/tipos";

type EstadoQz = "procurando" | "ligado" | "desligado";

/** Cupom curtinho só pra confirmar que a impressora responde. */
function cupomDeTeste(colunas: number, restaurante: ConfigRestaurante) {
  const c = new Cupom(colunas);
  c.titulo(restaurante?.nome ?? "RESTAURANTE E CHOPERIA");
  c.alinhar(1).linha("teste de impressao").alinhar(0);
  c.separador();
  c.item(2, "Marmita (G) com acompanhamentos", "44,00");
  c.detalhe("+ Arroz, Feijao, Costelinha");
  c.separador();
  c.doisLados("TOTAL", "44,00");
  c.separador("=");
  c.alinhar(1).linha("Se voce esta lendo isso,").linha("a impressora esta certa.");
  c.alinhar(0).cortar();
  return c.paraBase64();
}

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
      const lista = await listarImpressoras();
      setImpressoras(lista);
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
      setAviso("Impressoras salvas.");
    });
  }

  async function testar(qual: "cozinha" | "entrega") {
    setErro(null);
    setAviso(null);
    try {
      await imprimirCru(cfg[qual], cupomDeTeste(cfg.colunas, restaurante), 1);
      setAviso(`Enviado para "${cfg[qual]}". Saiu papel?`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não consegui imprimir.");
    }
  }

  const campo = <K extends keyof ConfigImpressoras>(
    k: K,
    v: ConfigImpressoras[K],
  ) => setCfg((c) => ({ ...c, [k]: v }));

  return (
    <section className="rounded-2xl border border-borda bg-carvao p-6">
      <h2 className="mb-1 font-display text-xl uppercase tracking-wide text-creme">
        Impressoras
      </h2>
      <p className="mb-5 text-sm text-creme-suave">
        A impressão sai direto do navegador para a impressora USB, através do
        QZ Tray instalado neste computador.
      </p>

      {/* estado do QZ */}
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
        {qz === "ligado" && (
          <>
            QZ Tray conectado — {impressoras.length} impressora(s) encontrada(s).
          </>
        )}
        {qz === "desligado" && (
          <>
            <strong className="block">QZ Tray não está aberto neste computador.</strong>
            Sem ele o navegador não enxerga a impressora. Baixe em{" "}
            <a
              href="https://qz.io/download/"
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              qz.io/download
            </a>
            , instale, deixe aberto na bandeja do Windows e clique em procurar de novo.
          </>
        )}
        <button
          type="button"
          onClick={procurar}
          className="ml-2 underline underline-offset-2"
        >
          procurar de novo
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {(["cozinha", "entrega"] as const).map((qual) => (
          <div key={qual}>
            <label className="rotulo" htmlFor={`imp-${qual}`}>
              {qual === "cozinha" ? "Via da cozinha" : "Via do cliente / entrega"}
            </label>

            {impressoras.length > 0 ? (
              <select
                id={`imp-${qual}`}
                className="campo"
                value={cfg[qual]}
                onChange={(e) => campo(qual, e.target.value)}
              >
                {!impressoras.includes(cfg[qual]) && (
                  <option value={cfg[qual]}>
                    {cfg[qual]} (não encontrada agora)
                  </option>
                )}
                {impressoras.map((i) => (
                  <option key={i} value={i}>
                    {i}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id={`imp-${qual}`}
                className="campo"
                value={cfg[qual]}
                onChange={(e) => campo(qual, e.target.value)}
                placeholder="TANCA TP-650"
              />
            )}

            <button
              type="button"
              className="btn btn-quieto mt-2 w-full py-2 text-xs"
              onClick={() => testar(qual)}
              disabled={qz !== "ligado"}
            >
              Imprimir um teste
            </button>
          </div>
        ))}
      </div>

      <p className="mt-2 text-xs text-creme-fraco">
        Pode ser a mesma impressora nas duas — aí saem os dois cupons, um depois
        do outro.
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <div>
          <label className="rotulo" htmlFor="colunas">Largura do papel</label>
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
          <label className="rotulo" htmlFor="vias-c">Vias da cozinha</label>
          <input
            id="vias-c"
            className="campo"
            inputMode="numeric"
            value={cfg.vias_cozinha}
            onChange={(e) => campo("vias_cozinha", Math.max(1, Number(e.target.value) || 1))}
          />
        </div>
        <div>
          <label className="rotulo" htmlFor="vias-e">Vias da entrega</label>
          <input
            id="vias-e"
            className="campo"
            inputMode="numeric"
            value={cfg.vias_entrega}
            onChange={(e) => campo("vias_entrega", Math.max(1, Number(e.target.value) || 1))}
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
          Abrir a gaveta quando o pagamento for dinheiro
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

      <button
        className="btn btn-ouro mt-5"
        onClick={salvar}
        disabled={salvando}
      >
        {salvando ? "Salvando…" : "Salvar impressoras"}
      </button>
    </section>
  );
}
