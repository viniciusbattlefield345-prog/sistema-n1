import QRCode from "qrcode";
import { criarClienteServidor } from "@/lib/supabase/server";
import { enderecoDoSite } from "@/lib/endereco";
import { BotaoImprimir } from "./BotaoImprimir";

export const revalidate = 0;

/** Folha A4 com o QR de cada mesa ativa, pronta pra imprimir e plastificar. */
export default async function FolhaQrCodes() {
  const supabase = await criarClienteServidor();
  const [{ data: mesas }, endereco] = await Promise.all([
    supabase.from("mesas").select("id, numero, codigo").eq("ativo", true).order("numero"),
    enderecoDoSite(),
  ]);

  const cartoes = await Promise.all(
    (mesas ?? []).map(async (m) => {
      const link = `${endereco}/m/${m.codigo}`;
      const svg = await QRCode.toString(link, {
        type: "svg",
        margin: 0,
        errorCorrectionLevel: "M",
        color: { dark: "#000000", light: "#ffffff" },
      });
      // Como imagem (data URI), e não HTML injetado na página.
      const imagem = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
      return { ...m, link, imagem };
    }),
  );

  const local = endereco.includes("localhost") || endereco.includes("127.0.0.1");

  return (
    <div className="folha-qr p-4 lg:p-8">
      <div className="nao-imprimir mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="fita mb-3">Mesas</span>
          <h1 className="font-display text-2xl font-extrabold uppercase">QR codes das mesas</h1>
          <p className="mt-1 max-w-xl text-sm text-creme-suave">
            Endereço usado: <strong className="text-creme">{endereco}</strong>
          </p>
        </div>
        <BotaoImprimir />
      </div>

      {local && (
        <p className="nao-imprimir mb-6 rounded-xl border border-cancelado/40 bg-cancelado/10 px-4 py-3 text-sm text-cancelado">
          Você está no endereço de teste deste computador. QR impresso daqui não abre no celular do
          cliente — imprima pelo site publicado.
        </p>
      )}

      {cartoes.length === 0 ? (
        <p className="text-sm text-creme-suave">Nenhuma mesa ativa.</p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 print:grid-cols-2 print:gap-[8mm]">
          {cartoes.map((c) => (
            <div
              key={c.id}
              className="cartao-qr flex flex-col items-center rounded-2xl border-2 border-black bg-white px-6 py-7 text-center text-black"
            >
              <p className="font-display text-2xl font-extrabold uppercase leading-none tracking-tight">
                General Burguer
              </p>
              <div className="mt-2 w-28 border-t-[6px] border-ouro" />
              <p className="mt-5 font-display text-5xl font-extrabold uppercase leading-none">
                Mesa {c.numero}
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.imagem} alt={`QR code da mesa ${c.numero}`} className="mt-5 block w-52" />
              <p className="mt-5 text-lg font-bold leading-tight">Aponte a câmera do celular</p>
              <p className="text-sm">e faça seu pedido pelo cardápio</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
