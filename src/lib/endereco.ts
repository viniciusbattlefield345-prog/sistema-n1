import { headers } from "next/headers";

/**
 * Endereço do site como o navegador está vendo agora ("https://…vercel.app").
 * É o que vai dentro do QR code — por isso a folha avisa quando é localhost.
 */
export async function enderecoDoSite(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3400";
  const protocolo =
    h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${protocolo}://${host}`;
}
