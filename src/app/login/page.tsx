import { FormularioLogin } from "./FormularioLogin";
import { Marca } from "@/components/Marca";

export default async function PaginaLogin({ searchParams }: PageProps<"/login">) {
  const { voltar } = await searchParams;
  const destino = typeof voltar === "string" ? voltar : "/pdv";

  return (
    <main className="grid min-h-screen place-items-center bg-breu px-4 py-10">
      <div className="w-full max-w-sm">
        {/* a propria arte ja traz a fita "Estacao do Chopp": nao repetir */}
        <div className="mb-6 flex justify-center">
          <Marca tamanho={170} comFita={false} />
        </div>

        <div className="rounded-2xl border border-borda bg-carvao p-7">
          <h1 className="mb-1 font-display text-2xl font-medium uppercase tracking-wide text-creme">
            Entrar
          </h1>
          <p className="mb-6 text-sm text-creme-suave">
            Sistema de pedidos e delivery
          </p>

          <FormularioLogin destino={destino} />
        </div>

        <p className="mt-6 text-center text-xs text-creme-fraco">
          Segunda a sábado, 11h às 14h · Atílio Vivacqua/ES
        </p>
      </div>
    </main>
  );
}
