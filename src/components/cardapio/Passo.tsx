"use client";

/** Botãozinho redondo de somar e tirar um. Dedo grande, alvo grande. */
export function Passo({
  rotulo,
  aoTocar,
  children,
}: {
  rotulo: string;
  aoTocar: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={aoTocar}
      aria-label={rotulo}
      className="grid size-9 place-items-center rounded-full border border-borda-forte text-lg leading-none text-creme"
    >
      {children}
    </button>
  );
}
