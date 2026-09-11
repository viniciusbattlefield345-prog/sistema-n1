import { CERTIFICADO_QZ } from "@/lib/qz-certificado";

export const dynamic = "force-dynamic";

/**
 * Só entrega o certificado quando o servidor tem a chave pra assinar.
 * Certificado com assinatura em branco o QZ trata como inválido — é pior
 * do que o modo anônimo, que ao menos pergunta e imprime.
 */
export function GET() {
  if (!process.env.QZ_CHAVE_PRIVADA) {
    return new Response("Sem chave de impressão no servidor.", { status: 404 });
  }
  return new Response(CERTIFICADO_QZ, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}
