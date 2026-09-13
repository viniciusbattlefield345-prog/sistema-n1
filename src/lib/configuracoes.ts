import type { ConfigImpressoras, ConfigRestaurante } from "./tipos";

export const RESTAURANTE_PADRAO: ConfigRestaurante = {
  nome: "GENERAL BURGUER",
  slogan: "",
  endereco: "",
  telefone: "",
  whatsapp: "",
  instagram: "",
  horario: "",
};

export const IMPRESSORAS_PADRAO: ConfigImpressoras = {
  impressora: "",
  colunas: 48,
  cortar: true,
  abrir_gaveta: false,
  vias: 1,
  via_cozinha: true,
  via_caixa: true,
};

/**
 * Junta o que está gravado em `configuracoes` com o padrão: uma chave que
 * falte no banco não derruba a tela nem o cupom.
 */
export function lerConfiguracoes(
  linhas: { chave: string; valor: unknown }[] | null | undefined,
) {
  const mapa = new Map((linhas ?? []).map((l) => [l.chave, l.valor]));
  return {
    restaurante: {
      ...RESTAURANTE_PADRAO,
      ...((mapa.get("restaurante") ?? {}) as Partial<ConfigRestaurante>),
    },
    impressoras: {
      ...IMPRESSORAS_PADRAO,
      ...((mapa.get("impressoras") ?? {}) as Partial<ConfigImpressoras>),
    },
  };
}
