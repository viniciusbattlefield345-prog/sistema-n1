"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Marca do restaurante.
 * Se existir /public/logo.png, usa a arte. Se nao, monta o brasao em texto —
 * assim o sistema nunca abre quebrado esperando um arquivo.
 */
export function Marca({
  tamanho = 84,
  comFita = true,
}: {
  tamanho?: number;
  comFita?: boolean;
}) {
  const [temArte, setTemArte] = useState(true);
  const ref = useRef<HTMLImageElement>(null);

  // A imagem pode falhar antes do React montar o onError (no primeiro paint).
  // Depois de montar, conferimos o resultado real do carregamento.
  useEffect(() => {
    const img = ref.current;
    if (img?.complete && img.naturalWidth === 0) setTemArte(false);
  }, []);

  return (
    <div className="flex flex-col items-center gap-2">
      {temArte ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={ref}
          src="/logo.png"
          alt="N1 Restaurante e Choperia"
          width={tamanho}
          height={tamanho}
          className="rounded-full object-contain"
          style={{ width: tamanho, height: tamanho }}
          onError={() => setTemArte(false)}
        />
      ) : (
        <div
          className="flex items-center justify-center rounded-full border-2 border-ouro-escuro bg-breu"
          style={{ width: tamanho, height: tamanho }}
        >
          <span
            className="metal font-display font-bold leading-none"
            style={{ fontSize: tamanho * 0.42 }}
          >
            N°1
          </span>
        </div>
      )}

      {comFita && <span className="fita">Estação do Chopp</span>}
    </div>
  );
}
