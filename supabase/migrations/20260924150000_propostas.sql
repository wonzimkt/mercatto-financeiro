-- ════════════════════════════════════════════════════════════════════════
-- Propostas em negociação
--
-- Controle das negociações em andamento. NÃO entra no financeiro: a receita
-- só existe quando a venda é concretizada e vira um lançamento de
-- "Comissão de Venda" (a proposta passa a apontar para ele).
-- ════════════════════════════════════════════════════════════════════════

create table public.propostas (
  id             uuid primary key default gen_random_uuid(),
  -- Data em que a proposta foi enviada para negociação
  data           date not null,
  vgv            numeric(16, 2) not null check (vgv > 0),
  corretor       text not null check (btrim(corretor) <> ''),
  produto        text not null check (btrim(produto) <> ''),
  cliente        text,
  cidade         text,
  observacao     text,
  status         text not null default 'negociacao' check (status in ('negociacao', 'fechada', 'perdida')),
  -- Quando saiu de negociação (fechada ou perdida)
  encerrada_em   date,
  motivo_perda   text,
  -- Lançamento de comissão gerado quando a proposta virou venda
  lancamento_id  uuid references public.lancamentos (id) on delete set null,

  criado_por     uuid references auth.users (id) on delete set null,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),

  constraint propostas_encerramento check (
    (status = 'negociacao' and encerrada_em is null)
    or (status <> 'negociacao' and encerrada_em is not null)
  ),
  constraint propostas_motivo_so_se_perdida check (motivo_perda is null or status = 'perdida')
);

comment on table public.propostas is 'Propostas enviadas para negociação. Não afetam o financeiro até virarem venda.';

create index propostas_status_data_idx on public.propostas (status, data);

-- Mesma auditoria dos lançamentos: criado_por/criado_em/atualizado_em não podem ser forjados.
create trigger propostas_auditoria
  before insert or update on public.propostas
  for each row execute function public.lancamentos_auditoria();

revoke all on table public.propostas from anon, authenticated, public;
grant select, insert, update, delete on table public.propostas to authenticated;

alter table public.propostas enable row level security;

create policy "propostas: membros com MFA leem"
  on public.propostas for select to authenticated
  using ((select public.eh_membro_com_mfa()));

create policy "propostas: membros com MFA criam"
  on public.propostas for insert to authenticated
  with check ((select public.eh_membro_com_mfa()));

create policy "propostas: membros com MFA editam"
  on public.propostas for update to authenticated
  using      ((select public.eh_membro_com_mfa()))
  with check ((select public.eh_membro_com_mfa()));

create policy "propostas: membros com MFA excluem"
  on public.propostas for delete to authenticated
  using ((select public.eh_membro_com_mfa()));
