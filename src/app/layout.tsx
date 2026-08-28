import type { Metadata, Viewport } from "next";
import { Oswald, Inter_Tight, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const display = Oswald({
  variable: "--fonte-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const corpo = Inter_Tight({
  variable: "--fonte-corpo",
  subsets: ["latin"],
});

const mono = JetBrains_Mono({
  variable: "--fonte-mono",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  // Sem metadataBase o Next monta a URL da imagem como caminho relativo,
  // e o WhatsApp não consegue buscar — cai no ícone padrão.
  metadataBase: new URL("https://arinete.vercel.app"),
  title: "N°1 Restaurante e Choperia",
  description: "Estação do Chopp · Atílio Vivacqua/ES",
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "N°1 Restaurante e Choperia",
    title: "N°1 Restaurante e Choperia",
    description: "Estação do Chopp · Atílio Vivacqua/ES",
    url: "/",
    images: [
      {
        url: "/logo.jpg",
        width: 720,
        height: 720,
        alt: "N°1 Restaurante e Choperia",
      },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#0f0d0a",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${display.variable} ${corpo.variable} ${mono.variable} h-full`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
