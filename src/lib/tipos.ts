export type Papel = "dono" | "atendente" | "cozinha";

export type StatusPedido =
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

export type TipoEntrega = "ENTREGA" | "RETIRADA";

export interface Perfil {
  id: string;
  nome: string;
  papel: Papel;
  ativo: boolean;
}

export interface Categoria {
  id: number;
  nome: string;
  ordem: number;
  ativo: boolean;
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
  /** Secao na tela: "Acompanhamentos", "Carnes", "Saladas e fritos". */
  grupo: string | null;
  ordem: number;
}

export interface Produto {
  id: number;
  categoria_id: number | null;
  nome: string;
  descricao: string | null;
  preco_base: number;
  custo: number | null;
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
  cliente_id: number | null;
  cliente_nome: string;
  cliente_telefone: string | null;
  tipo_entrega: TipoEntrega;
  endereco_entrega: string | null;
  taxa_entrega: number;
  subtotal: number;
  desconto: number;
  total: number;
  forma_pagamento: FormaPagamento | null;
  troco_para: number | null;
  status: StatusPedido;
  observacao: string | null;
  criado_em: string;
  atualizado_em: string;
  itens_pedido?: ItemPedido[];
}

/** Item ainda no carrinho, antes de virar pedido no banco. */
export interface ItemCarrinho {
  chave: string; // id local, so pra lista do React
  produto_id: number;
  produto_nome: string;
  variacao_id: number | null;
  variacao_nome: string | null;
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

export interface ConfigImpressoras {
  cozinha: string;
  entrega: string;
  colunas: number;
  cortar: boolean;
  abrir_gaveta: boolean;
  vias_cozinha: number;
  vias_entrega: number;
}
