export type Papel = "dono" | "atendente" | "cozinha";

export type StatusPedido =
  | "AGUARDANDO" // cliente pediu pelo QR; o atendente ainda não aprovou
  | "PENDENTE"
  | "EM PREPARO"
  | "PRONTO"
  | "SAIU PARA ENTREGA"
  | "CONCLUIDO"
  | "CANCELADO";

export type FormaPagamento =
  | "Dinheiro"
  | "Pix"
  | "Cartao Credito"
  | "Cartao Debito";

/** MESA vai pra conta aberta da mesa; ENTREGA e RETIRADA pagam no pedido. */
export type TipoPedido = "MESA" | "ENTREGA" | "RETIRADA";

/** EQUIPE = lançado no sistema; CLIENTE = feito pelo QR da mesa. */
export type OrigemPedido = "EQUIPE" | "CLIENTE";

export interface Perfil {
  id: string;
  nome: string;
  papel: Papel;
  ativo: boolean;
}

export interface Categoria {
  id: number;
  nome: string;
  /** Aparece ao lado do nome no cardápio: "de 8 fatias". */
  descricao: string | null;
  ordem: number;
  ativo: boolean;
  /** Pizza: os produtos desta categoria podem sair meia a meia. */
  meio_a_meio?: boolean;
}

export interface Variacao {
  id: number;
  produto_id: number;
  nome: string;
  preco: number;
  ordem: number;
}

export interface Adicional {
  id: number;
  nome: string;
  preco: number;
  ativo: boolean;
  /** Seção na tela. Sem seção, tudo cai num bloco chamado "Adicionais". */
  grupo: string | null;
  ordem: number;
}

export interface Produto {
  id: number;
  categoria_id: number | null;
  nome: string;
  descricao: string | null;
  /** Pizza: em quantos pedacos ela vem cortada. Null no que nao se fatia. */
  fatias?: number | null;
  foto_url: string | null;
  preco_base: number;
  custo?: number | null;
  ativo: boolean;
  disponivel: boolean;
  ordem: number;
  produto_variacoes?: Variacao[];
  produto_adicionais?: { adicional_id: number; preco: number | null }[];
}

export interface Bairro {
  id: number;
  nome: string;
  taxa: number;
  ativo: boolean;
}

export interface Cliente {
  id: number;
  nome: string;
  telefone: string | null;
  endereco: string | null;
  numero: string | null;
  bairro_id: number | null;
  referencia: string | null;
  observacao: string | null;
}

export interface Caixa {
  id: number;
  usuario_id: string | null;
  aberto_em: string;
  fechado_em: string | null;
  valor_abertura: number;
  valor_fechamento: number | null;
  observacao: string | null;
  status: "ABERTO" | "FECHADO";
}

export interface Mesa {
  id: number;
  numero: number;
  /** Vai no link do QR code. Trocar o código invalida o QR impresso. */
  codigo: string;
  ativo: boolean;
}

export type StatusComanda = "ABERTA" | "FECHADA" | "CANCELADA";

export interface Pagamento {
  id: number;
  comanda_id: number;
  caixa_id: number | null;
  forma: FormaPagamento;
  valor: number;
  criado_em: string;
}

/** A conta de uma mesa. `total` é calculado no banco: só pedidos aprovados. */
export interface Comanda {
  id: number;
  mesa_id: number;
  caixa_id: number | null;
  status: StatusComanda;
  total: number;
  desconto: number;
  aberta_em: string;
  fechada_em: string | null;
  fechada_por: string | null;
  mesas?: { numero: number } | null;
  pedidos?: Pedido[];
  pagamentos?: Pagamento[];
}

export interface ItemAdicional {
  id: number;
  item_id: number;
  adicional_id: number | null;
  nome: string;
  preco: number;
  quantidade: number;
}

export interface ItemPedido {
  id: number;
  pedido_id: number;
  produto_id: number | null;
  variacao_id: number | null;
  produto_nome: string;
  variacao_nome: string | null;
  quantidade: number;
  preco_unitario: number;
  observacao: string | null;
  item_adicionais?: ItemAdicional[];
}

export interface Pedido {
  id: number;
  numero_dia: number | null;
  caixa_id: number | null;
  usuario_id: string | null;
  origem: OrigemPedido;
  tipo: TipoPedido;
  mesa_id: number | null;
  comanda_id: number | null;
  cliente_id: number | null;
  cliente_nome: string;
  cliente_telefone: string | null;
  endereco_entrega: string | null;
  taxa_entrega: number;
  subtotal: number;
  desconto: number;
  total: number;
  forma_pagamento: FormaPagamento | null;
  troco_para: number | null;
  status: StatusPedido;
  motivo_recusa: string | null;
  aprovado_por: string | null;
  aprovado_em: string | null;
  observacao: string | null;
  criado_em: string;
  atualizado_em: string;
  mesas?: { numero: number } | null;
  itens_pedido?: ItemPedido[];
}

export type StatusImpressao = "PENDENTE" | "IMPRIMINDO" | "IMPRESSO" | "ERRO";

/** Um cupom esperando a impressora do balcão. */
export interface TrabalhoImpressao {
  id: number;
  tipo: "PEDIDO" | "CONTA";
  pedido_id: number | null;
  comanda_id: number | null;
  status: StatusImpressao;
  erro: string | null;
  tentativas: number;
  criado_em: string;
  atualizado_em: string;
}

/** Item ainda no carrinho, antes de virar pedido no banco. */
export interface ItemCarrinho {
  chave: string; // id local, so pra lista do React
  produto_id: number;
  produto_nome: string;
  variacao_id: number | null;
  variacao_nome: string | null;
  /** Meia a meia: o sabor da outra metade. Null = pizza inteira. */
  segundo_produto_id?: number | null;
  preco_unitario: number; // produto ou variacao, sem adicionais
  quantidade: number;
  observacao: string;
  adicionais: { adicional_id: number; nome: string; preco: number }[];
}

export interface ConfigRestaurante {
  nome: string;
  slogan: string;
  endereco: string;
  telefone: string;
  whatsapp: string;
  instagram: string;
  horario: string;
}

/** Uma impressora só, no PC do balcão, recebe todos os cupons. */
export interface ConfigImpressoras {
  impressora: string;
  colunas: number;
  cortar: boolean;
  abrir_gaveta: boolean;
  vias: number;
  /** Via da cozinha: o que montar, em letra grande e sem nenhum preço. */
  via_cozinha: boolean;
  /** Via do caixa: a mesma coisa com preço, total e forma de pagamento. */
  via_caixa: boolean;
}
