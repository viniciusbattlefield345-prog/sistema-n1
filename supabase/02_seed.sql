-- =====================================================================
-- N1 Restaurante e Choperia - Dados iniciais
-- Rode DEPOIS do 01_schema.sql
-- =====================================================================

-- Dados do estabelecimento (saem no cupom e no cabecalho do sistema)
insert into configuracoes (chave, valor) values
('restaurante', jsonb_build_object(
  'nome',      'RESTAURANTE E CHOPERIA',
  'slogan',    'Estacao do Chopp',
  'endereco',  'Rua Florcinda Leal, Centro - Atilio Vivacqua/ES',
  'telefone',  '(28) 99883-9321',
  'whatsapp',  '5528998839321',
  'instagram', '@n1restauranteechoperia',
  'horario',   'Segunda a Sabado, 11h as 14h'
)),

-- Nome EXATO das impressoras como aparecem no Windows.
-- Confira em: Painel de Controle > Dispositivos e Impressoras
('impressoras', jsonb_build_object(
  'cozinha',        'TANCA TP-650',
  'entrega',        'TANCA TP-650',
  'colunas',        48,      -- 80mm = 48 colunas na fonte A
  'cortar',         true,    -- aciona a guilhotina no fim do cupom
  'abrir_gaveta',   false,   -- pulso na gaveta de dinheiro
  'vias_cozinha',   1,
  'vias_entrega',   1
)),

('entrega', jsonb_build_object(
  'taxa_padrao', 0
));

-- Categorias do cardapio (renomeie/apague o que nao usar)
insert into categorias (nome, ordem) values
('Pratos',     1),
('Porcoes',    2),
('Lanches',    3),
('Chopp',      4),
('Bebidas',    5),
('Sobremesas', 6);

-- Bairros de entrega. Cadastre os demais com a taxa de cada um
-- em Configuracoes > Bairros; a taxa entra sozinha no pedido.
insert into bairros (nome, taxa) values
('Centro', 0);
