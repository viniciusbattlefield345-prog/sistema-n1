import Link from "next/link";

/** Rede de segurança: nenhum 404 deve virar beco sem saída. */
export default function NaoEncontrado() {
  return (
    <main className="grid min-h-screen place-items-center bg-breu px-4">
      <div className="max-w-md text-center">
        <span className="fita mb-5">Página não encontrada</span>
        <h1 className="mb-2 font-display text-2xl uppercase tracking-wide text-creme">
          Esta tela ainda não existe
        </h1>
        <p className="mb-7 text-sm leading-relaxed text-creme-suave">
          O sistema está sendo construído por partes. Hoje funcionam o login, o
          lançamento de pedidos e a impressão — o resto aparece no menu marcado
          como &ldquo;em breve&rdquo;.
        </p>
        <Link href="/pdv" className="btn btn-ouro">
          Voltar para os pedidos
        </Link>
      </div>
    </main>
  );
}
