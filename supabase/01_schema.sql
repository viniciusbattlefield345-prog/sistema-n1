-- =====================================================================
-- N1 Restaurante e Choperia - Schema (Supabase / PostgreSQL)
-- Rode este arquivo inteiro no SQL Editor do Supabase.
-- =====================================================================

-- ---------------------------------------------------------------------
-- PERFIS  (complementa auth.users - a senha fica no Supabase Auth)
-- ---------------------------------------------------------------------
create table perfis (
  id          uuid primary key references auth.users(id) on delete cascade,
  nome        text not null,
  papel       text not null default 'atendente'
              check (papel in ('dono','atendente','cozinha')),
  ativo       boolean not null default true,
  criado_em   timestamptz not null default now()
);

-- cria o perfil sozinho quando um usuario nasce no Auth
create or replace function public.criar_perfil()
returns trigger
language plpgsql
security definer set search_path = public
as $fn$
begin
  insert into public.perfis (id, nome)
  values (new.id, coalesce(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1)));
  return new;
end $fn$;

create trigger ao_criar_usuario
  after insert on auth.users
  for each row execute function public.criar_perfil();

-- ---------------------------------------------------------------------
-- CARDAPIO
-- ---------------------------------------------------------------------
create table categorias (
  id     bigint generated always as identity primary key,
  nome   text not null,
  ordem  int not null default 0,
  ativo  boolean not null default true
);

create table produtos (
  id            bigint generated always as identity primary key,
  categoria_id  bigint references categorias(id) on delete set null,
  nome          text not null,
  descricao     text,
  preco_base    numeric(10,2) not null default 0 check (preco_base >= 0),
  custo         numeric(10,2) check (custo >= 0),   -- pra calcular margem
  ativo         boolean not null default true,      -- some do cardapio
  disponivel    boolean not null default true,      -- "acabou hoje"
  ordem         int not null default 0,
  criado_em     timestamptz not null default now()
);
create index on produtos (categoria_id);

-- tamanhos: Chopp 300ml / 500ml / Caneca, Porcao meia / inteira
create table produto_variacoes (
  id          bigint generated always as identity primary key,
  produto_id  bigint not null references produtos(id) on delete cascade,
  nome        text not null,
  preco       numeric(10,2) not null default 0 check (preco >= 0),
  ordem       int not null default 0
);
create index on produto_variacoes (produto_id);

-- catalogo unico de adicionais (antes vivia duplicado dentro de cada produto)
create table adicionais (
  id     bigint generated always as identity primary key,
  nome   text not null unique,
  preco  numeric(10,2) not null default 0 check (preco >= 0),
  ativo  boolean not null default true
);

-- quais adicionais valem pra qual produto (preco nulo = usa o do catalogo)
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
-- telefone e a chave natural do delivery: nao deixa cadastrar o mesmo cliente duas vezes
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
-- garante no banco que so existe UM caixa aberto por vez
create unique index caixa_unico_aberto on caixas (status) where status = 'ABERTO';

-- ---------------------------------------------------------------------
-- PEDIDOS
-- ---------------------------------------------------------------------
create table pedidos (
  id                bigint generated always as identity primary key,
  numero_dia        int,                                   -- #01, #02... reinicia todo dia
  caixa_id          bigint references caixas(id) on delete set null,
  usuario_id        uuid references auth.users(id) on delete set null,
  cliente_id        bigint references clientes(id) on delete set null,
  cliente_nome      text not null,
  cliente_telefone  text,
  tipo_entrega      text not null default 'ENTREGA'
                    check (tipo_entrega in ('ENTREGA','RETIRADA')),
  endereco_entrega  text,
  taxa_entrega      numeric(10,2) not null default 0 check (taxa_entrega >= 0),
  subtotal          numeric(10,2) not null default 0,
  desconto          numeric(10,2) not null default 0 check (desconto >= 0),
  total             numeric(10,2) not null default 0,
  forma_pagamento   text check (forma_pagamento in
                      ('Dinheiro','Pix','Cartao Credito','Cartao Debito')),
  troco_para        numeric(10,2) check (troco_para >= 0),
  status            text not null default 'PENDENTE' check (status in
                      ('PENDENTE','EM PREPARO','PRONTO','SAIU PARA ENTREGA',
                       'CONCLUIDO','CANCELADO')),
  observacao        text,
  criado_em         timestamptz not null default now(),
  atualizado_em     timestamptz not null default now()
);
create index on pedidos (status);
create index on pedidos (criado_em desc);
create index on pedidos (caixa_id);
create index on pedidos (cliente_id);

create table itens_pedido (
  id              bigint generated always as identity primary key,
  pedido_id       bigint not null references pedidos(id) on delete cascade,
  produto_id      bigint references produtos(id) on delete set null,  -- guarda o ID de verdade
  variacao_id     bigint references produto_variacoes(id) on delete set null,
  produto_nome    text not null,      -- foto do nome na hora da venda
  variacao_nome   text,
  quantidade      numeric(10,3) not null default 1 check (quantidade > 0),
  preco_unitario  numeric(10,2) not null check (preco_unitario >= 0),
  observacao      text                -- campo proprio, nao mais colado no nome
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
-- CONFIGURACAO (nome, endereco, impressoras, horario)
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

create or replace function public.trg_recalcular_item()
returns trigger language plpgsql as $fn$
begin
  perform public.recalcular_total(coalesce(new.pedido_id, old.pedido_id));
  return null;
end $fn$;

create trigger item_recalcula
  after insert or update or delete on itens_pedido
  for each row execute function public.trg_recalcular_item();

create or replace function public.trg_recalcular_adicional()
returns trigger language plpgsql as $fn$
declare v_pedido bigint;
begin
  select pedido_id into v_pedido
    from itens_pedido where id = coalesce(new.item_id, old.item_id);
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

-- ---------------------------------------------------------------------
-- RELATORIOS  (agrupa por produto_id, nao mais por texto)
-- ---------------------------------------------------------------------
-- security_invoker: sem isso a view roda como dona e PULA a RLS das tabelas
-- de baixo — quem nao esta logado conseguiria ler o faturamento por ela.
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
where ped.status <> 'CANCELADO'
group by i.produto_id, coalesce(p.nome, i.produto_nome), c.nome,
         date_trunc('day', ped.criado_em at time zone 'America/Sao_Paulo');

-- ---------------------------------------------------------------------
-- SEGURANCA (RLS) - so quem esta logado enxerga qualquer coisa
-- ---------------------------------------------------------------------
do $rls$
declare t text;
begin
  foreach t in array array[
    'perfis','categorias','produtos','produto_variacoes','adicionais',
    'produto_adicionais','bairros','clientes','caixas','pedidos',
    'itens_pedido','item_adicionais','configuracoes'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy acesso_equipe on %I for all to authenticated using (true) with check (true)', t);
  end loop;
end $rls$;

-- Quem nao fez login (papel anon) nao recebe permissao nenhuma:
-- as politicas acima valem so pra 'authenticated'.
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on vw_vendas_produto to authenticated;

-- Faz o PostgREST reler o schema na hora, sem esperar o cache expirar.
notify pgrst, 'reload schema';
