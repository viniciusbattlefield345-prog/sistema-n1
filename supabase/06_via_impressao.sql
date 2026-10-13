-- =====================================================================
-- Qual via de um pedido sai no papel.
--
-- Rode uma vez, no SQL Editor do Supabase. Nao apaga nada: so acrescenta
-- uma coluna com valor padrao, e todo cupom que ja existe passa a valer
-- 'AUTO' — exatamente o que ele era antes.
--
-- O QUE MUDA: a tela do pedido ganha "via da cozinha", "via do caixa",
-- "as duas vias" e "conta da mesa". Sem esta coluna, escolher a via pela
-- rede (do celular, por exemplo) devolve um recado pedindo esta
-- atualizacao; o botao "Imprimir neste computador" funciona de qualquer
-- jeito, porque ali o cupom e montado no proprio navegador.
--
--  AUTO     o que esta em Configuracoes (o cupom que sai sozinho)
--  COZINHA  so o que montar, sem nenhum preco
--  CAIXA    so a com preco, total e pagamento
--  TUDO     as duas, separadas pela guilhotina
-- =====================================================================

alter table fila_impressao
  add column if not exists via text not null default 'AUTO';

-- A trava do valor vem depois da coluna: assim rodar o arquivo duas vezes
-- nao reclama, e um valor escrito errado pelo codigo e recusado pelo banco
-- em vez de virar papel em branco na cozinha.
alter table fila_impressao
  drop constraint if exists impressao_via_valida;

alter table fila_impressao
  add constraint impressao_via_valida
  check (via in ('AUTO', 'COZINHA', 'CAIXA', 'TUDO'));

-- Via e coisa de pedido. A conta da mesa e uma so: nao tem duas vias.
alter table fila_impressao
  drop constraint if exists impressao_via_so_de_pedido;

alter table fila_impressao
  add constraint impressao_via_so_de_pedido
  check (tipo = 'PEDIDO' or via = 'AUTO');

-- O PostgREST guarda o desenho das tabelas em memoria; sem isto ele pode
-- levar uns minutos pra enxergar a coluna nova.
notify pgrst, 'reload schema';

-- Confere: tem que aparecer uma linha, via | text | 'AUTO'::text
select column_name, data_type, column_default
  from information_schema.columns
 where table_name = 'fila_impressao'
   and column_name = 'via';
