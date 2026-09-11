"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Cabecalho } from "@/components/Cabecalho";
import { criarClienteNavegador } from "@/lib/supabase/client";
import {
  conectar,
  ImpressoraIndisponivel,
  imprimirCru,
  listarImpressoras,
} from "@/lib/impressora";
import { cupomDeTeste, viaConta, viaPedido } from "@/lib/cupom";
import { hora, numeroPedido, rotuloPedido } from "@/lib/formato";
import { salvarImpressoras } from "../configuracoes/acoes";
import type {
  Comanda,
  ConfigImpressoras,
  ConfigRestaurante,
  Pedido,
  StatusImpressao,
  TipoPedido,
  TrabalhoImpressao,
} from "@/lib/tipos";

/**
 * A tela que fica aberta no computador da impressora.
 *
 * Ela vigia a fila (tempo real + conferência a cada 15s), pega um cupom por
 * vez, monta o ESC/POS com os dados frescos do banco e manda pro QZ Tray.
 * A "pegada" é atômica (status PENDENTE -> IMPRIMINDO numa condição só):
 * duas abas abertas não imprimem o mesmo cupom duas vezes.
 */

type Linha = TrabalhoImpressao & {
  pedidos: { numero_dia: number | null; tipo: TipoPedido; mesas: { numero: number } | null } | null;
  comandas: { mesas: { numero: number } | null } | null;
};

type EstadoQz = "procurando" | "ligado" | "desligado";

const SITUACAO: Record<StatusImpressao, { texto: string; cor: string }> = {
  PENDENTE: { texto: "Na fila", cor: "bg-ouro/20 text-ouro" },
  IMPRIMINDO: { texto: "Imprimindo…", cor: "bg-preparo/20 text-preparo" },
  IMPRESSO: { texto: "Impresso", cor: "bg-pronto/15 text-pronto" },
  ERRO: { texto: "Não imprimiu", cor: "bg-cancelado/20 text-cancelado" },
};

function mensagem(e: unknown) {
  const texto = e instanceof Error ? e.message : String(e ?? "");
  return texto.slice(0, 300) || "Falha desconhecida na impressora.";
}

function descrever(t: Linha) {
  if (t.tipo === "CONTA") return `Conta · Mesa ${t.comandas?.mesas?.numero ?? "?"}`;
  if (!t.pedidos) return "Pedido apagado";
  return `Pedido ${numeroPedido(t.pedidos.numero_dia)} · ${rotuloPedido(t.pedidos)}`;
}

export function EstacaoImpressao({
  restaurante,
  inicial,
}: {
  restaurante: ConfigRestaurante;
  inicial: ConfigImpressoras;
}) {
  const supabase = useMemo(() => criarClienteNavegador(), []);

  const [cfg, setCfg] = useState(inicial);
  const [qz, setQz] = useState<EstadoQz>("procurando");
  const [impressoras, setImpressoras] = useState<string[]>([]);
  const [silenciosa, setSilenciosa] = useState<boolean | null>(null);
  const [fila, setFila] = useState<Linha[]>([]);
  const [aviso, setAviso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, iniciar] = useTransition();

  // Refs: o laço de impressão roda fora do ciclo do React e precisa do valor atual.
  const cfgAtual = useRef(cfg);
  const qzAtual = useRef<EstadoQz>("procurando");
  const trabalhando = useRef(false);
  const chamarDeNovo = useRef(false);

  useEffect(() => {
    cfgAtual.current = cfg;
  }, [cfg]);

  const carregarFila = useCallback(async () => {
    const { data } = await supabase
      .from("fila_impressao")
      .select("*, pedidos(numero_dia, tipo, mesas(numero)), comandas(mesas(numero))")
      .order("criado_em", { ascending: false })
      .limit(30);
    setFila((data ?? []) as Linha[]);
  }, [supabase]);

  const montar = useCallback(
    async (t: TrabalhoImpressao): Promise<string> => {
      if (t.tipo === "PEDIDO") {
        const { data, error } = await supabase
          .from("pedidos")
          .select("*, mesas(numero), itens_pedido(*, item_adicionais(*))")
          .eq("id", t.pedido_id)
          .order("id", { referencedTable: "itens_pedido" })
          .single();
        if (error || !data) throw new Error("O pedido não foi encontrado.");
        return viaPedido(data as Pedido, restaurante, cfgAtual.current);
      }

      const { data, error } = await supabase
        .from("comandas")
        .select("*, mesas(numero), pedidos(*, itens_pedido(*, item_adicionais(*))), pagamentos(*)")
        .eq("id", t.comanda_id)
        .single();
      if (error || !data) throw new Error("A conta não foi encontrada.");
      return viaConta(data as Comanda, restaurante, cfgAtual.current);
    },
    [supabase, restaurante],
  );

  const processar = useCallback(async () => {
    if (trabalhando.current) {
      chamarDeNovo.current = true;
      return;
    }
    trabalhando.current = true;

    try {
      do {
        chamarDeNovo.current = false;
        if (qzAtual.current !== "ligado" || !cfgAtual.current.impressora) break;

        for (let volta = 0; volta < 50; volta++) {
          const { data: proximo } = await supabase
            .from("fila_impressao")
            .select("*")
            .eq("status", "PENDENTE")
            .order("criado_em")
            .limit(1)
            .maybeSingle();
          if (!proximo) break;

          const { data: pego } = await supabase
            .from("fila_impressao")
            .update({
              status: "IMPRIMINDO",
              tentativas: proximo.tentativas + 1,
              atualizado_em: new Date().toISOString(),
            })
            .eq("id", proximo.id)
            .eq("status", "PENDENTE")
            .select("id")
            .maybeSingle();
          if (!pego) continue; // outro computador pegou primeiro

          try {
            const base64 = await montar(proximo as TrabalhoImpressao);
            await imprimirCru(cfgAtual.current.impressora, base64, cfgAtual.current.vias);
            await supabase
              .from("fila_impressao")
              .update({ status: "IMPRESSO", erro: null, atualizado_em: new Date().toISOString() })
              .eq("id", proximo.id);
          } catch (e) {
            if (e instanceof ImpressoraIndisponivel) {
              // O QZ fechou: o cupom volta pra fila e sai quando ele voltar.
              await supabase
                .from("fila_impressao")
                .update({ status: "PENDENTE", atualizado_em: new Date().toISOString() })
                .eq("id", proximo.id);
              qzAtual.current = "desligado";
              setQz("desligado");
              break;
            }
            await supabase
              .from("fila_impressao")
              .update({ status: "ERRO", erro: mensagem(e), atualizado_em: new Date().toISOString() })
              .eq("id", proximo.id);
          }
        }
      } while (chamarDeNovo.current);
    } finally {
      trabalhando.current = false;
      void carregarFila();
    }
  }, [supabase, montar, carregarFila]);

  const ligarQz = useCallback(
    async (silencioso = false) => {
      if (!silencioso) {
        qzAtual.current = "procurando";
        setQz("procurando");
      }
      try {
        await conectar();
        setImpressoras(await listarImpressoras());
        qzAtual.current = "ligado";
        setQz("ligado");
        void processar();
      } catch {
        qzAtual.current = "desligado";
        setQz("desligado");
      }
    },
    [processar],
  );

  useEffect(() => {
    void carregarFila();
    void ligarQz();

    fetch("/api/qz/certificado", { cache: "no-store" })
      .then((r) => setSilenciosa(r.ok))
      .catch(() => setSilenciosa(false));

    // Cupom que ficou "imprimindo" com a aba fechada no meio: não dá pra
    // saber se saiu. Vira erro, pra alguém conferir antes de mandar de novo.
    const doisMinutosAtras = new Date(Date.now() - 120_000).toISOString();
    void supabase
      .from("fila_impressao")
      .update({ status: "ERRO", erro: "Interrompido no meio. Confira se saiu antes de mandar de novo." })
      .eq("status", "IMPRIMINDO")
      .lt("atualizado_em", doisMinutosAtras)
      .then(() => carregarFila());

    const canal = supabase
      .channel(`estacao-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "fila_impressao" }, () => {
        void processar();
        void carregarFila();
      })
      .subscribe();

    const relogio = setInterval(() => {
      if (qzAtual.current === "desligado") void ligarQz(true);
      else void processar();
    }, 15000);

    return () => {
      clearInterval(relogio);
      void supabase.removeChannel(canal);
    };
  }, [supabase, carregarFila, ligarQz, processar]);

  function escolherImpressora(nome: string) {
    const novo = { ...cfg, impressora: nome };
    setCfg(novo);
    cfgAtual.current = novo;
    setErro(null);
    setAviso(null);
    iniciar(async () => {
      const r = await salvarImpressoras(novo);
      if (!r.ok) return setErro(r.erro);
      setAviso(`Impressora "${nome}" escolhida.`);
      void processar();
    });
  }

  async function testar() {
    setErro(null);
    setAviso(null);
    try {
      await imprimirCru(cfg.impressora, cupomDeTeste(restaurante, cfg), 1);
      setAviso("Teste enviado. Saiu papel?");
    } catch (e) {
      setErro(mensagem(e));
    }
  }

  async function mandarDeNovo(id: number) {
    await supabase
      .from("fila_impressao")
      .update({ status: "PENDENTE", erro: null, atualizado_em: new Date().toISOString() })
      .eq("id", id);
    void carregarFila();
  }

  const naFila = fila.filter((t) => t.status === "PENDENTE").length;

  return (
    <div className="p-4 lg:p-8">
      <Cabecalho
        fita="Balcão"
        titulo="Impressão"
        descricao="Deixe esta tela aberta no computador da impressora. Todo pedido aprovado sai aqui sozinho — pode minimizar, só não feche a aba."
      />

      <div className="mb-6 grid gap-3 md:grid-cols-3">
        {/* QZ Tray */}
        <div
          className={
            "rounded-2xl border p-4 " +
            (qz === "ligado"
              ? "border-pronto/40 bg-pronto/5"
              : qz === "desligado"
                ? "border-cancelado/40 bg-cancelado/5"
                : "border-borda bg-carvao")
          }
        >
          <p className="text-xs uppercase tracking-wide text-creme-fraco">QZ Tray</p>
          <p
            className={
              "mt-1 font-display text-lg font-bold " +
              (qz === "ligado" ? "text-pronto" : qz === "desligado" ? "text-cancelado" : "text-creme")
            }
          >
            {qz === "ligado" ? "Conectado" : qz === "desligado" ? "Não encontrado" : "Procurando…"}
          </p>
          {qz === "desligado" && (
            <p className="mt-1 text-xs text-creme-suave">
              Abra o QZ Tray na bandeja do Windows. Não tem?{" "}
              <a href="https://qz.io/download/" target="_blank" rel="noreferrer" className="underline">
                Baixar
              </a>
              . A tela tenta de novo sozinha a cada 15 segundos.
            </p>
          )}
          {qz !== "procurando" && (
            <button type="button" onClick={() => void ligarQz()} className="mt-2 text-xs text-ouro underline">
              Procurar de novo
            </button>
          )}
        </div>

        {/* impressora */}
        <div
          className={
            "rounded-2xl border p-4 " +
            (cfg.impressora ? "border-borda bg-carvao" : "border-ouro/50 bg-ouro/5")
          }
        >
          <label className="text-xs uppercase tracking-wide text-creme-fraco" htmlFor="impressora">
            Impressora
          </label>
          {impressoras.length > 0 ? (
            <select
              id="impressora"
              className="campo mt-1"
              value={cfg.impressora}
              onChange={(e) => escolherImpressora(e.target.value)}
              disabled={salvando}
            >
              <option value="">Escolha a impressora…</option>
              {cfg.impressora && !impressoras.includes(cfg.impressora) && (
                <option value={cfg.impressora}>{cfg.impressora} (não encontrada)</option>
              )}
              {impressoras.map((i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </select>
          ) : (
            <p className="mt-1 font-display text-lg font-bold">
              {cfg.impressora || "Nenhuma escolhida"}
            </p>
          )}
          <button
            type="button"
            className="btn btn-quieto mt-2 w-full py-2 text-xs"
            onClick={testar}
            disabled={qz !== "ligado" || !cfg.impressora}
          >
            Imprimir um teste
          </button>
        </div>

        {/* assinatura */}
        <div
          className={
            "rounded-2xl border p-4 " +
            (silenciosa === false ? "border-ouro/50 bg-ouro/5" : "border-borda bg-carvao")
          }
        >
          <p className="text-xs uppercase tracking-wide text-creme-fraco">Impressão automática</p>
          <p className="mt-1 font-display text-lg font-bold">
            {silenciosa === null ? "Conferindo…" : silenciosa ? "Sem perguntar ✓" : "Vai pedir permissão"}
          </p>
          <p className="mt-1 text-xs text-creme-suave">
            {silenciosa
              ? "O certificado está no servidor. Se o QZ ainda perguntar, falta instalar o override.crt neste PC."
              : "Falta a chave do certificado no servidor: o QZ vai perguntar “permitir?” a cada cupom."}
          </p>
        </div>
      </div>

      {aviso && (
        <p className="mb-4 rounded-xl border border-pronto/40 bg-pronto/10 px-4 py-3 text-sm text-pronto">
          {aviso}
        </p>
      )}
      {erro && (
        <p role="alert" className="mb-4 rounded-xl border border-cancelado/40 bg-cancelado/10 px-4 py-3 text-sm text-cancelado">
          {erro}
        </p>
      )}

      <section>
        <h2 className="mb-3 font-display text-sm font-bold uppercase tracking-[0.14em] text-creme-suave">
          Últimos cupons {naFila > 0 && <span className="text-ouro">· {naFila} na fila</span>}
        </h2>

        {fila.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-borda px-4 py-10 text-center text-sm text-creme-fraco">
            Nenhum cupom ainda. Quando um pedido for aprovado, ele aparece aqui e sai na impressora.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-borda">
            <table className="w-full min-w-[36rem] text-sm">
              <thead className="bg-carvao text-left text-xs uppercase tracking-wide text-creme-suave">
                <tr>
                  <th className="px-4 py-3 font-semibold">Hora</th>
                  <th className="px-4 py-3 font-semibold">Cupom</th>
                  <th className="px-4 py-3 font-semibold">Situação</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {fila.map((t) => (
                  <tr key={t.id} className="border-t border-borda/60 align-top">
                    <td className="tabular px-4 py-3 text-creme-suave">{hora(t.criado_em)}</td>
                    <td className="px-4 py-3 font-medium">{descrever(t)}</td>
                    <td className="px-4 py-3">
                      <span className={"rounded-full px-2.5 py-1 text-xs font-semibold " + SITUACAO[t.status].cor}>
                        {SITUACAO[t.status].texto}
                      </span>
                      {t.erro && <p className="mt-1 max-w-xs text-xs text-cancelado">{t.erro}</p>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      {(t.status === "ERRO" || t.status === "IMPRESSO") && (
                        <button
                          type="button"
                          onClick={() => void mandarDeNovo(t.id)}
                          className="text-xs text-creme-suave underline hover:text-ouro"
                        >
                          Imprimir de novo
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
