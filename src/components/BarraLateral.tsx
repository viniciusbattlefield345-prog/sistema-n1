"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Marca } from "./Marca";
import { sair } from "@/app/login/acoes";
import type { Papel } from "@/lib/tipos";

/** Icones desenhados aqui mesmo: nada de CDN de icone pra travar no rush. */
const Icone = ({ d }: { d: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    className="size-[18px] shrink-0"
    aria-hidden
  >
    <path d={d} />
  </svg>
);

const I = {
  mesas: "M3 9h18M5 9v11M19 9v11M8 9V5h8v4M9 14h6",
  entregas: "M3 7h10v8H3zM13 10h4l3 3v2h-7zM7.5 17.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0ZM18.5 17.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z",
  pdv: "M3 6h18M3 6l1.5 12h15L21 6M9 11v4M15 11v4",
  cozinha: "M6 3v8a3 3 0 0 0 6 0V3M9 11v10M15 3c-1.5 1.5-2 3-2 5s.5 3 2 3v10",
  pedidos: "M7 3h10a1 1 0 0 1 1 1v17l-3-2-3 2-3-2-3 2V4a1 1 0 0 1 1-1ZM9 8h6M9 12h6",
  caixa: "M3 7h18v12H3zM3 11h18M7 15h3",
  impressao: "M7 8V3h10v5M7 17H4v-7h16v7h-3M7 14h10v7H7z",
  relatorios: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  cardapio: "M4 3h16v18H4zM8 8h8M8 12h8M8 16h5",
  adicionais: "M12 5v14M5 12h14",
  categorias: "M4 6h16M4 12h16M4 18h10",
  qr: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 18h2v2h-2zM18 14h2M14 18h2",
  clientes: "M16 20v-1a4 4 0 0 0-8 0v1M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM21 20v-1a3 3 0 0 0-2-2.8",
  bairros: "M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11ZM12 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z",
  acessos: "M6 10V7a6 6 0 1 1 12 0v3M5 10h14v11H5zM12 15v2",
  config: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 7.5 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3 14.5a2 2 0 1 1 0-4 1.6 1.6 0 0 0 1.1-2.7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 9.5 3H10a2 2 0 1 1 4 0 1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.6 1.6 0 0 0 21 9.5a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1.5Z",
  sair: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
};

type Item = {
  href: string;
  rotulo: string;
  icone: string;
  dono?: boolean;
};

const VENDAS: Item[] = [
  { href: "/mesas", rotulo: "Mesas", icone: I.mesas },
  { href: "/entregas", rotulo: "Entregas", icone: I.entregas },
  { href: "/pdv", rotulo: "Novo pedido", icone: I.pdv },
  { href: "/cozinha", rotulo: "Cozinha", icone: I.cozinha },
  { href: "/pedidos", rotulo: "Pedidos", icone: I.pedidos },
  { href: "/caixa", rotulo: "Caixa", icone: I.caixa },
  { href: "/impressao", rotulo: "Impressão", icone: I.impressao },
];

const GERENCIA: Item[] = [
  { href: "/relatorios", rotulo: "Relatórios", icone: I.relatorios, dono: true },
  { href: "/cardapio", rotulo: "Cardápio", icone: I.cardapio },
  { href: "/adicionais", rotulo: "Adicionais", icone: I.adicionais },
  { href: "/categorias", rotulo: "Categorias", icone: I.categorias },
  { href: "/mesas/cadastro", rotulo: "Mesas e QR codes", icone: I.qr, dono: true },
  { href: "/clientes", rotulo: "Clientes", icone: I.clientes },
  { href: "/bairros", rotulo: "Bairros e taxas", icone: I.bairros },
  { href: "/acessos", rotulo: "Acessos", icone: I.acessos, dono: true },
  { href: "/configuracoes", rotulo: "Configurações", icone: I.config, dono: true },
];

/** "/mesas/cadastro" acende só o item dele, não "Mesas" junto. */
function itemAtivo(caminho: string): string | undefined {
  return [...VENDAS, ...GERENCIA]
    .filter((i) => caminho === i.href || caminho.startsWith(i.href + "/"))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
}

function Grupo({
  titulo,
  itens,
  ativo,
  papel,
}: {
  titulo: string;
  itens: Item[];
  ativo: string | undefined;
  papel: Papel;
}) {
  const visiveis = itens.filter((i) => !i.dono || papel === "dono");
  if (visiveis.length === 0) return null;

  return (
    <div className="mb-5">
      <p className="mb-2 px-3 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-creme-fraco">
        {titulo}
      </p>
      <nav className="flex flex-col gap-0.5">
        {visiveis.map((item) => {
          const aceso = ativo === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={aceso ? "page" : undefined}
              className={
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors " +
                (aceso
                  ? "bg-ouro/12 font-semibold text-ouro"
                  : "text-creme-suave hover:bg-madeira hover:text-creme")
              }
            >
              <Icone d={item.icone} />
              {item.rotulo}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export function BarraLateral({
  nome,
  papel,
  aberto,
}: {
  nome: string;
  papel: Papel;
  aberto: boolean;
}) {
  const ativo = itemAtivo(usePathname());
  const primeiroNome = nome.split(" ")[0];

  return (
    <aside
      className={
        "fixed inset-y-0 left-0 z-50 flex w-[232px] flex-col border-r border-borda bg-carvao transition-transform lg:z-40 lg:translate-x-0 " +
        (aberto ? "translate-x-0" : "-translate-x-full")
      }
    >
      <div className="flex justify-center border-b border-borda px-4 py-5">
        <Marca tamanho={1.3} />
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-4">
        <Grupo titulo="Vendas" itens={VENDAS} ativo={ativo} papel={papel} />
        <Grupo titulo="Gerência" itens={GERENCIA} ativo={ativo} papel={papel} />
      </div>

      <div className="border-t border-borda p-3">
        <p className="px-2 pb-2 text-xs text-creme-suave">
          <span className="text-creme-fraco">Logado como </span>
          <strong className="font-semibold text-creme">{primeiroNome}</strong>
        </p>
        <form action={sair}>
          <button type="submit" className="btn btn-quieto w-full text-sm">
            <Icone d={I.sair} />
            Sair
          </button>
        </form>
      </div>
    </aside>
  );
}
