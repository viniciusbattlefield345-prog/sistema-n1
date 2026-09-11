import { FormularioLogin } from "./FormularioLogin";
import { Marca } from "@/components/Marca";

export default async function PaginaLogin({ searchParams }: PageProps<"/login">) {
  const { voltar } = await searchParams;
  const destino = typeof voltar === "string" ? voltar : "/mesas";

  return (
    <main className="grid min-h-screen place-items-center bg-breu px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Marca tamanho={2.6} />
        </div>

        <div className="rounded-2xl border border-borda bg-carvao p-7">
          <h1 className="mb-1 font-display text-2xl font-extrabold uppercase tracking-wide text-creme">
            Entrar
          </h1>
          <p className="mb-6 text-sm text-creme-suave">Sistema de pedidos, mesas e delivery</p>

          <FormularioLogin destino={destino} />
        </div>
      </div>
    </main>
  );
}
