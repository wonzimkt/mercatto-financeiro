-- ════════════════════════════════════════════════════════════════════════
-- Ajustes de 24/09/2026
--  1. Origem do recurso (Caixa/Cris) só existe em despesas.
--  2. Comissão calculada a partir do VGV: comissão total, split Mercatto,
--     split corretor e imposto sobre a NF (descontado do split Mercatto).
--  3. Despesas ganham "item de custo" (qual custo é, além da categoria).
--  4. Metas anuais de VGV vendido.
--  5. Configurações: sai a reserva de caixa e o saldo inicial da Cris;
--     entram % de comissão e % de imposto sobre a NF.
-- ════════════════════════════════════════════════════════════════════════

-- ─── 1. Origem só em despesas ──────────────────────────────────────────
alter table public.lancamentos alter column origem_recurso drop not null;

alter table public.lancamentos add constraint lancamentos_origem_so_em_despesa check (
  (tipo = 'despesa' and origem_recurso is not null)
  or (tipo = 'receita' and origem_recurso is null)
);

-- ─── 2. Comissão a partir do VGV ───────────────────────────────────────
alter table public.lancamentos
  add column vgv                numeric(16, 2) check (vgv is null or vgv > 0),
  add column comissao_percent   numeric(5, 2)  check (comissao_percent is null or comissao_percent between 0 and 100),
  add column imposto_nf_percent numeric(5, 2)  check (imposto_nf_percent is null or imposto_nf_percent between 0 and 100),
  add column imposto_nf         numeric(14, 2) check (imposto_nf is null or imposto_nf >= 0);

comment on column public.lancamentos.vgv is 'Valor Geral de Venda do imóvel (comissões).';
comment on column public.lancamentos.comissao_bruta is 'Comissão total da venda = VGV × comissao_percent.';
comment on column public.lancamentos.split_empresa_percent is 'Parte da comissão total que é da Mercatto (%).';
comment on column public.lancamentos.imposto_nf is 'Imposto sobre a NF, descontado do split da Mercatto.';
comment on column public.lancamentos.valor is 'Valor positivo. Em comissões, o líquido da Mercatto (split − imposto NF).';

alter table public.lancamentos add constraint lancamentos_comissao_tem_vgv check (
  categoria <> 'Comissão de Venda' or vgv is not null
);

-- ─── 3. Item de custo ──────────────────────────────────────────────────
alter table public.lancamentos
  add column item_custo text;

comment on column public.lancamentos.item_custo is 'Qual custo é (ex.: aluguel, contador), além da categoria. Só em despesas.';

alter table public.lancamentos add constraint lancamentos_item_so_em_despesa check (
  item_custo is null or tipo = 'despesa'
);

-- ─── 4. Metas anuais ───────────────────────────────────────────────────
create table public.metas_anuais (
  ano            integer primary key check (ano between 2000 and 2100),
  meta_vgv       numeric(16, 2) not null check (meta_vgv >= 0),
  atualizado_em  timestamptz not null default now(),
  atualizado_por uuid references auth.users (id) on delete set null
);

comment on table public.metas_anuais is 'Meta de VGV vendido por ano.';

create function public.metas_anuais_auditoria()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.atualizado_em  := now();
  new.atualizado_por := auth.uid();
  return new;
end;
$$;

create trigger metas_anuais_auditoria
  before insert or update on public.metas_anuais
  for each row execute function public.metas_anuais_auditoria();

revoke execute on function public.metas_anuais_auditoria() from anon, authenticated, public;

revoke all on table public.metas_anuais from anon, authenticated, public;
grant select, insert, update, delete on table public.metas_anuais to authenticated;

alter table public.metas_anuais enable row level security;

create policy "metas: membros com MFA leem"
  on public.metas_anuais for select to authenticated
  using ((select public.eh_membro_com_mfa()));

create policy "metas: membros com MFA criam"
  on public.metas_anuais for insert to authenticated
  with check ((select public.eh_membro_com_mfa()));

create policy "metas: membros com MFA editam"
  on public.metas_anuais for update to authenticated
  using      ((select public.eh_membro_com_mfa()))
  with check ((select public.eh_membro_com_mfa()));

create policy "metas: membros com MFA excluem"
  on public.metas_anuais for delete to authenticated
  using ((select public.eh_membro_com_mfa()));

-- ─── 5. Configurações ──────────────────────────────────────────────────
alter table public.configuracoes
  drop column reserva_meses_alvo,
  drop column saldo_inicial_cris,
  add column comissao_percent   numeric(5, 2) not null default 5 check (comissao_percent between 0 and 100),
  add column imposto_nf_percent numeric(5, 2) not null default 6 check (imposto_nf_percent between 0 and 100);

comment on column public.configuracoes.split_empresa_percent is 'Parte da comissão total que fica com a Mercatto (%). 50 = 2,5% de um VGV com comissão de 5%.';
comment on column public.configuracoes.comissao_percent is 'Comissão total sobre o VGV (%).';
comment on column public.configuracoes.imposto_nf_percent is 'Imposto sobre a NF, aplicado ao split da Mercatto (%).';
