import { Cupom } from "./escpos";
import { hora, nomePagamento, numero, numeroPedido, rotuloPedido, telefone } from "./formato";
import type { Comanda, ConfigImpressoras, ConfigRestaurante, ItemPedido, Pedido } from "./tipos";

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
    for (const extra of item.item_adicionais ?? []) c.detalhe(`+ ${extra.nome}`);
    if (item.observacao) {
      c.negrito(true).detalhe(`>> ${item.observacao.toUpperCase()}`).negrito(false);
    }
  }
}

function totalGrande(c: Cupom, rotulo: string, valor: number) {
  c.pular().tamanho(2).negrito(true).doisLados(rotulo, numero(valor));
  c.tamanho(1).negrito(false);
}

/**
 * O cupom do pedido — um só, completo. É o que a cozinha lê pra montar e o
 * que acompanha o lanche até a mesa ou a sacola.
 * A mesa sai em letra gigante: é a primeira coisa que alguém procura no papel.
 */
export function viaPedido(
  pedido: Pedido,
  restaurante: ConfigRestaurante,
  cfg: ConfigImpressoras,
): string {
  const c = new Cupom(cfg.colunas);
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
  if (cfg.abrir_gaveta && pedido.tipo !== "MESA" && pedido.forma_pagamento === "Dinheiro") {
    c.abrirGaveta();
  }
  if (cfg.cortar) c.cortar();
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
  c.detalhe("+ Bacon");
  c.negrito(true).detalhe(">> SEM CEBOLA").negrito(false);
  c.separador();
  totalGrande(c, "TOTAL", 50);
  c.separador("=");
  c.alinhar(1).linha("Se você está lendo isso,").linha("a impressora está certa.").alinhar(0);
  if (cfg.cortar) c.cortar();
  return c.paraBase64();
}
