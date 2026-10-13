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
  ViaImpressao,
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

const descricaoDoItem = (item: ItemPedido) =>
  item.variacao_nome ? `${item.produto_nome} (${item.variacao_nome})` : item.produto_nome;

function cabecalho(c: Cupom, restaurante: ConfigRestaurante) {
  c.titulo(restaurante.nome || "GENERAL BURGUER");
  c.alinhar(1);
  for (const linha of [restaurante.slogan, restaurante.endereco, restaurante.telefone]) {
    if (linha) c.linha(linha);
  }
  c.alinhar(0);
}

/**
 * O que o cliente não quer, ou quer diferente.
 *
 * Esta linha é a razão de o papel existir. Preço errado o caixa confere
 * antes de cobrar; "sem cebola" não tem segunda conferência — se não estiver
 * no papel, o lanche volta. Por isso ela nunca é opcional, sai em negrito,
 * em maiúscula e com a seta na frente, e na via da cozinha vem no mesmo
 * tamanho do item: é uma instrução, não um comentário.
 */
function observacaoDoItem(c: Cupom, texto: string, grande = false) {
  if (grande) c.tamanho(2);
  c.negrito(true).detalhe(`>> ${texto.toUpperCase()}`, grande ? 1 : 3).negrito(false);
  if (grande) c.tamanho(1);
}

/**
 * A observação do pedido inteiro: "tudo sem cebola", "embalar separado".
 *
 * Negrito do título até a última linha do texto, igual à observação de item:
 * as duas dizem a mesma coisa pra quem lê, e lê correndo.
 */
function observacaoDoPedido(c: Cupom, pedido: Pedido, grande = false) {
  if (!pedido.observacao) return;
  // Mesmo recuo do texto e das observacoes de item: na conta da mesa o
  // bloco fica visivelmente preso ao pedido de quem pediu.
  c.negrito(true).detalhe("OBSERVACAO DO PEDIDO", 1);
  if (grande) c.tamanho(2);
  c.detalhe(pedido.observacao.toUpperCase(), 1);
  if (grande) c.tamanho(1);
  c.negrito(false);
}

/**
 * O aviso que muda o que fazer com o papel.
 *
 * Reimprimir pedido cancelado é coisa de todo dia — é o papel que mostra ao
 * cliente o que saiu da conta. O risco é esse papel chegar na chapa sem
 * dizer que foi cancelado: alguém monta o lanche e ele sai de graça. Por
 * isso o selo vem antes dos itens, em letra dobrada.
 */
function avisoDoEstado(pedido: Pedido, onde: "COZINHA" | "CAIXA"): string[] {
  const acao = onde === "COZINHA" ? "NAO PRODUZIR" : "NAO COBRAR";
  if (pedido.status === "CANCELADO") return ["*** CANCELADO ***", acao];
  if (pedido.status === "AGUARDANDO") return ["NAO APROVADO AINDA", acao];
  return [];
}

function selo(c: Cupom, linhas: string[]) {
  if (linhas.length === 0) return;
  c.separador("=").alinhar(1).negrito(true).tamanho(2);
  for (const l of linhas) c.linha(l);
  c.tamanho(1).negrito(false).alinhar(0);
}

function listaDeItens(c: Cupom, itens: ItemPedido[]) {
  for (const item of itens) {
    c.negrito(true).item(
      Number(item.quantidade),
      descricaoDoItem(item),
      numero(valorDoItem(item)),
    );
    c.negrito(false);
    for (const extra of item.item_adicionais ?? []) c.detalhe("+ " + extraComVezes(extra));
    if (item.observacao) observacaoDoItem(c, item.observacao);
  }
}

function totalGrande(c: Cupom, rotulo: string, valor: number) {
  c.pular().tamanho(2).negrito(true).doisLados(rotulo, numero(valor));
  c.tamanho(1).negrito(false);
}

/** Só o que a cozinha precisa: quantidade, produto, adicional e observação. */
function listaDeItensCozinha(c: Cupom, itens: ItemPedido[]) {
  for (const item of itens) {
    c.tamanho(2).negrito(true).item(
      Number(item.quantidade),
      descricaoDoItem(item).toUpperCase(),
      "",
    );
    c.tamanho(1).negrito(false);
    for (const extra of item.item_adicionais ?? []) c.detalhe("+ " + extraComVezes(extra));
    if (item.observacao) observacaoDoItem(c, item.observacao, true);
  }
}

/**
 * O que a chapa tem a fazer deste pedido. Bebida fica de fora: ela sai da
 * geladeira, e um papel a mais na cozinha é um papel que atrapalha.
 *
 * Item antigo, gravado antes desta regra existir, vem sem o campo e conta
 * como cozinha — era assim que ele era impresso quando foi feito.
 */
function itensDaCozinha(pedido: Pedido): ItemPedido[] {
  return (pedido.itens_pedido ?? []).filter((i) => i.vai_pra_cozinha !== false);
}

/**
 * A via da cozinha: nenhum preço. Quem está na chapa não precisa saber
 * quanto custa — precisa enxergar o que montar de longe, com a mão ocupada.
 * Por isso o item vai em letra dobrada e o resto é enxuto.
 */
function corpoCozinha(c: Cupom, pedido: Pedido) {
  c.alinhar(1).negrito(true).tamanho(2).linha("COZINHA");
  c.tamanho(3).linha(rotuloPedido(pedido).toUpperCase());
  c.tamanho(2).linha(`PEDIDO ${numeroPedido(pedido.numero_dia)}`);
  c.tamanho(1).negrito(false).linha(hora(pedido.criado_em));
  c.alinhar(0);
  selo(c, avisoDoEstado(pedido, "COZINHA"));
  c.separador("=");

  listaDeItensCozinha(c, itensDaCozinha(pedido));

  if (pedido.observacao) {
    c.separador();
    observacaoDoPedido(c, pedido, true);
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
  c.alinhar(0);
  selo(c, avisoDoEstado(pedido, "CAIXA"));
  c.separador();

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
    observacaoDoPedido(c, pedido);
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
 * Quais vias saem, pra uma escolha de via.
 *
 * Esta função é a única que decide — a tela usa ela pra dizer o que o botão
 * vai fazer, e o cupom usa ela pra montar o papel. Enquanto as duas coisas
 * vierem daqui, o botão não pode prometer uma via que não sai.
 *
 *  AUTO    o que está em Configurações: é como o cupom sai sozinho quando o
 *          pedido é lançado ou aprovado.
 *  COZINHA · CAIXA · TUDO  o que alguém pediu no botão. Aqui a configuração
 *          não entra: ela governa o papel automático, não o papel que uma
 *          pessoa acabou de pedir na tela.
 */
export function oQueSai(
  pedido: Pedido,
  cfg: ConfigImpressoras,
  via: ViaImpressao = "AUTO",
): { cozinha: boolean; caixa: boolean } {
  const temCozinha = itensDaCozinha(pedido).length > 0;

  if (via === "COZINHA") return { cozinha: temCozinha, caixa: false };
  if (via === "CAIXA") return { cozinha: false, caixa: true };
  if (via === "TUDO") return { cozinha: temCozinha, caixa: true };

  /**
   * Entrega SEMPRE leva a via do caixa, mesmo com ela desligada.
   *
   * É o único papel que vai dentro da sacola, e é nele que estão o endereço,
   * o total e o troco. Sem ele o motoboy sai sem saber onde parar nem quanto
   * cobrar — a via da cozinha não tem nada disso, de propósito.
   *
   * Mesa e retirada seguem a configuração: ali o cliente está na casa, e a
   * conta sai quando ele pede, não quando a cozinha recebe.
   */
  return {
    cozinha: cfg.via_cozinha && temCozinha,
    caixa: pedido.tipo === "ENTREGA" || cfg.via_caixa || !cfg.via_cozinha,
  };
}

/**
 * O cupom de um pedido, montado. `null` quando não há o que imprimir —
 * pedido só de bebida com a via do caixa desligada, por exemplo.
 *
 * Devolve o Cupom, e não os bytes, porque a tela mostra as mesmas linhas
 * que vão pro papel. Quem só quer imprimir usa `viaPedido`.
 */
export function montarPedido(
  pedido: Pedido,
  restaurante: ConfigRestaurante,
  cfg: ConfigImpressoras,
  via: ViaImpressao = "AUTO",
): Cupom | null {
  const sai = oQueSai(pedido, cfg, via);
  if (!sai.cozinha && !sai.caixa) return null;

  const c = new Cupom(cfg.colunas);

  if (sai.cozinha) {
    corpoCozinha(c, pedido);
    if (cfg.cortar) c.cortar();
    else c.pular(3);
    if (sai.caixa) c.novaVia();
  }

  if (sai.caixa) {
    corpoCaixa(c, pedido, restaurante);
    if (cfg.abrir_gaveta && pedido.tipo !== "MESA" && pedido.forma_pagamento === "Dinheiro") {
      c.abrirGaveta();
    }
    if (cfg.cortar) c.cortar();
  }

  return c;
}

/**
 * Os bytes do cupom de um pedido. Vazio = não há o que imprimir; a estação
 * entende e tira da fila sem acionar a impressora.
 */
export function viaPedido(
  pedido: Pedido,
  restaurante: ConfigRestaurante,
  cfg: ConfigImpressoras,
  via: ViaImpressao = "AUTO",
): string {
  return montarPedido(pedido, restaurante, cfg, via)?.paraBase64() ?? "";
}

/**
 * A conta da mesa: tudo que foi aprovado, somado. Sai quando o cliente pede
 * a conta — e é o papel que ele confere item por item antes de pagar.
 */
export function montarConta(
  comanda: Comanda,
  restaurante: ConfigRestaurante,
  cfg: ConfigImpressoras,
): Cupom {
  const c = new Cupom(cfg.colunas);
  const mesa = `Mesa ${comanda.mesas?.numero ?? ""}`.trim();

  cabecalho(c, restaurante);
  c.separador("=");
  c.alinhar(1).negrito(true).tamanho(3).linha(mesa.toUpperCase());
  c.tamanho(2).linha("CONTA").tamanho(1).negrito(false);
  c.linha(`${dia(comanda.aberta_em)} · aberta às ${hora(comanda.aberta_em)}`);
  c.alinhar(0);

  // Conta reimpressa depois de paga não pode parecer conta a pagar.
  if (comanda.status === "FECHADA") selo(c, ["*** CONTA PAGA ***"]);
  if (comanda.status === "CANCELADA") selo(c, ["CONTA CANCELADA"]);
  c.separador("=");

  const todos = comanda.pedidos ?? [];
  const pedidos = todos
    .filter((p) => p.status !== "AGUARDANDO" && p.status !== "CANCELADO")
    .sort((a, b) => a.criado_em.localeCompare(b.criado_em));

  if (pedidos.length === 0) c.linha("Nenhum pedido aprovado.");

  /**
   * Mesa de quatro pessoas vira uma lista longa, e a reclamação clássica é
   * "isso aqui não é meu". Com mais de um pedido na conta, cada bloco diz
   * de quem é e de que hora — é assim que o cliente acha o dele no papel, e
   * é o que torna possível conferir contra a via de um pedido só.
   */
  const varios = pedidos.length > 1;
  for (const p of pedidos) {
    if (varios) {
      const nome = p.cliente_nome && !p.cliente_nome.startsWith("Mesa ") ? ` · ${p.cliente_nome}` : "";
      c.negrito(true).linha(`Pedido ${numeroPedido(p.numero_dia)}${nome} · ${hora(p.criado_em)}`);
      c.negrito(false);
    }
    listaDeItens(c, p.itens_pedido ?? []);
    if (p.observacao) observacaoDoPedido(c, p);
    if (varios) c.pular();
  }

  /**
   * Pedido que o cliente fez no QR e ninguém aprovou ainda não está somado
   * em lugar nenhum — nem aqui, nem no total da mesa. Cobrar esta conta sem
   * saber disso é entregar comida de graça, então o papel avisa.
   */
  const esperando = todos.filter((p) => p.status === "AGUARDANDO");
  if (esperando.length > 0) {
    c.separador();
    c.negrito(true).linha("ATENCAO").negrito(false);
    c.detalhe(
      `${esperando.length} pedido(s) desta mesa esperam aprovacao e NAO estao somados aqui.`,
      1,
    );
  }

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
  return c;
}

export function viaConta(
  comanda: Comanda,
  restaurante: ConfigRestaurante,
  cfg: ConfigImpressoras,
): string {
  return montarConta(comanda, restaurante, cfg).paraBase64();
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
  observacaoDoItem(c, "sem cebola");
  c.separador();
  totalGrande(c, "TOTAL", 50);
  c.separador("=");
  c.alinhar(1).linha("Se você está lendo isso,").linha("a impressora está certa.").alinhar(0);
  if (cfg.cortar) c.cortar();
  return c.paraBase64();
}
