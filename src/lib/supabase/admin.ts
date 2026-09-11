import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cliente: SupabaseClient | null = null;

/**
 * Cliente com a chave de serviço — passa por cima da RLS.
 *
 * Só roda no servidor, e só onde não existe login: o cardápio que o cliente
 * abre pelo QR da mesa, o pedido que ele envia e o envio de foto do cardápio.
 * Toda regra (mesa válida, produto ativo, preço do banco) é conferida no
 * código antes de gravar — o navegador nunca escolhe o que vai pro banco.
 */
export function clienteServico(): SupabaseClient {
  if (typeof window !== "undefined") {
    throw new Error("A chave de serviço não pode ir para o navegador.");
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !chave) {
    throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY no servidor.");
  }
  cliente ??= createClient(url, chave, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cliente;
}
