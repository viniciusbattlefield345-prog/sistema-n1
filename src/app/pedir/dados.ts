import type { TipoPedido } from "@/lib/tipos";

/** Bairro que a loja realmente atende: só os ativos chegam até aqui. */
export interface BairroAtendido {
  id: number;
  nome: string;
  taxa: number;
}

/**
 * O que o cliente diz sobre si antes de ver o cardápio. Fica guardado no
 * celular dele e é reenviado a cada pedido — o servidor confere tudo de novo.
 */
export interface DadosCliente {
  tipo: TipoPedido;
  telefone: string;
  nome: string;
  endereco: string;
  numero: string;
  bairro_id: number | null;
  referencia: string;
}

export const CLIENTE_VAZIO: DadosCliente = {
  tipo: "ENTREGA",
  telefone: "",
  nome: "",
  endereco: "",
  numero: "",
  bairro_id: null,
  referencia: "",
};

export const NOME_MINIMO = 2;
export const TELEFONE_MINIMO = 10;

export function soDigitos(valor: string): string {
  return valor.replace(/\D/g, "").slice(0, 11);
}

/** Dá pra mandar esse pedido? A mesma régua do servidor, só que antes. */
export function dadosServem(d: DadosCliente): boolean {
  if (d.nome.trim().length < NOME_MINIMO) return false;
  if (soDigitos(d.telefone).length < TELEFONE_MINIMO) return false;
  if (d.tipo === "RETIRADA") return true;
  return d.endereco.trim().length > 0 && d.bairro_id !== null;
}
