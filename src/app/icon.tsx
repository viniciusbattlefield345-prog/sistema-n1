import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

/** Ícone da aba: "GB" laranja no preto, até a logo oficial chegar. */
export default function Icone() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0b0b0b",
          color: "#f5a100",
          fontSize: 34,
          fontWeight: 800,
          letterSpacing: -1,
          borderRadius: 14,
        }}
      >
        GB
      </div>
    ),
    size,
  );
}
