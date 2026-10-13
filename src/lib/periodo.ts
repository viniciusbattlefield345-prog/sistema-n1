/**
 * O intervalo de dias que as telas de histórico mostram.
 *
 * Mora num arquivo só porque Pedidos e Relatórios têm que concordar: o
 * "ontem" de uma precisa ser o mesmo "ontem" da outra, senão o dono compara
 * dois números que não falam do mesmo intervalo e um deles está mentindo.
 *
 * O fuso é fixo em -03:00. São Paulo não tem mais horário de verão desde
 * 2019, e o servidor da Vercel roda em UTC: sem isso, tudo que acontece entre
 * 21h e meia-noite cairia no dia seguinte do relatório.
 */

const FUSO = "-03:00";

/** Períodos de um toque. A chave é o que vai na URL (?p=hoje). */
export const PRESETS = {
  hoje: "Hoje",
  ontem: "Ontem",
  "7": "7 dias",
  "30": "30 dias",
  mes: "Este mês",
} as const;

export type Preset = keyof typeof PRESETS;

/** Teto de segurança: um pedido de 10 anos de dados derruba a cota do banco. */
const MAX_DIAS = 366;

/** Acima disso o gráfico por dia fica ilegível e caro — a tela nem desenha. */
export const MAX_DIAS_GRAFICO = 92;

const DIA = /^\d{4}-\d{2}-\d{2}$/;

/** O dia de hoje em São Paulo, como "2026-10-13". */
export function hojeSp(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(
    new Date(),
  );
}

/** Soma (ou subtrai) dias numa data "2026-10-13". Meio-dia pra não tropeçar em fuso. */
export function somarDias(dia: string, n: number): string {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Quantos dias de um até o outro, contando os dois. */
export function contarDias(de: string, ate: string): number {
  const a = Date.parse(`${de}T12:00:00Z`);
  const b = Date.parse(`${ate}T12:00:00Z`);
  return Math.round((b - a) / 86400000) + 1;
}

/** Primeiro instante do dia, em ISO — pra comparar com criado_em. */
export const inicioIso = (dia: string) => new Date(`${dia}T00:00:00${FUSO}`).toISOString();

/**
 * Primeiro instante do dia SEGUINTE. O fim do período é exclusivo (`lt`, não
 * `lte`): com "23:59:59" perderíamos o pedido lançado às 23:59:59.400.
 */
export const fimIso = (dia: string) => inicioIso(somarDias(dia, 1));

/** "2026-10-13" -> "13/10" */
export const diaCurto = (dia: string) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;

/** "2026-10-13" -> "13/10/2026" */
export const diaLongo = (dia: string) => `${diaCurto(dia)}/${dia.slice(0, 4)}`;

/**
 * Em que dia e em que hora de São Paulo aconteceu um instante do banco.
 *
 * Os formatadores nascem uma vez: criar um Intl por linha deixa o relatório
 * de 30 dias visivelmente lento.
 */
const FMT_DIA = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" });
const FMT_HORA = new Intl.DateTimeFormat("en-GB", {
  timeZone: "America/Sao_Paulo",
  hour: "2-digit",
  hourCycle: "h23",
});

/** "2026-10-13T01:40:00Z" -> "2026-10-12" (ainda era a noite de sexta aqui). */
export const diaSp = (iso: string) => FMT_DIA.format(new Date(iso));

/** A hora cheia, 0 a 23. */
export const horaSp = (iso: string) => Number(FMT_HORA.format(new Date(iso)));

export interface Periodo {
  /** Primeiro dia, "2026-10-13". */
  de: string;
  /** Último dia, incluído. */
  ate: string;
  /** Qual botão está aceso, ou null quando o dono digitou as datas. */
  preset: Preset | null;
  /** Como a tela chama esse intervalo. */
  rotulo: string;
  /** Os dias, um por um — vazio quando o intervalo é grande demais pra desenhar. */
  dias: string[];
  /** O intervalo de mesmo tamanho imediatamente antes, pra comparar. */
  anterior: { de: string; ate: string };
}

type Param = string | string[] | undefined;

const um = (v: Param) => (Array.isArray(v) ? v[0] : v);

function doPreset(preset: Preset): { de: string; ate: string } {
  const hoje = hojeSp();
  switch (preset) {
    case "hoje":
      return { de: hoje, ate: hoje };
    case "ontem": {
      const ontem = somarDias(hoje, -1);
      return { de: ontem, ate: ontem };
    }
    case "7":
      return { de: somarDias(hoje, -6), ate: hoje };
    case "30":
      return { de: somarDias(hoje, -29), ate: hoje };
    case "mes":
      return { de: `${hoje.slice(0, 7)}-01`, ate: hoje };
  }
}

/**
 * Lê o período da URL. Nada na URL, ou coisa sem sentido nela, cai no padrão
 * da tela — ninguém vê erro de "data inválida" por ter digitado torto.
 */
export function lerPeriodo(
  params: { p?: Param; de?: Param; ate?: Param },
  padrao: Preset = "hoje",
): Periodo {
  const pedido = um(params.p);
  const deBruto = um(params.de);
  const ateBruto = um(params.ate);

  let preset: Preset | null = null;
  let de: string;
  let ate: string;

  if (DIA.test(deBruto ?? "") || DIA.test(ateBruto ?? "")) {
    // Uma data só: o período é aquele dia.
    de = DIA.test(deBruto ?? "") ? deBruto! : ateBruto!;
    ate = DIA.test(ateBruto ?? "") ? ateBruto! : de;
    if (de > ate) [de, ate] = [ate, de]; // digitou ao contrário
    if (contarDias(de, ate) > MAX_DIAS) de = somarDias(ate, -(MAX_DIAS - 1));
  } else {
    preset = pedido && pedido in PRESETS ? (pedido as Preset) : padrao;
    ({ de, ate } = doPreset(preset));
  }

  const total = contarDias(de, ate);
  const dias: string[] = [];
  if (total <= MAX_DIAS_GRAFICO) {
    for (let i = 0; i < total; i++) dias.push(somarDias(de, i));
  }

  return {
    de,
    ate,
    preset,
    rotulo: rotular(preset, de, ate),
    dias,
    anterior: { de: somarDias(de, -total), ate: somarDias(de, -1) },
  };
}

function rotular(preset: Preset | null, de: string, ate: string): string {
  if (preset === "hoje") return "Hoje";
  if (preset === "ontem") return "Ontem";
  if (preset === "7") return "Últimos 7 dias";
  if (preset === "30") return "Últimos 30 dias";
  if (preset === "mes") return "Este mês";
  return de === ate ? diaLongo(de) : `${diaCurto(de)} a ${diaLongo(ate)}`;
}

/** O que vai na URL pra reabrir este mesmo período. */
export const buscaDoPeriodo = (p: Periodo) =>
  p.preset ? `p=${p.preset}` : `de=${p.de}&ate=${p.ate}`;
