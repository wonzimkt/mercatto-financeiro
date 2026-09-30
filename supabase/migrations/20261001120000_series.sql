-- ════════════════════════════════════════════════════════════════════════
-- Lançamentos futuros em série
--
-- Lançamentos com data futura já entram no financeiro no mês de cada um.
-- Para organizar os que se repetem, cada ocorrência de uma série aponta
-- para o mesmo `serie_id`:
--   • fixo:      repete todo mês (ex.: aluguel), sem número de parcelas;
--                o sistema agenda 12 meses e permite estender ou encerrar
--   • parcelado: N parcelas mensais (parcela / parcelas_total)
-- ════════════════════════════════════════════════════════════════════════

alter table public.lancamentos
  add column serie_id       uuid,
  add column recorrencia    text check (recorrencia in ('fixo', 'parcelado')),
  add column parcela        smallint check (parcela >= 1),
  add column parcelas_total smallint check (parcelas_total between 1 and 360);

alter table public.lancamentos add constraint lancamentos_serie_consistente check (
  (serie_id is null and recorrencia is null and parcela is null and parcelas_total is null)
  or (
    serie_id is not null and parcela is not null and (
      (recorrencia = 'parcelado' and parcelas_total is not null and parcela <= parcelas_total)
      or (recorrencia = 'fixo' and parcelas_total is null)
    )
  )
);

comment on column public.lancamentos.serie_id is 'Agrupa as ocorrências de um lançamento que se repete (fixo mensal ou parcelado).';
comment on column public.lancamentos.recorrencia is 'fixo = todo mês, sem fim definido; parcelado = parcelas_total parcelas mensais.';
comment on column public.lancamentos.parcela is 'Número da ocorrência dentro da série (1, 2, 3…).';

create index lancamentos_serie_idx on public.lancamentos (serie_id, data) where serie_id is not null;
