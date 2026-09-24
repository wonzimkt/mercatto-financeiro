-- ════════════════════════════════════════════════════════════════════════
-- Segunda trava: além de MFA (aal2), só membros autorizados da Mercatto.
--
-- Sem isto, se o cadastro público estiver ligado no Supabase, qualquer
-- pessoa poderia criar uma conta, cadastrar o próprio TOTP e passar no RLS.
-- A marca `mercatto_membro` fica em app_metadata, que o usuário NÃO consegue
-- alterar (só a service role ou SQL no painel).
--
-- Autorizar alguém (Supabase → SQL Editor):
--   select public.autorizar_membro('pessoa@mercatto.com.br');
-- Revogar:
--   select public.revogar_membro('pessoa@mercatto.com.br');
-- A mudança vale a partir do próximo login / renovação do token.
-- ════════════════════════════════════════════════════════════════════════

create function public.eh_membro_com_mfa()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(auth.jwt() ->> 'aal' = 'aal2', false)
     and coalesce((auth.jwt() -> 'app_metadata' ->> 'mercatto_membro')::boolean, false);
$$;

comment on function public.eh_membro_com_mfa() is
  'true quando a sessão passou pelo MFA e o usuário foi autorizado (app_metadata.mercatto_membro).';

grant execute on function public.eh_membro_com_mfa() to authenticated;
revoke execute on function public.eh_membro_com_mfa() from anon, public;

-- ─── Recria as políticas com as duas condições ─────────────────────────
drop policy "lancamentos: ler com MFA"      on public.lancamentos;
drop policy "lancamentos: criar com MFA"    on public.lancamentos;
drop policy "lancamentos: editar com MFA"   on public.lancamentos;
drop policy "lancamentos: excluir com MFA"  on public.lancamentos;
drop policy "configuracoes: ler com MFA"    on public.configuracoes;
drop policy "configuracoes: editar com MFA" on public.configuracoes;

create policy "lancamentos: membros com MFA leem"
  on public.lancamentos for select to authenticated
  using ((select public.eh_membro_com_mfa()));

create policy "lancamentos: membros com MFA criam"
  on public.lancamentos for insert to authenticated
  with check ((select public.eh_membro_com_mfa()));

create policy "lancamentos: membros com MFA editam"
  on public.lancamentos for update to authenticated
  using      ((select public.eh_membro_com_mfa()))
  with check ((select public.eh_membro_com_mfa()));

create policy "lancamentos: membros com MFA excluem"
  on public.lancamentos for delete to authenticated
  using ((select public.eh_membro_com_mfa()));

create policy "configuracoes: membros com MFA leem"
  on public.configuracoes for select to authenticated
  using ((select public.eh_membro_com_mfa()));

create policy "configuracoes: membros com MFA editam"
  on public.configuracoes for update to authenticated
  using      ((select public.eh_membro_com_mfa()))
  with check ((select public.eh_membro_com_mfa()));

-- ─── Autorizar / revogar (só pelo SQL Editor ou service role) ──────────
create function public.autorizar_membro(email_membro text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  alvo uuid;
begin
  update auth.users
     set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"mercatto_membro": true}'::jsonb
   where lower(email) = lower(btrim(email_membro))
  returning id into alvo;
  if alvo is null then
    raise exception 'Nenhum usuário com o e-mail %', email_membro;
  end if;
  return 'Autorizado: ' || email_membro || ' (vale no próximo login)';
end;
$$;

create function public.revogar_membro(email_membro text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  alvo uuid;
begin
  update auth.users
     set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) - 'mercatto_membro'
   where lower(email) = lower(btrim(email_membro))
  returning id into alvo;
  if alvo is null then
    raise exception 'Nenhum usuário com o e-mail %', email_membro;
  end if;
  return 'Revogado: ' || email_membro || ' (vale quando o token atual expirar)';
end;
$$;

-- Ninguém pela API pode chamar essas funções; só o dono do banco (SQL Editor).
revoke execute on function public.autorizar_membro(text) from anon, authenticated, public;
revoke execute on function public.revogar_membro(text)   from anon, authenticated, public;
