import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** Cliente Supabase para Server Components, Server Actions e Route Handlers. */
export async function criarClienteServidor() {
  const jar = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return jar.getAll();
        },
        setAll(lista) {
          try {
            lista.forEach(({ name, value, options }) =>
              jar.set(name, value, options),
            );
          } catch {
            // Server Component nao pode escrever cookie.
            // O middleware ja renova a sessao, entao aqui e seguro ignorar.
          }
        },
      },
    },
  );
}
