import { Marca } from "@/components/Marca";

/** QR de mesa desativada ou com código trocado. O cliente não tem o que fazer além de chamar alguém. */
export default function MesaNaoEncontrada() {
  return (
    <main className="grid min-h-screen place-items-center bg-breu px-6 text-center">
      <div className="max-w-sm">
        <Marca tamanho={2} />
        <h1 className="mt-8 font-display text-xl font-bold uppercase tracking-wide text-creme">
          Este QR code não vale mais
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-creme-suave">
          Chame um atendente — ele lança o seu pedido rapidinho.
        </p>
      </div>
    </main>
  );
}
