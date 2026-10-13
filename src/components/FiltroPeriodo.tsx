"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { PRESETS, type Periodo, type Preset } from "@/lib/periodo";

/**
 * Escolher o intervalo de dias de uma tela de histórico.
 *
 * Cinco botões pro que se pergunta todo dia e dois campos de data pro resto.
 * O período vive na URL, não aqui: assim o dono manda o link do dia pra ele
 * mesmo no celular, F5 não perde o filtro e as duas telas usam o mesmo
 * mecanismo.
 *
 * As datas começam com o período atual e não se atualizam sozinhas depois —
 * quem renderiza passa `key` com o período pra remontar. É de propósito:
 * effect pra sincronizar prop com estado é bug esperando hora.
 */
export function FiltroPeriodo({
  periodo,
  children,
}: {
  periodo: Periodo;
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const caminho = usePathname();
  const [de, setDe] = useState(periodo.de);
  const [ate, setAte] = useState(periodo.ate);

  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2">
      <div className="flex flex-wrap gap-2">
        {(Object.keys(PRESETS) as Preset[]).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => router.push(`${caminho}?p=${p}`)}
            aria-pressed={periodo.preset === p}
            className={
              "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors " +
              (periodo.preset === p
                ? "border-ouro bg-ouro/15 text-ouro"
                : "border-borda text-creme-suave hover:border-borda-forte")
            }
          >
            {PRESETS[p]}
          </button>
        ))}
      </div>

      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          router.push(`${caminho}?de=${de}&ate=${ate}`);
        }}
      >
        <input
          type="date"
          className="campo w-auto"
          value={de}
          max={ate}
          onChange={(e) => setDe(e.target.value)}
          aria-label="Data inicial"
        />
        <span className="text-sm text-creme-fraco">até</span>
        <input
          type="date"
          className="campo w-auto"
          value={ate}
          min={de}
          onChange={(e) => setAte(e.target.value)}
          aria-label="Data final"
        />
        <button
          type="submit"
          className={
            "btn btn-quieto px-4 py-1.5 text-sm " +
            (periodo.preset === null ? "border-ouro text-ouro" : "")
          }
        >
          Ver
        </button>
      </form>

      {children}
    </div>
  );
}
