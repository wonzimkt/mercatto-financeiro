-- ════════════════════════════════════════════════════════════════════════
-- Link de visualização passa a mostrar também o Dashboard.
--
-- Campos novos entregues ao link (além dos da Visão geral):
--   lançamentos: corretor (Top corretores) e item_custo (Maiores custos)
--   propostas:   todas as situações, com data, encerramento e corretor
--                (VGV em negociação por corretor e taxa de conversão)
-- Continuam fora: cliente, produto, cidade, descrição, sócio e observações.
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.visao_compartilhada(p_token text)
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
                'imposto_nf', l.imposto_nf,
                'corretor', l.corretor,
                'item_custo', l.item_custo
              ) order by l.data)
         from public.lancamentos l),
      '[]'::jsonb
    ),
    'propostas', coalesce(
      (select jsonb_agg(jsonb_build_object(
                'status', p.status,
                'vgv', p.vgv,
                'data', p.data,
                'encerrada_em', p.encerrada_em,
                'corretor', p.corretor
              ))
         from public.propostas p),
      '[]'::jsonb
    )
  );
end;
$$;

comment on function public.visao_compartilhada(text) is
  'Dados mínimos da Visão geral e do Dashboard para um link de visualização válido (não revogado, não expirado).';

revoke execute on function public.visao_compartilhada(text) from public;
grant execute on function public.visao_compartilhada(text) to anon, authenticated;
