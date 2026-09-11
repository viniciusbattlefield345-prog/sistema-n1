import Link from "next/link";

/** Rede de segurança: nenhum 404 deve virar beco sem saída. */
export default function NaoEncontrado() {
  return (
    <main className="grid min-h-screen place-items-center bg-breu px-4">
      <div className="max-w-md text-center">
        <span className="fita mb-5">Página não encontrada</span>
        <h1 className="mb-2 font-display text-2xl font-extrabold uppercase tracking-wide text-creme">
          Essa tela não existe
        </h1>
        <p className="mb-7 text-sm leading-relaxed text-creme-suave">
          O endereço pode ter sido digitado errado, ou o item foi apagado.
        </p>
        <Link href="/mesas" className="btn btn-ouro">
          Voltar para as mesas
        </Link>
      </div>
    </main>
  );
}
