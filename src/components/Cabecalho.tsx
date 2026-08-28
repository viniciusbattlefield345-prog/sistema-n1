export function Cabecalho({
  fita,
  titulo,
  descricao,
  children,
}: {
  fita: string;
  titulo: string;
  descricao?: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <span className="fita mb-3">{fita}</span>
        <h1 className="font-display text-2xl uppercase tracking-wide text-creme">
          {titulo}
        </h1>
        {descricao && (
          <p className="mt-1 max-w-xl text-sm text-creme-suave">{descricao}</p>
        )}
      </div>
      {children && <div className="flex shrink-0 gap-2">{children}</div>}
    </header>
  );
}

/** Estado vazio: tela sem dado é convite pra agir, não erro. */
export function Vazio({
  titulo,
  texto,
  children,
}: {
  titulo: string;
  texto: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-borda bg-carvao/50 px-6 py-14 text-center">
      <p className="font-display text-lg uppercase tracking-wide text-creme-suave">
        {titulo}
      </p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-creme-fraco">{texto}</p>
      {children && <div className="mt-6 flex justify-center gap-2">{children}</div>}
    </div>
  );
}
