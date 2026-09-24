-- ════════════════════════════════════════════════════════════════════════
-- Mercatto · Controle financeiro — schema inicial
--
-- Segurança: o front-end é estático (GitHub Pages) e fala direto com o
-- Supabase usando a chave pública. Por isso TODA a proteção está aqui:
--   • RLS ligado em todas as tabelas;
--   • o papel `anon` não tem permissão nenhuma;
--   • o papel `authenticated` só lê/grava quando o JWT tem aal = 'aal2',
--     ou seja, login por senha + código TOTP verificado nesta sessão.
-- Um usuário logado só com senha (aal1) não enxerga uma linha sequer.
-- ════════════════════════════════════════════════════════════════════════

-- ─── Lançamentos ────────────────────────────────────────────────────────
create table public.lancamentos (
  id                    uuid primary key default gen_random_uuid(),
  tipo                  text not null check (tipo in ('receita', 'despesa')),
  categoria             text not null,
  -- Sempre positivo; o sinal vem do tipo. Para "Comissão de Venda" é o
  -- valor líquido que fica com a empresa (depois do repasse ao corretor).
  valor                 numeric(14, 2) not null check (valor > 0),
  data                  date not null,
  descricao             text,
  origem_recurso        text not null check (origem_recurso in ('Caixa', 'Cris')),

  -- Campos condicionais
  corretor              text,
  cliente               text,
  produto               text,  -- imóvel / empreendimento
  cidade                text,
  socio                 text,

  -- Memória de cálculo da comissão (preenchida pela calculadora do
  -- formulário): comissão total recebida e % que ficou com a empresa.
  comissao_bruta        numeric(14, 2) check (comissao_bruta is null or comissao_bruta > 0),
  split_empresa_percent numeric(5, 2)  check (split_empresa_percent is null or split_empresa_percent between 0 and 100),

  criado_por            uuid references auth.users (id) on delete set null,
  criado_em             timestamptz not null default now(),
  atualizado_em         timestamptz not null default now(),

  constraint lancamentos_categoria_valida check (
    (tipo = 'receita' and categoria in ('Comissão de Venda', 'Outra Receita'))
    or
    (tipo = 'despesa' and categoria in ('Custo Fixo', 'Imposto', 'Retirada de Sócios', 'Marketing', 'Outro'))
  ),
  constraint lancamentos_comissao_tem_corretor check (
    categoria <> 'Comissão de Venda' or nullif(btrim(corretor), '') is not null
  ),
  constraint lancamentos_retirada_tem_socio check (
    categoria <> 'Retirada de Sócios' or nullif(btrim(socio), '') is not null
  )
);

comment on table  public.lancamentos is 'Livro-razão da Mercatto: toda receita e despesa, uma linha por lançamento.';
comment on column public.lancamentos.valor is 'Valor positivo. Em comissões, o líquido da empresa.';
comment on column public.lancamentos.origem_recurso is 'De onde o dinheiro entrou/saiu: Caixa da empresa ou conta da Cris.';

create index lancamentos_data_idx           on public.lancamentos (data);
create index lancamentos_categoria_data_idx on public.lancamentos (categoria, data);

-- Autoria e datas não podem ser forjadas pelo cliente.
create function public.lancamentos_auditoria()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.criado_por    := auth.uid();
    new.criado_em     := now();
    new.atualizado_em := now();
  else
    new.criado_por    := old.criado_por;
    new.criado_em     := old.criado_em;
    new.atualizado_em := now();
  end if;
  return new;
end;
$$;

create trigger lancamentos_auditoria
  before insert or update on public.lancamentos
  for each row execute function public.lancamentos_auditoria();

-- ─── Configurações (linha única) ────────────────────────────────────────
create table public.configuracoes (
  id                      boolean primary key default true check (id),
  split_empresa_percent   numeric(5, 2)  not null default 50 check (split_empresa_percent between 0 and 100),
  reserva_meses_alvo      integer        not null default 6  check (reserva_meses_alvo between 0 and 60),
  custo_fixo_estimado     numeric(14, 2) not null default 0  check (custo_fixo_estimado >= 0),
  comissao_media_esperada numeric(14, 2) not null default 0  check (comissao_media_esperada >= 0),
  saldo_inicial_caixa     numeric(14, 2) not null default 0,
  saldo_inicial_cris      numeric(14, 2) not null default 0,
  atualizado_em           timestamptz    not null default now(),
  atualizado_por          uuid references auth.users (id) on delete set null
);

comment on table public.configuracoes is 'Parâmetros do painel. Sempre exatamente uma linha (id = true).';

insert into public.configuracoes (id) values (true) on conflict (id) do nothing;

create function public.configuracoes_auditoria()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.id             := true;
  new.atualizado_em  := now();
  new.atualizado_por := auth.uid();
  return new;
end;
$$;

create trigger configuracoes_auditoria
  before update on public.configuracoes
  for each row execute function public.configuracoes_auditoria();

-- ─── Permissões ─────────────────────────────────────────────────────────
revoke all on table public.lancamentos   from anon, authenticated, public;
revoke all on table public.configuracoes from anon, authenticated, public;

grant select, insert, update, delete on table public.lancamentos   to authenticated;
grant select, update                 on table public.configuracoes to authenticated;

revoke execute on function public.lancamentos_auditoria()   from anon, authenticated, public;
revoke execute on function public.configuracoes_auditoria() from anon, authenticated, public;

-- ─── RLS: só usuários autenticados COM MFA verificado ───────────────────
alter table public.lancamentos   enable row level security;
alter table public.configuracoes enable row level security;

create policy "lancamentos: ler com MFA"
  on public.lancamentos for select to authenticated
  using ((select auth.jwt() ->> 'aal') = 'aal2');

create policy "lancamentos: criar com MFA"
  on public.lancamentos for insert to authenticated
  with check ((select auth.jwt() ->> 'aal') = 'aal2');

create policy "lancamentos: editar com MFA"
  on public.lancamentos for update to authenticated
  using      ((select auth.jwt() ->> 'aal') = 'aal2')
  with check ((select auth.jwt() ->> 'aal') = 'aal2');

create policy "lancamentos: excluir com MFA"
  on public.lancamentos for delete to authenticated
  using ((select auth.jwt() ->> 'aal') = 'aal2');

create policy "configuracoes: ler com MFA"
  on public.configuracoes for select to authenticated
  using ((select auth.jwt() ->> 'aal') = 'aal2');

create policy "configuracoes: editar com MFA"
  on public.configuracoes for update to authenticated
  using      ((select auth.jwt() ->> 'aal') = 'aal2')
  with check ((select auth.jwt() ->> 'aal') = 'aal2');
