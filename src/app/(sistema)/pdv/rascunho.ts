import type { FormaPagamento, ItemCarrinho, TipoEntrega } from "@/lib/tipos";

/**
 * Rascunho do pedido guardado no navegador.
 *
 * O carrinho é estado de tela: sai do PDV, fecha a aba ou o navegador cai,
 * e o pedido some. No meio do almoço isso é perder a venda e ter que
 * perguntar tudo de novo ao cliente. Aqui ele sobrevive.
 *
 * Preço não é guardado como verdade: quem calcula o valor final é o
 * servidor, relendo o cardápio na hora de salvar.
 */
const CHAVE = "n1:rascunho-pedido";

export interface Rascunho {
  itens: ItemCarrinho[];
  tipo: TipoEntrega;
  clienteId: number | null;
  nomeAvulso: string;
  forma: FormaPagamento;
  trocoTexto: string;
}

export function lerRascunho(): Rascunho | null {
  try {
    const bruto = localStorage.getItem(CHAVE);
    if (!bruto) return null;
    const r = JSON.parse(bruto) as Rascunho;
    // Rascunho sem item não vale a pena restaurar.
    if (!Array.isArray(r.itens) || r.itens.length === 0) return null;
    return r;
  } catch {
    return null; // json corrompido ou navegador sem armazenamento
  }
}

export function gravarRascunho(r: Rascunho): void {
  try {
    if (r.itens.length === 0) {
      localStorage.removeItem(CHAVE);
      return;
    }
    localStorage.setItem(CHAVE, JSON.stringify(r));
  } catch {
    // sem armazenamento: o PDV continua funcionando, só não lembra
  }
}

export function limparRascunho(): void {
  try {
    localStorage.removeItem(CHAVE);
  } catch {
    // idem
  }
}
