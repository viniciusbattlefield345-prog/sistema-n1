-- =====================================================================
-- Promove o primeiro usuario a DONO.
-- Rode DEPOIS de criar o usuario em Authentication > Users.
-- Troque o e-mail pelo que voce cadastrou.
-- =====================================================================

update perfis
   set papel = 'dono',
       nome  = 'Vinicius'
 where id = (select id from auth.users where email = 'TROQUE@AQUI.COM');

-- Confere se deu certo: tem que aparecer papel = dono
select p.nome, p.papel, u.email
  from perfis p
  join auth.users u on u.id = p.id;
