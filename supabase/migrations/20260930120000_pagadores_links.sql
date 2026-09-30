-- ════════════════════════════════════════════════════════════════════════
-- 1. Pagadores: quem pode pagar uma despesa.
--    "Caixa" é a empresa (única que mexe no caixa). Os demais — Cris,
--    Leandro, Geyson, Valor Marketing… — fazem aportes: a despesa conta no
--    resultado, mas não sai do caixa. A lista é editável em Configurações.
--
-- 2. Links de visualização: link secreto, somente leitura, que mostra a
--    Visão geral sem login. O banco guarda só o hash SHA-256 do código;
--    o link completo é exibido uma única vez para quem o cria.
-- ════════════════════════════════════════════════════════════════════════

-- ─── 1. Pagadores ──────────────────────────────────────────────────────
create table public.pagadores (
  nome      text primary key check (btrim(nome) <> '' and nome = btrim(nome)),
  ativo     boolean not null default true,
  ordem     smallint not null default 100,
  criado_em timestamptz not null default now()
);

comment on table public.pagadores is 'Quem pode pagar despesas. Só "Caixa" mexe no caixa; os demais são aportes.';

insert into public.pagadores (nome, ordem) values
  ('Caixa', 0),
  ('Cris', 1),
  ('Leandro', 2),
  ('Geyson', 3),
  ('Valor Marketing', 4);

-- A origem das despesas passa a apontar para a lista (renomear propaga).
alter table public.lancamentos drop constraint lancamentos_origem_recurso_check;
alter table public.lancamentos
  add constraint lancamentos_origem_recurso_fkey
  foreign key (origem_recurso) references public.pagadores (nome) on update cascade;

create index lancamentos_origem_recurso_idx on public.lancamentos (origem_recurso);

comment on column public.lancamentos.origem_recurso is 'Quem pagou a despesa (pagadores.nome). Só "Caixa" sai do caixa; receitas não têm origem.';

revoke all on table public.pagadores from anon, authenticated, public;
grant select, insert, update, delete on table public.pagadores to authenticated;

alter table public.pagadores enable row level security;

create policy "pagadores: membros com MFA leem"
  on public.pagadores for select to authenticated
  using ((select public.eh_membro_com_mfa()));

-- "Caixa" é fixo: não pode ser criado de novo, renomeado, desativado ou excluído.
create policy "pagadores: membros com MFA criam"
  on public.pagadores for insert to authenticated
  with check ((select public.eh_membro_com_mfa()) and nome <> 'Caixa');

create policy "pagadores: membros com MFA editam"
  on public.pagadores for update to authenticated
  using      ((select public.eh_membro_com_mfa()) and nome <> 'Caixa')
  with check ((select public.eh_membro_com_mfa()) and nome <> 'Caixa');

-- Quem já tem despesas não pode ser excluído (a chave estrangeira impede); desative.
create policy "pagadores: membros com MFA excluem"
  on public.pagadores for delete to authenticated
  using ((select public.eh_membro_com_mfa()) and nome <> 'Caixa');

-- ─── 2. Links de visualização ──────────────────────────────────────────
create table public.links_compartilhados (
  id               uuid primary key default gen_random_uuid(),
  nome             text not null check (btrim(nome) <> ''),
  -- SHA-256 (hex) do código do link. O código em si nunca é gravado.
  token_hash       text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  expira_em        timestamptz,
  revogado_em      timestamptz,
  ultimo_acesso_em timestamptz,
  acessos          integer not null default 0,
  criado_por       uuid references auth.users (id) on delete set null,
  criado_em        timestamptz not null default now()
);

comment on table public.links_compartilhados is 'Links secretos de visualização (somente leitura) da Visão geral.';

create function public.links_compartilhados_auditoria()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.criado_por       := auth.uid();
    new.criado_em        := now();
    new.acessos          := 0;
    new.ultimo_acesso_em := null;
  else
    -- Depois de criado, só o nome, a validade e a revogação mudam.
    new.token_hash       := old.token_hash;
    new.criado_por       := old.criado_por;
    new.criado_em        := old.criado_em;
  end if;
  return new;
end;
$$;

create trigger links_compartilhados_auditoria
  before insert or update on public.links_compartilhados
  for each row execute function public.links_compartilhados_auditoria();

revoke execute on function public.links_compartilhados_auditoria() from anon, authenticated, public;

revoke all on table public.links_compartilhados from anon, authenticated, public;
grant select, insert, update, delete on table public.links_compartilhados to authenticated;

alter table public.links_compartilhados enable row level security;

create policy "links: membros com MFA leem"
  on public.links_compartilhados for select to authenticated
  using ((select public.eh_membro_com_mfa()));

create policy "links: membros com MFA criam"
  on public.links_compartilhados for insert to authenticated
  with check ((select public.eh_membro_com_mfa()));

create policy "links: membros com MFA editam"
  on public.links_compartilhados for update to authenticated
  using      ((select public.eh_membro_com_mfa()))
  with check ((select public.eh_membro_com_mfa()));

create policy "links: membros com MFA excluem"
  on public.links_compartilhados for delete to authenticated
  using ((select public.eh_membro_com_mfa()));

-- Única porta de entrada para quem abre um link, sem login.
-- Valida o código e devolve SÓ o necessário para a Visão geral:
-- nada de cliente, corretor, produto, descrição, sócio ou item de custo.
create function public.visao_compartilhada(p_token text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_link public.links_compartilhados;
begin
  if p_token is null or length(p_token) < 32 or length(p_token) > 128 then
    return null;
  end if;

  select * into v_link
    from public.links_compartilhados
   where token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
     and revogado_em is null
     and (expira_em is null or expira_em > now());

  if not found then
    return null;
  end if;

  update public.links_compartilhados
     set ultimo_acesso_em = now(), acessos = acessos + 1
   where id = v_link.id;

  return jsonb_build_object(
    'nome', v_link.nome,
    'expira_em', v_link.expira_em,
    'configuracoes', (
      select jsonb_build_object(
        'comissao_percent', c.comissao_percent,
        'split_empresa_percent', c.split_empresa_percent,
        'imposto_nf_percent', c.imposto_nf_percent,
        'custo_fixo_estimado', c.custo_fixo_estimado,
        'comissao_media_esperada', c.comissao_media_esperada,
        'saldo_inicial_caixa', c.saldo_inicial_caixa
      )
      from public.configuracoes c
      where c.id
    ),
    'metas', coalesce(
      (select jsonb_agg(jsonb_build_object('ano', m.ano, 'meta_vgv', m.meta_vgv)) from public.metas_anuais m),
      '[]'::jsonb
    ),
    'lancamentos', coalesce(
      (select jsonb_agg(jsonb_build_object(
                'tipo', l.tipo,
                'categoria', l.categoria,
                'valor', l.valor,
                'data', l.data,
                'origem_recurso', l.origem_recurso,
                'vgv', l.vgv,
                'imposto_nf', l.imposto_nf
              ) order by l.data)
         from public.lancamentos l),
      '[]'::jsonb
    ),
    'propostas', coalesce(
      (select jsonb_agg(jsonb_build_object('status', p.status, 'vgv', p.vgv))
         from public.propostas p
        where p.status = 'negociacao'),
      '[]'::jsonb
    )
  );
end;
$$;

comment on function public.visao_compartilhada(text) is
  'Dados mínimos da Visão geral para um link de visualização válido (não revogado, não expirado).';

revoke execute on function public.visao_compartilhada(text) from public;
grant execute on function public.visao_compartilhada(text) to anon, authenticated;
