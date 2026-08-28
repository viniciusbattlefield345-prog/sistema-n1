import { Cupom } from "./escpos";
import { numero, hora, numeroPedido, telefone } from "./formato";
import type { ConfigImpressoras, ConfigRestaurante, Pedido } from "./tipos";

/**
 * Via da COZINHA — sem preço nenhum.
 * A cozinha precisa de: número, o que fazer, e a observação. Só.
 * Fonte grande porque o papel é lido de longe, com pressa e mão ocupada.
 */
export function viaCozinha(
  pedido: Pedido,
  cfg: ConfigImpressoras,
): string {
  const c = new Cupom(cfg.colunas);

  c.alinhar(1).negrito(true).linha("*** COZINHA ***").negrito(false);
  c.tamanho(3).negrito(true).linha(numeroPedido(pedido.numero_dia));
  c.tamanho(1).negrito(false);
  c.linha(pedido.tipo_entrega === "ENTREGA" ? "ENTREGA" : "RETIRADA");
  c.tamanho(2).negrito(true).linha(pedido.cliente_nome.toUpperCase());
  c.tamanho(1).negrito(false);
  c.linha(hora(pedido.criado_em));
  c.alinhar(0).separador("=");

  for (const item of pedido.itens_pedido ?? []) {
    const descricao = item.variacao_nome
      ? `${item.produto_nome} (${item.variacao_nome})`
      : item.produto_nome;

    c.tamanho(2).negrito(true);
    c.linha(`${Number(item.quantidade)}x ${descricao}`);
    c.tamanho(1).negrito(false);

    for (const extra of item.item_adicionais ?? []) {
      c.detalhe(`+ ${extra.nome}`);
    }
    if (item.observacao) {
      c.negrito(true).detalhe(`>> ${item.observacao.toUpperCase()}`).negrito(false);
    }
    c.pular();
  }

  if (pedido.observacao) {
    c.separador();
    c.negrito(true).linha("OBSERVACAO DO PEDIDO:").negrito(false);
    c.detalhe(pedido.observacao, 0);
  }

  c.separador("=");
  c.alinhar(1).negrito(true).linha("FIM DO PEDIDO").negrito(false).alinhar(0);

  if (cfg.cortar) c.cortar();
  return c.paraBase64();
}

/**
 * Via do CLIENTE / ENTREGA — com preço, endereço e troco.
 * É a via que vai na sacola junto com a comida.
 */
export function viaEntrega(
  pedido: Pedido,
  restaurante: ConfigRestaurante,
  cfg: ConfigImpressoras,
): string {
  const c = new Cupom(cfg.colunas);

  c.titulo(restaurante.nome);
  c.alinhar(1);
  c.linha(restaurante.slogan);
  c.linha(restaurante.endereco);
  c.linha(restaurante.telefone);
  c.alinhar(0).separador();

  c.doisLados(
    new Date(pedido.criado_em).toLocaleDateString("pt-BR", {
      timeZone: "America/Sao_Paulo",
    }),
    hora(pedido.criado_em),
  );

  c.alinhar(1).tamanho(3).negrito(true);
  c.linha(numeroPedido(pedido.numero_dia));
  c.tamanho(1).negrito(false).alinhar(0);
  c.separador();

  c.negrito(true).linha("CLIENTE").negrito(false);
  c.linha(pedido.cliente_nome.toUpperCase());
  if (pedido.cliente_telefone) c.linha(telefone(pedido.cliente_telefone));

  c.pular();
  if (pedido.tipo_entrega === "ENTREGA") {
    c.negrito(true).linha("ENTREGAR EM").negrito(false);
    c.detalhe(pedido.endereco_entrega ?? "", 0);
  } else {
    c.negrito(true).linha("RETIRADA NO BALCAO").negrito(false);
  }

  c.separador("=");

  for (const item of pedido.itens_pedido ?? []) {
    const descricao = item.variacao_nome
      ? `${item.produto_nome} (${item.variacao_nome})`
      : item.produto_nome;

    const extras = item.item_adicionais ?? [];
    const somaExtras = extras.reduce((s, e) => s + Number(e.preco) * e.quantidade, 0);
    const totalLinha =
      Number(item.quantidade) * (Number(item.preco_unitario) + somaExtras);

    c.item(Number(item.quantidade), descricao, numero(totalLinha));
    for (const extra of extras) c.detalhe(`+ ${extra.nome}`);
    if (item.observacao) c.detalhe(`obs: ${item.observacao}`);
  }

  c.separador();
  c.doisLados("Subtotal", numero(Number(pedido.subtotal)));
  if (Number(pedido.taxa_entrega) > 0)
    c.doisLados("Taxa de entrega", numero(Number(pedido.taxa_entrega)));
  if (Number(pedido.desconto) > 0)
    c.doisLados("Desconto", "-" + numero(Number(pedido.desconto)));

  c.pular().tamanho(2).negrito(true);
  c.doisLados("TOTAL", numero(Number(pedido.total)));
  c.tamanho(1).negrito(false);

  c.separador();
  c.negrito(true).linha("PAGAMENTO: " + (pedido.forma_pagamento ?? "-")).negrito(false);

  if (pedido.forma_pagamento === "Dinheiro" && Number(pedido.troco_para) > 0) {
    const troco = Number(pedido.troco_para) - Number(pedido.total);
    c.doisLados("Levar troco para", numero(Number(pedido.troco_para)));
    c.tamanho(2).negrito(true);
    c.doisLados("TROCO", numero(Math.max(troco, 0)));
    c.tamanho(1).negrito(false);
  }

  c.separador("=");
  c.alinhar(1);
  c.linha("Obrigado pela preferencia!");
  c.linha(restaurante.instagram);
  c.alinhar(0);

  if (cfg.abrir_gaveta && pedido.forma_pagamento === "Dinheiro") c.abrirGaveta();
  if (cfg.cortar) c.cortar();
  return c.paraBase64();
}
