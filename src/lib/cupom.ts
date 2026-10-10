import { Cupom } from "./escpos";
import {
  extraComVezes,
  hora,
  nomePagamento,
  numero,
  numeroPedido,
  rotuloPedido,
  telefone,
} from "./formato";
import type {
  Comanda,
  ConfigImpressoras,
  ConfigRestaurante,
  ItemPedido,
  Pedido,
} from "./tipos";

const dia = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

function valorDoItem(item: ItemPedido): number {
  const extras = (item.item_adicionais ?? []).reduce(
    (s, e) => s + Number(e.preco) * e.quantidade,
    0,
  );
  return Number(item.quantidade) * (Number(item.preco_unitario) + extras);
}

function cabecalho(c: Cupom, restaurante: ConfigRestaurante) {
  c.titulo(restaurante.nome || "GENERAL BURGUER");
  c.alinhar(1);
  for (const linha of [restaurante.slogan, restaurante.endereco, restaurante.telefone]) {
    if (linha) c.linha(linha);
  }
  c.alinhar(0);
}

function listaDeItens(c: Cupom, itens: ItemPedido[]) {
  for (const item of itens) {
    const descricao = item.variacao_nome
      ? `${item.produto_nome} (${item.variacao_nome})`
      : item.produto_nome;
    c.negrito(true).item(Number(item.quantidade), descricao, numero(valorDoItem(item)));
    c.negrito(false);
    for (const extra of item.item_adicionais ?? []) c.detalhe("+ " + extraComVezes(extra));
    if (item.observacao) {
      c.negrito(true).detalhe(`>> ${item.observacao.toUpperCase()}`).negrito(false);
    }
  }
}

function totalGrande(c: Cupom, rotulo: string, valor: number) {
  c.pular().tamanho(2).negrito(true).doisLados(rotulo, numero(valor));
  c.tamanho(1).negrito(false);
}

/** Só o que a cozinha precisa: quantidade, produto, adicional e observação. */
function listaDeItensCozinha(c: Cupom, itens: ItemPedido[]) {
  for (const item of itens) {
    const descricao = item.variacao_nome
      ? `${item.produto_nome} (${item.variacao_nome})`
      : item.produto_nome;
    c.tamanho(2).negrito(true).item(Number(item.quantidade), descricao.toUpperCase(), "");
    c.tamanho(1).negrito(false);
    for (const extra of item.item_adicionais ?? []) c.detalhe("+ " + extraComVezes(extra));
    if (item.observacao) {
      c.negrito(true).detalhe(`>> ${item.observacao.toUpperCase()}`).negrito(false);
    }
  }
}

/**
 * A via da cozinha: nenhum preço. Quem está na chapa não precisa saber quanto
 * custa — precisa enxergar o que montar de longe, com a mão ocupada. Por isso
 * o item vai em letra dobrada e o resto é enxuto.
 */
/**
 * O que a chapa tem a fazer deste pedido. Bebida fica de fora: ela sai da
 * geladeira, e um papel a mais na cozinha e um papel que atrapalha.
 *
 * Item antigo, gravado antes desta regra existir, vem sem o campo e conta
 * como cozinha — era assim que ele era impresso quando foi feito.
 */
function itensDaCozinha(pedido: Pedido): ItemPedido[] {
  return (pedido.itens_pedido ?? []).filter((i) => i.vai_pra_cozinha !== false);
}

function corpoCozinha(c: Cupom, pedido: Pedido) {
  c.alinhar(1).negrito(true).tamanho(2).linha("COZINHA");
  c.tamanho(3).linha(rotuloPedido(pedido).toUpperCase());
  c.tamanho(2).linha(`PEDIDO ${numeroPedido(pedido.numero_dia)}`);
  c.tamanho(1).negrito(false).linha(hora(pedido.criado_em));
  c.alinhar(0).separador("=");

  listaDeItensCozinha(c, itensDaCozinha(pedido));

  if (pedido.observacao) {
    c.separador();
    c.negrito(true).linha("OBSERVACAO DO PEDIDO:").negrito(false);
    c.detalhe(pedido.observacao, 0);
  }
  c.separador("=");
}

/**
 * A via do caixa: a mesma comanda com preço, total e forma de pagamento.
 * É a que acompanha o lanche até a mesa ou a sacola.
 * A mesa sai em letra gigante: é a primeira coisa que alguém procura no papel.
 */
function corpoCaixa(c: Cupom, pedido: Pedido, restaurante: ConfigRestaurante) {
  const rotulo = rotuloPedido(pedido);

  cabecalho(c, restaurante);
  c.separador("=");

  c.alinhar(1).negrito(true).tamanho(3).linha(rotulo.toUpperCase());
  c.tamanho(2).linha(`PEDIDO ${numeroPedido(pedido.numero_dia)}`);
  c.tamanho(1).negrito(false);
  c.linha(`${dia(pedido.criado_em)} ${hora(pedido.criado_em)}`);
  if (pedido.origem === "CLIENTE") c.linha("Feito pelo cliente no QR da mesa");
  c.alinhar(0).separador();

  // Pedido de mesa sem nome ganha "Mesa 5" como nome: repetir seria ruído.
  const nomeProprio = pedido.cliente_nome && pedido.cliente_nome !== rotulo;
  if (nomeProprio) c.negrito(true).linha(pedido.cliente_nome.toUpperCase()).negrito(false);
  if (pedido.cliente_telefone) c.linha(telefone(pedido.cliente_telefone));
  if (pedido.tipo === "ENTREGA") {
    c.negrito(true).linha("ENTREGAR EM").negrito(false);
    c.detalhe(pedido.endereco_entrega ?? "", 0);
  }
  if (nomeProprio || pedido.cliente_telefone || pedido.tipo === "ENTREGA") c.separador();

  listaDeItens(c, pedido.itens_pedido ?? []);

  if (pedido.observacao) {
    c.separador();
    c.negrito(true).linha("OBSERVACAO DO PEDIDO:").negrito(false);
    c.detalhe(pedido.observacao, 0);
  }

  c.separador();
  const taxa = Number(pedido.taxa_entrega);
  const desconto = Number(pedido.desconto);
  if (taxa > 0 || desconto > 0) c.doisLados("Subtotal", numero(Number(pedido.subtotal)));
  if (taxa > 0) c.doisLados("Taxa de entrega", numero(taxa));
  if (desconto > 0) c.doisLados("Desconto", "-" + numero(desconto));
  totalGrande(c, "TOTAL", Number(pedido.total));

  if (pedido.tipo === "MESA") {
    c.alinhar(1).linha("Entra na conta da mesa").alinhar(0);
  } else {
    c.separador();
    const forma = pedido.forma_pagamento ? nomePagamento(pedido.forma_pagamento) : "-";
    c.negrito(true).linha(`PAGAMENTO: ${forma}`).negrito(false);
    if (pedido.forma_pagamento === "Dinheiro" && Number(pedido.troco_para) > 0) {
      c.doisLados("Troco para", numero(Number(pedido.troco_para)));
      totalGrande(c, "TROCO", Math.max(Number(pedido.troco_para) - Number(pedido.total), 0));
    }
  }

  c.separador("=");
}

/**
 * O cupom de um pedido aprovado. Sai em duas vias num envio só — a da cozinha
 * e a do caixa — separadas pela guilhotina. Quem quiser uma só desliga a
 * outra em Configurações.
 */
export function viaPedido(
  pedido: Pedido,
  restaurante: ConfigRestaurante,
  cfg: ConfigImpressoras,
): string {
  const c = new Cupom(cfg.colunas);
  // Desligar as duas seria papel em branco: sobra a do caixa, que tem o total.
  const caixa = cfg.via_caixa || !cfg.via_cozinha;
  const temCozinha = itensDaCozinha(pedido).length > 0;

  /**
   * Pedido so de bebida, com a via do caixa desligada: nao ha o que imprimir.
   * Devolver vazio e a forma de dizer "nao gaste papel" — a estacao entende
   * e marca como impresso sem acionar a impressora.
   */
  if (!temCozinha && !caixa) return "";

  if (cfg.via_cozinha && temCozinha) {
    corpoCozinha(c, pedido);
    if (cfg.cortar) c.cortar();
    else c.pular(3);
    if (caixa) c.novaVia();
  }

  if (caixa) {
    corpoCaixa(c, pedido, restaurante);
    if (cfg.abrir_gaveta && pedido.tipo !== "MESA" && pedido.forma_pagamento === "Dinheiro") {
      c.abrirGaveta();
    }
    if (cfg.cortar) c.cortar();
  }

  return c.paraBase64();
}

/** A conta da mesa: tudo que foi aprovado, somado. Sai quando o cliente pede a conta. */
export function viaConta(
  comanda: Comanda,
  restaurante: ConfigRestaurante,
  cfg: ConfigImpressoras,
): string {
  const c = new Cupom(cfg.colunas);

  cabecalho(c, restaurante);
  c.separador("=");
  c.alinhar(1).negrito(true).tamanho(3).linha(`MESA ${comanda.mesas?.numero ?? ""}`.trim());
  c.tamanho(2).linha("CONTA").tamanho(1).negrito(false);
  c.linha(`${dia(comanda.aberta_em)} · aberta às ${hora(comanda.aberta_em)}`);
  c.alinhar(0).separador("=");

  const pedidos = (comanda.pedidos ?? [])
    .filter((p) => p.status !== "AGUARDANDO" && p.status !== "CANCELADO")
    .sort((a, b) => a.criado_em.localeCompare(b.criado_em));

  if (pedidos.length === 0) c.linha("Nenhum pedido aprovado.");
  for (const p of pedidos) listaDeItens(c, p.itens_pedido ?? []);

  const total = Number(comanda.total);
  const desconto = Number(comanda.desconto);
  c.separador();
  if (desconto > 0) {
    c.doisLados("Consumo", numero(total));
    c.doisLados("Desconto", "-" + numero(desconto));
  }
  totalGrande(c, "TOTAL", Math.max(total - desconto, 0));

  const pagos = comanda.pagamentos ?? [];
  if (pagos.length > 0) {
    c.separador();
    for (const pg of pagos) c.doisLados(nomePagamento(pg.forma), numero(Number(pg.valor)));
  }

  c.separador("=");
  c.alinhar(1).linha("Obrigado pela preferência!");
  if (restaurante.instagram) c.linha(restaurante.instagram);
  c.linha("Não é documento fiscal").alinhar(0);
  if (cfg.cortar) c.cortar();
  return c.paraBase64();
}

/** Cupom curtinho só pra confirmar que a impressora responde. */
export function cupomDeTeste(restaurante: ConfigRestaurante, cfg: ConfigImpressoras): string {
  const c = new Cupom(cfg.colunas);
  cabecalho(c, restaurante);
  c.separador("=");
  c.alinhar(1).negrito(true).tamanho(3).linha("MESA 5").tamanho(1).negrito(false);
  c.linha("teste de impressão").alinhar(0);
  c.separador();
  c.negrito(true).item(2, "X Bacon", "50,00").negrito(false);
  c.detalhe("+ 2x Bacon");
  c.negrito(true).detalhe(">> SEM CEBOLA").negrito(false);
  c.separador();
  totalGrande(c, "TOTAL", 50);
  c.separador("=");
  c.alinhar(1).linha("Se você está lendo isso,").linha("a impressora está certa.").alinhar(0);
  if (cfg.cortar) c.cortar();
  return c.paraBase64();
}
