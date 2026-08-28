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
  title: "N1 Restaurante e Choperia",
  description: "Sistema de pedidos e delivery",
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
