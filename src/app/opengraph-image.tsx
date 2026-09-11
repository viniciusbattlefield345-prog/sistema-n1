import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "General Burguer — cardápio";

/** Prévia que aparece quando o link é compartilhado no WhatsApp. */
export default function ImagemCompartilhamento() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 96px",
          background: "#0b0b0b",
          color: "#f6f5f2",
        }}
      >
        <div style={{ display: "flex", fontSize: 128, fontWeight: 800, lineHeight: 0.95 }}>GENERAL</div>
        <div style={{ display: "flex", fontSize: 128, fontWeight: 800, lineHeight: 0.95 }}>BURGUER</div>
        <div style={{ display: "flex", width: 520, height: 16, marginTop: 28, background: "#f5a100", borderRadius: 8 }} />
        <div style={{ display: "flex", marginTop: 40, fontSize: 40, color: "#b7b5ae" }}>
          Hambúrgueres, pizzas e porções · peça direto da mesa
        </div>
      </div>
    ),
    size,
  );
}
