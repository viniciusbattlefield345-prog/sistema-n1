-- =====================================================================
-- GENERAL BURGUER - banco completo (Supabase / PostgreSQL)
--
-- COMO RODAR: Supabase > SQL Editor > New query > cole ESTE ARQUIVO
-- INTEIRO > Run. Uma vez so.
--
-- O que ele faz:
--   * apaga o cardapio, os pedidos, os clientes e o caixa do N°1;
--   * cria mesas, comandas, pagamentos e a fila de impressao;
--   * cadastra o cardapio do General Burguer e as mesas 1 a 10.
--
-- O que ele NAO mexe: os logins (Authentication e a tabela perfis).
-- Quem entrava no sistema continua entrando com o mesmo usuario e senha.
--
-- Pode rodar de novo se precisar: ele recomeca do zero do mesmo jeito.
-- Esta tudo numa transacao - se der erro no meio, nada fica pela metade.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 0) LIMPA O QUE ERA DO N°1
-- ---------------------------------------------------------------------
drop view  if exists vw_vendas_produto;
drop table if exists fila_impressao, pagamentos, item_adicionais, itens_pedido,
                     pedidos, comandas, mesas, caixas, clientes, bairros,
                     produto_adicionais, adicionais, produto_variacoes,
                     produtos, categorias, configuracoes cascade;
drop function if exists public.definir_numero_dia() cascade;
drop function if exists public.recalcular_total(bigint) cascade;
drop function if exists public.trg_recalcular_item() cascade;
drop function if exists public.trg_recalcular_adicional() cascade;
drop function if exists public.trg_pedido_total() cascade;
drop function if exists public.recalcular_comanda(bigint) cascade;
drop function if exists public.trg_pedido_comanda() cascade;
drop function if exists public.codigo_mesa() cascade;

-- ---------------------------------------------------------------------
-- PERFIS (complementa auth.users - a senha fica no Supabase Auth)
-- "if not exists": os logins que ja existem ficam como estao.
-- ---------------------------------------------------------------------
create table if not exists perfis (
  id          uuid primary key references auth.users(id) on delete cascade,
  nome        text not null,
  papel       text not null default 'atendente'
              check (papel in ('dono','atendente','cozinha')),
  ativo       boolean not null default true,
  criado_em   timestamptz not null default now()
);

create or replace function public.criar_perfil()
returns trigger
language plpgsql
security definer set search_path = public
as $fn$
begin
  insert into public.perfis (id, nome)
  values (new.id, coalesce(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end $fn$;

drop trigger if exists ao_criar_usuario on auth.users;
create trigger ao_criar_usuario
  after insert on auth.users
  for each row execute function public.criar_perfil();

-- ---------------------------------------------------------------------
-- CARDAPIO
-- ---------------------------------------------------------------------
create table categorias (
  id         bigint generated always as identity primary key,
  nome       text not null,
  descricao  text,                                -- "de 8 fatias"
  ordem      int not null default 0,
  ativo      boolean not null default true
);

create table produtos (
  id            bigint generated always as identity primary key,
  categoria_id  bigint references categorias(id) on delete set null,
  nome          text not null,
  descricao     text,
  foto_url      text,                             -- foto no cardapio do cliente
  preco_base    numeric(10,2) not null default 0 check (preco_base >= 0),
  custo         numeric(10,2) check (custo >= 0),
  ativo         boolean not null default true,    -- some do cardapio
  disponivel    boolean not null default true,    -- "acabou hoje"
  ordem         int not null default 0,
  criado_em     timestamptz not null default now()
);
create index on produtos (categoria_id);

create table produto_variacoes (
  id          bigint generated always as identity primary key,
  produto_id  bigint not null references produtos(id) on delete cascade,
  nome        text not null,
  preco       numeric(10,2) not null default 0 check (preco >= 0),
  ordem       int not null default 0
);
create index on produto_variacoes (produto_id);

create table adicionais (
  id     bigint generated always as identity primary key,
  nome   text not null unique,
  preco  numeric(10,2) not null default 0 check (preco >= 0),
  grupo  text,
  ordem  int not null default 0,
  ativo  boolean not null default true
);

create table produto_adicionais (
  produto_id    bigint not null references produtos(id) on delete cascade,
  adicional_id  bigint not null references adicionais(id) on delete cascade,
  preco         numeric(10,2) check (preco >= 0),
  primary key (produto_id, adicional_id)
);

-- ---------------------------------------------------------------------
-- ENTREGA
-- ---------------------------------------------------------------------
create table bairros (
  id     bigint generated always as identity primary key,
  nome   text not null unique,
  taxa   numeric(10,2) not null default 0 check (taxa >= 0),
  ativo  boolean not null default true
);

create table clientes (
  id          bigint generated always as identity primary key,
  nome        text not null,
  telefone    text,
  endereco    text,
  numero      text,
  bairro_id   bigint references bairros(id) on delete set null,
  referencia  text,
  observacao  text,
  criado_em   timestamptz not null default now()
);
create unique index clientes_telefone_unico on clientes (telefone)
  where telefone is not null and telefone <> '';

-- ---------------------------------------------------------------------
-- CAIXA
-- ---------------------------------------------------------------------
create table caixas (
  id                bigint generated always as identity primary key,
  usuario_id        uuid references auth.users(id) on delete set null,
  aberto_em         timestamptz not null default now(),
  fechado_em        timestamptz,
  valor_abertura    numeric(10,2) not null default 0,
  valor_fechamento  numeric(10,2),
  observacao        text,
  status            text not null default 'ABERTO' check (status in ('ABERTO','FECHADO'))
);
-- so existe UM caixa aberto por vez. Caixa fechado = loja fechada:
-- o QR das mesas nao aceita pedido.
create unique index caixa_unico_aberto on caixas (status) where status = 'ABERTO';

-- ---------------------------------------------------------------------
-- MESAS
-- O link do QR leva um codigo sorteado, nao o numero da mesa. Com o numero
-- no link, bastaria trocar "5" por "6" pra mandar pedido pra mesa alheia.
-- ---------------------------------------------------------------------
create or replace function public.codigo_mesa()
returns text language sql volatile as $fn$
  select string_agg(
           substr('abcdefghjkmnpqrstuvwxyz23456789', (floor(random() * 31) + 1)::int, 1),
           '')
  from generate_series(1, 8)
$fn$;

create table mesas (
  id         bigint generated always as identity primary key,
  numero     int not null unique check (numero > 0),
  codigo     text not null unique default public.codigo_mesa(),
  ativo      boolean not null default true,
  criado_em  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- COMANDAS - a conta aberta de uma mesa
-- ---------------------------------------------------------------------
create table comandas (
  id           bigint generated always as identity primary key,
  mesa_id      bigint not null references mesas(id),
  caixa_id     bigint references caixas(id) on delete set null,
  status       text not null default 'ABERTA'
               check (status in ('ABERTA','FECHADA','CANCELADA')),
  total        numeric(10,2) not null default 0,   -- soma dos pedidos aprovados (trigger)
  desconto     numeric(10,2) not null default 0 check (desconto >= 0),
  aberta_em    timestamptz not null default now(),
  fechada_em   timestamptz,
  fechada_por  uuid references auth.users(id) on delete set null
);
-- uma conta aberta por mesa, garantido no banco
create unique index comanda_unica_aberta on comandas (mesa_id) where status = 'ABERTA';
create index on comandas (caixa_id);

-- como a conta foi paga: pode ter mais de uma forma (parte Pix, parte dinheiro)
create table pagamentos (
  id          bigint generated always as identity primary key,
  comanda_id  bigint not null references comandas(id) on delete cascade,
  caixa_id    bigint references caixas(id) on delete set null,
  forma       text not null check (forma in
                ('Dinheiro','Pix','Cartao Credito','Cartao Debito')),
  valor       numeric(10,2) not null check (valor > 0),
  criado_em   timestamptz not null default now()
);
create index on pagamentos (comanda_id);
create index on pagamentos (caixa_id);

-- ---------------------------------------------------------------------
-- PEDIDOS
-- ---------------------------------------------------------------------
create table pedidos (
  id                bigint generated always as identity primary key,
  numero_dia        int,                                   -- #01, #02... reinicia todo dia
  caixa_id          bigint references caixas(id) on delete set null,
  usuario_id        uuid references auth.users(id) on delete set null,  -- null = cliente pelo QR
  origem            text not null default 'EQUIPE' check (origem in ('EQUIPE','CLIENTE')),
  tipo              text not null default 'MESA'
                    check (tipo in ('MESA','ENTREGA','RETIRADA')),
  mesa_id           bigint references mesas(id),
  comanda_id        bigint references comandas(id),
  cliente_id        bigint references clientes(id) on delete set null,
  cliente_nome      text not null,
  cliente_telefone  text,
  endereco_entrega  text,
  taxa_entrega      numeric(10,2) not null default 0 check (taxa_entrega >= 0),
  subtotal          numeric(10,2) not null default 0,
  desconto          numeric(10,2) not null default 0 check (desconto >= 0),
  total             numeric(10,2) not null default 0,
  forma_pagamento   text check (forma_pagamento in
                      ('Dinheiro','Pix','Cartao Credito','Cartao Debito')),
  troco_para        numeric(10,2) check (troco_para >= 0),
  -- AGUARDANDO = cliente pediu pelo QR e o atendente ainda nao aprovou
  status            text not null default 'PENDENTE' check (status in
                      ('AGUARDANDO','PENDENTE','EM PREPARO','PRONTO',
                       'SAIU PARA ENTREGA','CONCLUIDO','CANCELADO')),
  motivo_recusa     text,
  aprovado_por      uuid references auth.users(id) on delete set null,
  aprovado_em       timestamptz,
  observacao        text,
  criado_em         timestamptz not null default now(),
  atualizado_em     timestamptz not null default now(),
  constraint pedido_de_mesa_tem_comanda
    check (tipo <> 'MESA' or (mesa_id is not null and comanda_id is not null))
);
create index on pedidos (status);
create index on pedidos (criado_em desc);
create index on pedidos (caixa_id);
create index on pedidos (cliente_id);
create index on pedidos (comanda_id);

create table itens_pedido (
  id              bigint generated always as identity primary key,
  pedido_id       bigint not null references pedidos(id) on delete cascade,
  produto_id      bigint references produtos(id) on delete set null,
  variacao_id     bigint references produto_variacoes(id) on delete set null,
  produto_nome    text not null,      -- foto do nome na hora da venda
  variacao_nome   text,
  quantidade      numeric(10,3) not null default 1 check (quantidade > 0),
  preco_unitario  numeric(10,2) not null check (preco_unitario >= 0),
  observacao      text
);
create index on itens_pedido (pedido_id);
create index on itens_pedido (produto_id);

create table item_adicionais (
  id            bigint generated always as identity primary key,
  item_id       bigint not null references itens_pedido(id) on delete cascade,
  adicional_id  bigint references adicionais(id) on delete set null,
  nome          text not null,
  preco         numeric(10,2) not null default 0 check (preco >= 0),
  quantidade    int not null default 1 check (quantidade > 0)
);
create index on item_adicionais (item_id);

-- ---------------------------------------------------------------------
-- FILA DE IMPRESSAO
-- O celular nao alcanca a impressora USB do balcao. Quem aprova coloca o
-- cupom aqui; a tela "Impressao", aberta no PC do balcao, imprime.
-- ---------------------------------------------------------------------
create table fila_impressao (
  id             bigint generated always as identity primary key,
  tipo           text not null check (tipo in ('PEDIDO','CONTA')),
  pedido_id      bigint references pedidos(id) on delete cascade,
  comanda_id     bigint references comandas(id) on delete cascade,
  status         text not null default 'PENDENTE'
                 check (status in ('PENDENTE','IMPRIMINDO','IMPRESSO','ERRO')),
  erro           text,
  tentativas     int not null default 0,
  pedido_por     uuid references auth.users(id) on delete set null,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  constraint impressao_tem_alvo check (
    (tipo = 'PEDIDO' and pedido_id is not null) or
    (tipo = 'CONTA'  and comanda_id is not null))
);
create index on fila_impressao (status, criado_em);
create index on fila_impressao (pedido_id);

-- ---------------------------------------------------------------------
-- CONFIGURACAO (nome, endereco, impressora)
-- ---------------------------------------------------------------------
create table configuracoes (
  chave  text primary key,
  valor  jsonb not null
);

-- ---------------------------------------------------------------------
-- TRIGGERS
-- ---------------------------------------------------------------------

-- 1) numero do pedido reinicia a cada dia (fuso de Sao Paulo)
create or replace function public.definir_numero_dia()
returns trigger language plpgsql as $fn$
begin
  perform pg_advisory_xact_lock(hashtext('pedido_numero_dia'));
  select coalesce(max(numero_dia), 0) + 1 into new.numero_dia
  from pedidos
  where (criado_em at time zone 'America/Sao_Paulo')::date
      = (now() at time zone 'America/Sao_Paulo')::date;
  return new;
end $fn$;

create trigger pedido_numera
  before insert on pedidos
  for each row execute function public.definir_numero_dia();

-- 2) total do pedido sempre recalculado NO BANCO (itens + adicionais + taxa - desconto)
create or replace function public.recalcular_total(p_pedido bigint)
returns void language plpgsql as $fn$
declare v_sub numeric(10,2);
begin
  select coalesce(sum(i.quantidade * (i.preco_unitario + coalesce(a.extra, 0))), 0)
    into v_sub
  from itens_pedido i
  left join lateral (
    select sum(ad.preco * ad.quantidade) as extra
    from item_adicionais ad
    where ad.item_id = i.id
  ) a on true
  where i.pedido_id = p_pedido;

  update pedidos
     set subtotal      = v_sub,
         total         = greatest(v_sub + taxa_entrega - desconto, 0),
         atualizado_em = now()
   where id = p_pedido;
end $fn$;

-- Em trigger de DELETE o registro "new" nao existe: tocar nele derruba a
-- operacao. Por isso o TG_OP decide de onde vem o id, em vez de coalesce.
create or replace function public.trg_recalcular_item()
returns trigger language plpgsql as $fn$
declare v_pedido bigint;
begin
  if tg_op = 'DELETE' then
    v_pedido := old.pedido_id;
  else
    v_pedido := new.pedido_id;
  end if;

  perform public.recalcular_total(v_pedido);

  if tg_op = 'UPDATE' and old.pedido_id is distinct from new.pedido_id then
    perform public.recalcular_total(old.pedido_id);
  end if;

  return null;
end $fn$;

create trigger item_recalcula
  after insert or update or delete on itens_pedido
  for each row execute function public.trg_recalcular_item();

create or replace function public.trg_recalcular_adicional()
returns trigger language plpgsql as $fn$
declare
  v_item   bigint;
  v_pedido bigint;
begin
  if tg_op = 'DELETE' then
    v_item := old.item_id;
  else
    v_item := new.item_id;
  end if;

  -- Item apagado leva os adicionais por cascata e ja nao existe aqui:
  -- o trigger do proprio item cuida do total.
  select pedido_id into v_pedido from itens_pedido where id = v_item;
  if v_pedido is not null then
    perform public.recalcular_total(v_pedido);
  end if;

  return null;
end $fn$;

create trigger adicional_recalcula
  after insert or update or delete on item_adicionais
  for each row execute function public.trg_recalcular_adicional();

-- 3) mexeu na taxa de entrega ou no desconto, refaz o total
create or replace function public.trg_pedido_total()
returns trigger language plpgsql as $fn$
begin
  new.total := greatest(new.subtotal + new.taxa_entrega - new.desconto, 0);
  new.atualizado_em := now();
  return new;
end $fn$;

create trigger pedido_total
  before update of taxa_entrega, desconto, subtotal on pedidos
  for each row execute function public.trg_pedido_total();

-- 4) total da comanda = soma dos pedidos APROVADOS da mesa.
--    Pedido aguardando aprovacao ou cancelado nao entra na conta.
create or replace function public.recalcular_comanda(p_comanda bigint)
returns void language plpgsql as $fn$
begin
  if p_comanda is null then
    return;
  end if;

  update comandas
     set total = coalesce((
           select sum(p.total)
             from pedidos p
            where p.comanda_id = p_comanda
              and p.status not in ('AGUARDANDO','CANCELADO')), 0)
   where id = p_comanda;
end $fn$;

create or replace function public.trg_pedido_comanda()
returns trigger language plpgsql as $fn$
begin
  if tg_op = 'INSERT' then
    perform public.recalcular_comanda(new.comanda_id);
  elsif tg_op = 'UPDATE' then
    perform public.recalcular_comanda(new.comanda_id);
    if old.comanda_id is distinct from new.comanda_id then
      perform public.recalcular_comanda(old.comanda_id);
    end if;
  else
    perform public.recalcular_comanda(old.comanda_id);
  end if;
  return null;
end $fn$;

create trigger pedido_soma_na_comanda
  after insert or delete or update of total, status, comanda_id on pedidos
  for each row execute function public.trg_pedido_comanda();

-- ---------------------------------------------------------------------
-- RELATORIOS (agrupa por produto_id, nao por texto)
-- ---------------------------------------------------------------------
-- security_invoker: sem isso a view roda como dona e PULA a RLS das tabelas
-- de baixo - quem nao esta logado conseguiria ler o faturamento por ela.
create view vw_vendas_produto with (security_invoker = true) as
select
  i.produto_id,
  coalesce(p.nome, i.produto_nome)      as produto,
  c.nome                                as categoria,
  sum(i.quantidade)                     as quantidade,
  sum(i.quantidade * i.preco_unitario)  as faturamento,
  date_trunc('day', ped.criado_em at time zone 'America/Sao_Paulo') as dia
from itens_pedido i
join pedidos ped       on ped.id = i.pedido_id
left join produtos p   on p.id = i.produto_id
left join categorias c on c.id = p.categoria_id
where ped.status not in ('AGUARDANDO','CANCELADO')
group by i.produto_id, coalesce(p.nome, i.produto_nome), c.nome,
         date_trunc('day', ped.criado_em at time zone 'America/Sao_Paulo');

-- ---------------------------------------------------------------------
-- SEGURANCA (RLS) - so quem esta logado enxerga qualquer coisa.
-- O cliente da mesa NAO fala direto com o banco: o pedido dele passa pelo
-- servidor do site, que confere mesa, produto e preco antes de gravar.
-- ---------------------------------------------------------------------
do $rls$
declare t text;
begin
  foreach t in array array[
    'perfis','categorias','produtos','produto_variacoes','adicionais',
    'produto_adicionais','bairros','clientes','caixas','mesas','comandas',
    'pagamentos','pedidos','itens_pedido','item_adicionais','fila_impressao',
    'configuracoes'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists acesso_equipe on %I', t);
    execute format(
      'create policy acesso_equipe on %I for all to authenticated using (true) with check (true)', t);
  end loop;
end $rls$;

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant select on vw_vendas_produto to authenticated;

-- funcoes internas nao sao API publica
revoke execute on function public.recalcular_total(bigint)   from public, anon;
revoke execute on function public.recalcular_comanda(bigint) from public, anon;
revoke execute on function public.codigo_mesa()              from public, anon;

-- ---------------------------------------------------------------------
-- TEMPO REAL: o celular do atendente e a tela de impressao ficam sabendo
-- de pedido novo na hora, sem apertar F5.
-- ---------------------------------------------------------------------
do $rt$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table pedidos, comandas, fila_impressao;
  end if;
end $rt$;

-- ---------------------------------------------------------------------
-- FOTOS DO CARDAPIO (Storage). Leitura publica; quem envia e o servidor.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('cardapio', 'cardapio', true)
on conflict (id) do update set public = true;

-- =====================================================================
-- DADOS
-- =====================================================================

insert into configuracoes (chave, valor) values
('restaurante', jsonb_build_object(
  'nome',      'GENERAL BURGUER',
  'slogan',    '',
  'endereco',  '',
  'telefone',  '',
  'whatsapp',  '',
  'instagram', '',
  'horario',   ''
)),
-- O nome da impressora e escolhido na tela Impressao, no PC do balcao.
('impressoras', jsonb_build_object(
  'impressora',    '',
  'colunas',       48,     -- 80mm = 48 colunas na fonte A
  'cortar',        true,
  'abrir_gaveta',  false,
  'vias',          1
)),
('entrega', jsonb_build_object('taxa_padrao', 0));

insert into categorias (nome, descricao, ordem) values
('Tropa de Elite',       null,          1),
('Lanches Tradicionais', null,          2),
('Pizzas',               'De 8 fatias', 3),
('Porções',              null,          4),
('Bebidas',              null,          5);

insert into produtos (categoria_id, nome, descricao, preco_base, ordem)
select c.id, p.nome, p.descricao, p.preco, p.ordem
from (values
  -- TROPA DE ELITE
  ('Tropa de Elite', 'Soldado',
   'Pão, carne artesanal 150g, catupiry, presunto, ovo, tomate, alface, milho, salada de legumes e batata frita.', 30.00, 1),
  ('Tropa de Elite', 'Cabo',
   'Pão, carne artesanal 150g, presunto, cheddar, banana, tomate, alface, milho, salada de legumes e batata frita.', 30.00, 2),
  ('Tropa de Elite', 'Primeiro Sargento',
   'Pão, carne artesanal 150g, queijo, presunto, tomate, alface, milho, salada de legumes e batata frita.', 30.00, 3),
  ('Tropa de Elite', 'Segundo Sargento',
   'Pão, carne artesanal 150g, presunto, queijo, ovo, tomate, alface, milho, salada de legumes e batata frita.', 30.00, 4),
  ('Tropa de Elite', 'Terceiro Sargento',
   'Pão, carne artesanal 150g, queijo, bacon, tomate, alface, milho, salada de legumes e batata frita.', 30.00, 5),
  ('Tropa de Elite', 'Subtenente',
   'Pão, carne artesanal 150g, queijo, bacon, ovo, tomate, alface, milho, salada de legumes e batata frita.', 30.00, 6),
  ('Tropa de Elite', 'Aspirante',
   'Pão, carne artesanal 150g, queijo, cebola grelhada no shoyu, picles, molho especial, tomate, alface, milho, salada de legumes e batata frita.', 30.00, 7),
  ('Tropa de Elite', 'Primeiro Tenente',
   'Pão, 2 carnes artesanais 150g, três queijos, tomate, alface, milho, salada de legumes e batata frita.', 32.00, 8),
  ('Tropa de Elite', 'Segundo Tenente',
   'Pão, carne artesanal 150g, presunto, queijo, bacon, calabresa, banana, ovo, tomate, alface, milho, salada de legumes e batata frita.', 33.00, 9),
  ('Tropa de Elite', 'Recruta Zero',
   'Pão, 2 carnes artesanais 150g, banana, ovo, cheddar, cebola, alface, tomate e batata palha.', 32.00, 10),
  ('Tropa de Elite', 'Major',
   'Pão, filé de boi, cebola grelhada no shoyu, queijo, bacon, ovo, tomate, alface, milho, salada de legumes e batata frita.', 38.00, 11),
  ('Tropa de Elite', 'Tenente Coronel',
   'Pão, filé de boi, cebola grelhada no shoyu, presunto, queijo, bacon, banana, calabresa, ovo, tomate, alface, milho, salada de legumes e batata frita.', 39.00, 12),
  ('Tropa de Elite', 'Coronel',
   'Pão, frango grelhado, presunto, queijo, ovo, tomate, alface, milho, salada de legumes e batata frita.', 32.00, 13),
  ('Tropa de Elite', 'General de Brigada',
   'Pão, frango grelhado, queijo, bacon, tomate, alface, milho, salada de legumes e batata frita.', 32.00, 14),
  ('Tropa de Elite', 'General de Exército',
   'Pão, frango grelhado, presunto, queijo, bacon, calabresa, banana, ovo, tomate, alface, milho, salada de legumes e batata frita.', 33.00, 15),
  ('Tropa de Elite', 'Marechal',
   'Pão, filé de boi, frango grelhado, bife de picanha, presunto, queijo, bacon, banana, calabresa, ovo, tomate, alface, milho, salada de legumes e batata frita.', 45.00, 16),
  ('Tropa de Elite', 'Coronel Burguer',
   'Pão, filé de boi, frango grelhado, cebola grelhada no shoyu, presunto, catupiry, bacon, banana, calabresa, ovo, tomate, alface, milho, salada de legumes e batata frita.', 45.00, 17),

  -- LANCHES TRADICIONAIS
  ('Lanches Tradicionais', 'Hambúrguer',
   'Pão, bife, tomate e alface.', 13.00, 1),
  ('Lanches Tradicionais', 'X Burguer',
   'Pão, bife, queijo, presunto, tomate e alface.', 15.00, 2),
  ('Lanches Tradicionais', 'X Bacon',
   'Pão, bife, queijo, bacon, tomate, alface, milho e batata palha.', 20.00, 3),
  ('Lanches Tradicionais', 'X Egg Bacon',
   'Pão, bife, queijo, bacon, ovo, tomate, alface, milho e batata palha.', 22.00, 4),
  ('Lanches Tradicionais', 'X Egg Burguer',
   'Pão, bife, presunto, queijo, ovo, tomate, alface, milho e batata palha.', 22.90, 5),
  ('Lanches Tradicionais', 'X Tudo',
   'Pão, bife, presunto, queijo, bacon, ovo, tomate, alface, milho e batata palha.', 25.00, 6),
  ('Lanches Tradicionais', 'X Duplo',
   'Pão, 2 carnes, presunto, queijo, bacon, 2 ovos, tomate, alface, milho e batata palha.', 30.00, 7),
  ('Lanches Tradicionais', 'X Triplo',
   'Pão, 3 carnes, presunto, queijo, bacon, 2 ovos, tomate, alface, milho e batata palha.', 36.00, 8),

  -- PIZZAS (8 fatias)
  ('Pizzas', 'Calabresa',
   'Molho de tomate, mussarela, calabresa, cebola e orégano.', 50.00, 1),
  ('Pizzas', 'Presunto',
   'Molho de tomate, mussarela, presunto e orégano.', 50.00, 2),
  ('Pizzas', 'Marguerita',
   'Molho de tomate, mussarela, tomate e manjericão.', 50.00, 3),
  ('Pizzas', 'Atum',
   'Molho de tomate, mussarela, atum e cebola.', 50.00, 4),
  ('Pizzas', 'Romana',
   'Atum, palmito, catupiry, mussarela, cebola, salsa e alho frito.', 62.00, 5),
  ('Pizzas', 'Portuguesa',
   'Molho de tomate, mussarela, presunto, ervilha, milho, palmito, bacon, ovo, calabresa, cebola, pimentão e orégano.', 62.00, 6),
  ('Pizzas', 'Frango com Catupiry',
   'Molho de tomate, mussarela, frango, milho, catupiry e orégano.', 62.00, 7),
  ('Pizzas', 'À Moda do Pizzaiolo',
   'Molho de tomate, mussarela, frango, milho, catupiry, bacon e orégano.', 66.00, 8),
  ('Pizzas', 'Quatro Queijos',
   'Molho de tomate, mussarela, parmesão, catupiry e gorgonzola.', 62.00, 9),
  ('Pizzas', 'Lombo Canadense',
   'Molho de tomate, mussarela, lombo, catupiry e cebola.', 62.00, 10),
  ('Pizzas', 'La Pergola',
   'Molho de tomate, atum, palmito, catupiry, mussarela, tomate, azeitona, alho frito e orégano.', 62.00, 11),
  ('Pizzas', 'Donateli',
   'Molho de tomate, mussarela, calabresa, catupiry e orégano.', 62.00, 12),

  -- PORCOES
  ('Porções', 'Batata Frita',
   '500g de batata frita.', 30.00, 1),
  ('Porções', 'Batata Frita com Cheddar e Bacon',
   '500g de batata frita com cheddar e bacon.', 50.00, 2),
  ('Porções', 'Frango com Batata Frita',
   '500g de frango com batata frita.', 55.00, 3),
  ('Porções', 'Frango Empanado com Batata Frita',
   '500g de frango empanado com batata frita.', 66.00, 4),
  ('Porções', 'Filé de Boi com Batata Frita',
   '500g de filé de boi com 500g de batata frita.', 85.00, 5),
  ('Porções', 'Linguiça Caseira com Batata Frita',
   '500g de linguiça caseira com batata frita.', 55.00, 6),
  ('Porções', 'Pernil de Porco com Batata Frita',
   '500g de pernil de porco com batata frita.', 55.00, 7),
  ('Porções', 'Porção Mista',
   '500g de frango, 500g de pernil de porco, 500g de linguiça, 500g de batata frita e 500g de polenta.', 155.00, 8)
) as p(categoria, nome, descricao, preco, ordem)
join categorias c on c.nome = p.categoria;

insert into adicionais (nome, preco, ordem) values
('Cebola',                 2.50,  1),
('Milho',                  1.50,  2),
('Banana',                 2.50,  3),
('Ovo',                    3.50,  4),
('Catupiry',               5.00,  5),
('Cheddar',                5.00,  6),
('Queijo',                 4.00,  7),
('Bacon',                  5.00,  8),
('Filé de Frango',         5.00,  9),
('Carne Artesanal 150g',  10.00, 10),
('Filé de Boi',           10.00, 11),
('Calabresa',              2.50, 12),
('Presunto',               3.00, 13),
('Bife de Hambúrguer 50g', 3.50, 14),
('Barbecue',               2.00, 15);

-- adicionais valem pros lanches; pizza e porcao ficam sem, como no cardapio
insert into produto_adicionais (produto_id, adicional_id)
select p.id, a.id
from produtos p
join categorias c on c.id = p.categoria_id
cross join adicionais a
where c.nome in ('Tropa de Elite', 'Lanches Tradicionais');

-- mesas 1 a 10 (cadastre ou desative as outras na tela Mesas e QR codes)
insert into mesas (numero)
select generate_series(1, 10);

commit;

-- Faz o PostgREST reler o schema na hora, sem esperar o cache expirar.
notify pgrst, 'reload schema';

-- Confere: tem que aparecer 5 categorias, 45 produtos, 15 adicionais e 10 mesas.
select
  (select count(*) from categorias)         as categorias,
  (select count(*) from produtos)           as produtos,
  (select count(*) from adicionais)         as adicionais,
  (select count(*) from produto_adicionais) as ligacoes_adicionais,
  (select count(*) from mesas)              as mesas,
  (select count(*) from perfis)             as logins;
