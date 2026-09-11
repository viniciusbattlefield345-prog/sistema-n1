/**
 * Marca do General Burguer, em texto, enquanto a logo oficial não chega:
 * o nome em caixa-alta, branco, com a onda laranja por baixo — o mesmo
 * desenho do "GENERAL BURGUER" do cardápio impresso.
 *
 * `tamanho` é a altura da letra em rem; a onda acompanha.
 */
export function Marca({
  tamanho = 1.5,
  alinhamento = "centro",
  emLinha = false,
}: {
  tamanho?: number;
  alinhamento?: "centro" | "esquerda";
  /** "GENERAL BURGUER" numa linha só — pra barra de topo do celular. */
  emLinha?: boolean;
}) {
  return (
    <span
      role="img"
      aria-label="General Burguer"
      className={
        "inline-flex flex-col leading-[0.92] " +
        (alinhamento === "centro" ? "items-center text-center" : "items-start text-left")
      }
      style={{ fontSize: `${tamanho}rem` }}
    >
      <span aria-hidden className="font-display font-extrabold uppercase tracking-[0.01em] text-creme">
        {emLinha ? (
          "General Burguer"
        ) : (
          <>
            General
            <br />
            Burguer
          </>
        )}
      </span>
      <svg aria-hidden viewBox="0 0 100 8" className="mt-[0.14em] block h-auto w-full text-ouro">
        <path
          d="M1 4.5 Q 5.5 0.5 10 4.5 T 19 4.5 T 28 4.5 T 37 4.5 T 46 4.5 T 55 4.5 T 64 4.5 T 73 4.5 T 82 4.5 T 91 4.5 T 99 4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}
