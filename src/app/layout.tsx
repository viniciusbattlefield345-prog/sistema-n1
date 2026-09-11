import type { Metadata, Viewport } from "next";
import { Montserrat, Inter_Tight, JetBrains_Mono, Great_Vibes } from "next/font/google";
import "./globals.css";

// Montserrat pesada é a letra dos nomes do cardápio impresso ("CALABRESA").
const display = Montserrat({
  variable: "--fonte-display",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
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

// O "Cardápio" manuscrito do topo do cardápio. Só aparece na tela do cliente.
const script = Great_Vibes({
  variable: "--fonte-script",
  subsets: ["latin"],
  weight: "400",
});

// A Vercel informa o endereço de produção no build. Sem metadataBase, a
// imagem de compartilhamento vira caminho relativo e o WhatsApp não acha.
const endereco = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "http://localhost:3400";

export const metadata: Metadata = {
  metadataBase: new URL(endereco),
  title: {
    default: "General Burguer",
    template: "%s · General Burguer",
  },
  description: "Hambúrgueres, pizzas e porções. Peça direto da mesa.",
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "General Burguer",
    title: "General Burguer",
    description: "Hambúrgueres, pizzas e porções. Peça direto da mesa.",
    url: "/",
  },
};

export const viewport: Viewport = {
  themeColor: "#0b0b0b",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${display.variable} ${corpo.variable} ${mono.variable} ${script.variable} h-full`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
