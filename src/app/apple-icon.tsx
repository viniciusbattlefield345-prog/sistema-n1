import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Ícone de "adicionar à tela inicial" no iPhone. */
export default function IconeApple() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#0b0b0b",
          color: "#f6f5f2",
          fontSize: 34,
          fontWeight: 800,
          lineHeight: 1,
        }}
      >
        <div style={{ display: "flex" }}>GENERAL</div>
        <div style={{ display: "flex" }}>BURGUER</div>
        <div style={{ display: "flex", width: 120, height: 7, marginTop: 12, background: "#f5a100", borderRadius: 4 }} />
      </div>
    ),
    size,
  );
}
