/**
 * O Supabase Auth exige e-mail, mas a equipe do restaurante entra por
 * nome de usuario: a Arinete digita "arinete", nao um endereco.
 *
 * O sistema completa o domínio por baixo. Quem digitar um e-mail
 * completo (com @) entra com ele mesmo — e-mail antigo continua valendo.
 */
export const DOMINIO_INTERNO = "n1restaurante.com";

/** "Arinete " -> "arinete@n1restaurante.com" · "eu@gmail.com" -> inalterado */
export function usuarioParaEmail(digitado: string): string {
  const limpo = digitado.trim().toLowerCase();
  if (limpo.includes("@")) return limpo;
  return `${normalizarUsuario(limpo)}@${DOMINIO_INTERNO}`;
}

/**
 * Deixa o nome utilizável como parte de um e-mail: sem acento, sem espaço,
 * sem símbolo. "João Pedro" vira "joao.pedro".
 */
export function normalizarUsuario(nome: string): string {
  return [...nome.trim().toLowerCase().normalize("NFD")]
    .filter((c) => {
      const n = c.codePointAt(0)!;
      return n < 0x300 || n > 0x36f; // descarta as marcas de acento
    })
    .join("")
    .replace(/\s+/g, ".")
    .replace(/[^a-z0-9._-]/g, "");
}

/** O contrário: mostra "arinete" em vez do e-mail interno. */
export function emailParaUsuario(email: string): string {
  const [usuario, dominio] = email.split("@");
  return dominio === DOMINIO_INTERNO ? usuario : email;
}
