-- =====================================================================
-- Cardapio do dia: marmita P/M/G montada pelo cliente
-- =====================================================================

-- Os itens da marmita nao tem preco, mas precisam vir separados por
-- secao, senao viram 23 caixinhas soltas na tela da atendente.
alter table adicionais add column if not exists grupo text;
alter table adicionais add column if not exists ordem int not null default 0;

-- Tira a Feijoada, que era so teste
delete from produtos where nome = 'Feijoada';

-- ---------------------------------------------------------------------
-- O produto e os tamanhos
-- ---------------------------------------------------------------------
insert into produtos (categoria_id, nome, descricao, preco_base, ordem)
values (
  (select id from categorias where nome = 'Pratos'),
  'Marmita',
  'Escolha o tamanho e monte a marmita',
  18.00,
  1
);

insert into produto_variacoes (produto_id, nome, preco, ordem)
select p.id, v.nome, v.preco, v.ordem
from produtos p,
     (values ('P', 18.00, 1), ('M', 20.00, 2), ('G', 22.00, 3))
       as v(nome, preco, ordem)
where p.nome = 'Marmita';

-- ---------------------------------------------------------------------
-- O que vai dentro (tudo R$ 0: quem define o preco e o tamanho)
-- ---------------------------------------------------------------------
insert into adicionais (nome, preco, grupo, ordem) values
-- acompanhamentos
('Arroz',                0, 'Acompanhamentos',  1),
('Feijao',               0, 'Acompanhamentos',  2),
('Tropeiro',             0, 'Acompanhamentos',  3),
('Macarrao',             0, 'Acompanhamentos',  4),
('Tutu',                 0, 'Acompanhamentos',  5),
('Strogonoff',           0, 'Acompanhamentos',  6),
('Farofa',               0, 'Acompanhamentos',  7),
('Macarronese',          0, 'Acompanhamentos',  8),
('Polenta',              0, 'Acompanhamentos',  9),
-- carnes
('Costelinha de porco',  0, 'Carnes',           1),
('File empanado (frango)', 0, 'Carnes',         2),
('Coxa de frango',       0, 'Carnes',           3),
-- saladas e fritos
('Tomate',               0, 'Saladas e fritos', 1),
('Vinagrete',            0, 'Saladas e fritos', 2),
('Batata frita',         0, 'Saladas e fritos', 3),
('Banana frita',         0, 'Saladas e fritos', 4),
('Repolho',              0, 'Saladas e fritos', 5),
('Cenoura',              0, 'Saladas e fritos', 6),
('Salpicao',             0, 'Saladas e fritos', 7),
('Pure',                 0, 'Saladas e fritos', 8),
('Jilo',                 0, 'Saladas e fritos', 9),
('Quiabo',               0, 'Saladas e fritos', 10),
('Farofa de cuscuz',     0, 'Saladas e fritos', 11)
on conflict (nome) do update
  set grupo = excluded.grupo, ordem = excluded.ordem, preco = excluded.preco;

-- Liga todos eles a marmita
insert into produto_adicionais (produto_id, adicional_id)
select p.id, a.id
from produtos p, adicionais a
where p.nome = 'Marmita'
on conflict do nothing;

notify pgrst, 'reload schema';

-- Confere
select v.nome as tamanho, v.preco from produto_variacoes v
  join produtos p on p.id = v.produto_id where p.nome = 'Marmita' order by v.ordem;
select grupo, count(*) as itens from adicionais group by grupo order by grupo;
