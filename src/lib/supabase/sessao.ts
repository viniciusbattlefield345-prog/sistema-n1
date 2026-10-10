import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Quem está logado — conferido aqui dentro, sem perguntar pro Supabase.
 *
 * O `getUser()` faz uma viagem de rede a cada chamada. Um clique em "Aprovar"
 * fazia três: o proxy, o layout e a própria ação, todas perguntando a mesma
 * coisa. Com o banco respondendo em 6 ms, essas viagens eram a maior parte da
 * demora que se sentia no balcão.
 *
 * Este projeto assina o login com chave assimétrica (ES256), então dá pra
 * conferir a assinatura aqui, com a chave pública, sem sair da função.
 *
 * Não confundir com `getSession()`: aquele lê o cookie e acredita, e por isso
 * está proibido no proxy. Este confere a assinatura de verdade — cookie
 * adulterado ou vencido é reprovado igual.
 *
 * Se qualquer coisa sair do esperado (a chave não baixou, o projeto voltou pra
 * chave simétrica, falta WebCrypto), cai no `getUser()` de antes. No pior caso
 * fica igual a hoje; nunca pior.
 */

export type Usuario = { id: string; email: string | null };

type Opcoes = NonNullable<Parameters<SupabaseClient["auth"]["getClaims"]>[1]>;
type Chaveiro = NonNullable<Opcoes["jwks"]>;

/**
 * A chave pública fica guardada aqui, no módulo — e não dentro do cliente
 * Supabase, que nasce novo a cada requisição. Sem isso, cada clique baixaria a
 * chave outra vez e a viagem de rede voltaria pela porta dos fundos.
 */
let chaveiro: Chaveiro | null = null;
let valeAte = 0;
const VALIDADE_MS = 10 * 60_000;

async function chavePublica(): Promise<Chaveiro | null> {
  const agora = Date.now();
  if (chaveiro && agora < valeAte) return chaveiro;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return null;

  try {
    const resposta = await fetch(`${url}/auth/v1/.well-known/jwks.json`, {
      cache: "no-store",
      // Se o endpoint travar, é melhor cair no getUser() do que pendurar o
      // pedido de impressão esperando uma chave.
      signal: AbortSignal.timeout(2500),
    });
    if (!resposta.ok) return null;

    const corpo = (await resposta.json()) as Chaveiro;
    if (!corpo?.keys?.length) return null;

    chaveiro = corpo;
    valeAte = agora + VALIDADE_MS;
    return chaveiro;
  } catch {
    return null;
  }
}

export async function usuarioAtual(supabase: SupabaseClient): Promise<Usuario | null> {
  const jwks = await chavePublica();

  if (jwks) {
    try {
      const { data, error } = await supabase.auth.getClaims(undefined, { jwks });
      const sub = data?.claims?.sub;
      if (!error && sub) {
        const email = data.claims.email;
        return { id: sub, email: typeof email === "string" ? email : null };
      }
    } catch {
      // cai no caminho antigo
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { id: user.id, email: user.email ?? null } : null;
}
