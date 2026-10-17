"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { BarraLateral } from "./BarraLateral";
import { Marca } from "./Marca";
import { criarClienteNavegador } from "@/lib/supabase/client";
import { alarmar, apitar, prepararSom, somDestravado } from "@/lib/som";
import type { Papel } from "@/lib/tipos";

/**
 * Moldura do sistema.
 *
 * No computador do caixa o menu fica sempre à vista. No celular ele viraria
 * 232px dos 375 disponíveis, então some e volta como gaveta.
 */
export function Moldura({
  nome,
  papel,
  children,
}: {
  nome: string;
  papel: Papel;
  children: React.ReactNode;
}) {
  const [aberto, setAberto] = useState(false);
  const caminho = usePathname();

  // Navegou: fecha a gaveta, senão ela tapa a tela que acabou de abrir.
  useEffect(() => setAberto(false), [caminho]);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, []);

  return (
    <div className="min-h-screen">
      {/* barra de topo — só no celular */}
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-borda bg-carvao px-4 py-2.5 lg:hidden">
        <button
          type="button"
          onClick={() => setAberto(true)}
          aria-label="Abrir menu"
          aria-expanded={aberto}
          className="btn btn-quieto p-2.5"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            className="size-5"
            aria-hidden
          >
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
        <Marca tamanho={0.95} alinhamento="esquerda" emLinha />
      </header>

      {/* véu atrás da gaveta */}
      {aberto && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={() => setAberto(false)}
          role="presentation"
        />
      )}

      <BarraLateral nome={nome} papel={papel} aberto={aberto} />

      <main className="bg-breu lg:ml-[232px]">{children}</main>

      {/*
        Uma coluna só de avisos. A impressora vem em cima dos pedidos
        esperando porque é o aviso que ninguém mais vai dar: pedido parado
        aparece na tela de mesas, papel que não sai não aparece em lugar
        nenhum — só no silêncio.
      */}
      <div className="nao-imprimir fixed right-3 top-[4.25rem] z-[45] flex flex-col items-end gap-2 lg:top-4">
        {/* em cima de todos: enquanto ele estiver ali, nenhum aviso faz som */}
        <AvisoSomMudo />
        <AvisoImpressao />
        {papel !== "cozinha" && <AvisoAguardando />}
      </div>
    </div>
  );
}

/**
 * De quanto em quanto tempo o alarme de pedido de casa volta a tocar
 * enquanto ninguem aprova. Meio minuto incomoda o bastante pra ninguem
 * esquecer, e pouco o bastante pra ninguem desligar o som por raiva.
 */
const INTERVALO_ALARME = 30_000;

/**
 * Pedido esperando aprovação, em qualquer tela: o atendente pode estar no PDV
 * ou no caixa quando o cliente pede. Apita quando a conta sobe.
 *
 * Mesa e delivery são contados separados porque moram em telas diferentes —
 * um aviso que leva pro lugar errado é pior do que aviso nenhum.
 */
function AvisoAguardando() {
  const [mesa, setMesa] = useState(0);
  const [entrega, setEntrega] = useState(0);
  const anterior = useRef<{ mesa: number; casa: number } | null>(null);
  /**
   * Quando o alarme de entrega tocou pela última vez.
   *
   * Zera quando a fila de casa esvazia, pra que o próximo pedido alarme na
   * hora em vez de esperar o intervalo correr.
   */
  const ultimoAlarme = useRef(0);
  const caminho = usePathname();

  useEffect(() => {
    const soltarSom = prepararSom();
    const supabase = criarClienteNavegador();
    let vivo = true;

    async function contar() {
      const { data } = await supabase
        .from("pedidos")
        .select("tipo")
        .eq("status", "AGUARDANDO");
      if (!vivo || !data) return;

      const deMesa = data.filter((p) => p.tipo === "MESA").length;
      const deCasa = data.length - deMesa;

      /*
        Pedido de casa: alarme alto, e ele VOLTA enquanto ninguém aprovar.
        Um aviso que toca uma vez só serve pra quem estava olhando naquele
        segundo — e é justamente o pedido de entrega que chega com a loja
        cheia e o balcão de costas. Para sozinho quando alguém atende.
      */
      let alarmou = false;
      if (deCasa === 0) {
        ultimoAlarme.current = 0;
      } else if (Date.now() - ultimoAlarme.current > INTERVALO_ALARME) {
        alarmar();
        ultimoAlarme.current = Date.now();
        alarmou = true;
      }

      // Mesa continua no apito curto, e só quando entra um novo: o cliente
      // está na casa, e o cartão aparece na tela de quem está atendendo.
      if (!alarmou && anterior.current && deMesa > anterior.current.mesa) apitar();

      anterior.current = { mesa: deMesa, casa: deCasa };
      setMesa(deMesa);
      setEntrega(deCasa);
    }

    void contar();
    const canal = supabase
      .channel(`aviso-aguardando-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "pedidos" }, () => void contar())
      .subscribe();
    // Rede de segurança pra quando o tempo real cai (Wi-Fi ruim, aba velha):
    // 8s é o atraso máximo que um pedido pode ficar invisível pro atendente.
    const relogio = setInterval(() => void contar(), 8000);
    const aoVoltar = () => {
      if (document.visibilityState === "visible") void contar();
    };
    document.addEventListener("visibilitychange", aoVoltar);

    return () => {
      vivo = false;
      clearInterval(relogio);
      soltarSom();
      document.removeEventListener("visibilitychange", aoVoltar);
      void supabase.removeChannel(canal);
    };
  }, []);

  // Na própria tela do assunto o selo é ruído: a lista já está logo abaixo.
  const avisos = [
    caminho === "/mesas" || mesa === 0
      ? null
      : { href: "/mesas", texto: `${mesa} na mesa`, chave: "mesa" },
    caminho === "/entregas" || entrega === 0
      ? null
      : { href: "/entregas", texto: `${entrega} no delivery`, chave: "entrega" },
  ].filter((a) => a !== null);

  if (avisos.length === 0) return null;

  return (
    <>
      {avisos.map((a) => (
        <Link
          key={a.chave}
          href={a.href}
          className="flex items-center gap-2 rounded-full bg-ouro px-4 py-2.5 text-sm font-bold text-black shadow-lg shadow-black/60"
        >
          <span className="relative flex size-2.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-black opacity-60" />
            <span className="relative inline-flex size-2.5 rounded-full bg-black" />
          </span>
          {a.texto} esperando
        </Link>
      ))}
    </>
  );
}

/**
 * O navegador não deixa som nenhum tocar antes de alguém encostar na página.
 *
 * No celular isso se resolve sozinho: o primeiro toque na tela já libera, e
 * ninguém usa o sistema sem tocar nele. No PC do balcão, não — a janela da
 * impressão é aberta por tarefa agendada e passa o dia sem receber um clique.
 * Ela estava pronta pra apitar desde sempre, e muda o tempo todo: conferido
 * na máquina, o Chrome de lá sobe sem `--autoplay-policy`.
 *
 * Então o silêncio passa a ser visível. Um toque aqui resolve pro resto do
 * dia, e o apito de volta confirma que resolveu — sem ele a pessoa toca, não
 * ouve nada, e fica sem saber se funcionou.
 */
function AvisoSomMudo() {
  const [mudo, setMudo] = useState(false);
  const querConfirmar = useRef(false);

  useEffect(() => {
    if (somDestravado()) return;
    setMudo(true);
    return prepararSom(() => {
      setMudo(false);
      if (querConfirmar.current) apitar();
    });
  }, []);

  if (!mudo) return null;

  return (
    <button
      type="button"
      onClick={() => {
        // O próprio clique destrava: prepararSom ouve o pointerdown. Aqui só
        // fica marcado que esta pessoa quer ouvir a confirmação.
        querConfirmar.current = true;
      }}
      className="flex max-w-[17rem] items-center gap-2.5 rounded-2xl border border-ouro bg-carvao px-4 py-3 text-left text-sm font-bold text-ouro shadow-lg shadow-black/60"
    >
      <span aria-hidden className="shrink-0 text-base">
        🔇
      </span>
      <span className="leading-snug">
        Sem som nesta tela
        <span className="block text-xs font-semibold text-creme-suave">
          o navegador trava o áudio até alguém tocar · toque aqui
        </span>
      </span>
    </button>
  );
}

/**
 * Cupom parado na fila: o aviso que faltava.
 *
 * Em 14/10/2026 a estação do balcão parou de consumir a fila às 18:44 e só
 * voltou às 21:36. Três pedidos e uma conta ficaram esperando, e ninguém
 * descobriu pelo sistema: descobriram pelo papel que não apareceu. A fila
 * mora numa tela que ninguém olha, então o silêncio dela parecia sucesso.
 *
 * Agora o silêncio fala. Qualquer tela do sistema mostra, e apita uma vez.
 */
function AvisoImpressao() {
  const [parados, setParados] = useState<{ quantos: number; minutos: number } | null>(null);
  /** Já apitei por esta travada? Alarme que repete vira barulho ignorado. */
  const apitou = useRef(false);
  const caminho = usePathname();

  useEffect(() => {
    const soltarSom = prepararSom();
    const supabase = criarClienteNavegador();
    let vivo = true;

    async function conferir() {
      const { data } = await supabase
        .from("fila_impressao")
        .select("criado_em")
        .in("status", ["PENDENTE", "IMPRIMINDO"])
        .order("criado_em")
        .limit(30);
      if (!vivo) return;

      const maisVelho = data?.[0];
      if (!maisVelho) {
        setParados(null);
        apitou.current = false;
        return;
      }

      // Do clique ao papel são 6 a 13 segundos. Um minuto e meio parado não
      // é lentidão: é alguma coisa quebrada entre aqui e o papel.
      const segundos = (Date.now() - new Date(maisVelho.criado_em).getTime()) / 1000;
      if (segundos < 90) {
        setParados(null);
        apitou.current = false;
        return;
      }

      if (!apitou.current) {
        apitar();
        apitou.current = true;
      }
      setParados({ quantos: data!.length, minutos: Math.floor(segundos / 60) });
    }

    void conferir();
    const canal = supabase
      .channel(`aviso-impressao-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "fila_impressao" },
        () => void conferir(),
      )
      .subscribe();
    // O relógio aqui importa mais que o tempo real: o caso que este aviso
    // existe pra pegar é justamente o de nada acontecer na tabela.
    const relogio = setInterval(() => void conferir(), 10_000);
    const aoVoltar = () => {
      if (document.visibilityState === "visible") void conferir();
    };
    document.addEventListener("visibilitychange", aoVoltar);

    return () => {
      vivo = false;
      clearInterval(relogio);
      soltarSom();
      document.removeEventListener("visibilitychange", aoVoltar);
      void supabase.removeChannel(canal);
    };
  }, []);

  // Na própria estação o aviso é ruído: a fila está na tela, com o motivo.
  if (!parados || caminho === "/impressao") return null;

  return (
    <Link
      href="/impressao"
      className="flex max-w-[17rem] items-center gap-2.5 rounded-2xl bg-cancelado px-4 py-3 text-sm font-bold text-white shadow-lg shadow-black/60"
    >
      <span className="relative flex size-2.5 shrink-0">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-white opacity-70" />
        <span className="relative inline-flex size-2.5 rounded-full bg-white" />
      </span>
      <span className="leading-snug">
        Nada saindo na impressora
        <span className="block text-xs font-semibold text-white/85">
          {parados.quantos} {parados.quantos === 1 ? "cupom parado" : "cupons parados"}
          {parados.minutos > 0 ? ` há ${parados.minutos} min` : " agora"} · toque pra ver
        </span>
      </span>
    </Link>
  );
}
