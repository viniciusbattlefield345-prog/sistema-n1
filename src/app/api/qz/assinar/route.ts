import { createSign } from "node:crypto";
import { criarClienteServidor } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Assina cada pedido de impressão do QZ Tray com a chave privada do
 * General Burguer. Só pra quem está logado: com essa rota aberta, qualquer
 * site poderia imprimir calado no PC do balcão.
 */
export async function POST(request: Request) {
  const supabase = await criarClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Sessão expirada.", { status: 401 });

  // Na Vercel a chave pode ser colada com quebras de linha de verdade;
  // no .env.local ela vem numa linha só, com \n escrito.
  const chave = process.env.QZ_CHAVE_PRIVADA?.replace(/\\n/g, "\n");
  if (!chave) return new Response("Sem chave de impressão no servidor.", { status: 404 });

  const mensagem = await request.text();
  if (!mensagem || mensagem.length > 200_000) {
    return new Response("Mensagem inválida.", { status: 400 });
  }

  try {
    const assinatura = createSign("SHA512").update(mensagem).sign(chave, "base64");
    return new Response(assinatura, {
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  } catch {
    return new Response("A chave de impressão do servidor está inválida.", { status: 500 });
  }
}
