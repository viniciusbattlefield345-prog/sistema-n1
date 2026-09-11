"use client";

export function BotaoImprimir() {
  return (
    <button type="button" className="btn btn-ouro" onClick={() => window.print()}>
      Imprimir folha
    </button>
  );
}
