/**
 * Todos os números do painel saem daqui. Funções puras: recebem os
 * lançamentos e as configurações, devolvem valores — sem banco, sem React.
 * Assim cada regra de negócio tem um lugar só e um teste.
 */
import {
  CATEGORIAS_DESPESA,
  COMISSAO,
  ORIGENS,
  RETIRADA,
  type CategoriaDespesa,
  type Configuracoes,
  type Lancamento,
  type Origem,
} from "./tipos";
import { chaveMes, dentroDe, listaMeses, somarMeses, ultimosMeses } from "./datas";

// ─── Utilitários ────────────────────────────────────────────────────────

const centavos = (n: number) => Math.round(n * 100) / 100;
const media = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export const ehVenda = (l: Lancamento) => l.categoria === COMISSAO;
export const ehRetirada = (l: Lancamento) => l.categoria === RETIRADA;
/** Despesa operacional: toda despesa, menos retirada de sócios. */
export const ehOperacional = (l: Lancamento) => l.tipo === "despesa" && l.categoria !== RETIRADA;

/** Valor com sinal: receita soma, despesa subtrai. */
export const comSinal = (l: Lancamento) => (l.tipo === "receita" ? l.valor : -l.valor);

/** Variação relativa. `null` quando não há base de comparação. */
export function variacao(atual: number, anterior: number): number | null {
  if (!anterior) return null;
  return (atual - anterior) / Math.abs(anterior);
}

export function primeiroMesComDados(ls: Lancamento[]): string | null {
  let min: string | null = null;
  for (const l of ls) if (min === null || l.data < min) min = l.data;
  return min ? chaveMes(min) : null;
}

export function noPeriodo(ls: Lancamento[], inicio: string, fim: string) {
  return ls.filter((l) => dentroDe(l.data, inicio, fim));
}

// ─── Agregação mensal ───────────────────────────────────────────────────

export interface TotaisOrigem {
  receita: number;
  despesa: number;
  resultado: number;
}

export interface MesAgregado {
  mes: string;
  receita: number;
  despesa: number;
  /** receita − despesa (inclui retiradas) */
  resultado: number;
  comissoes: number;
  vendas: number;
  operacional: number;
  retiradas: number;
  porCategoria: Record<CategoriaDespesa, number>;
  origem: Record<Origem, TotaisOrigem>;
}

function mesVazio(mes: string): MesAgregado {
  return {
    mes,
    receita: 0,
    despesa: 0,
    resultado: 0,
    comissoes: 0,
    vendas: 0,
    operacional: 0,
    retiradas: 0,
    porCategoria: Object.fromEntries(CATEGORIAS_DESPESA.map((c) => [c, 0])) as Record<CategoriaDespesa, number>,
    origem: Object.fromEntries(ORIGENS.map((o) => [o, { receita: 0, despesa: 0, resultado: 0 }])) as Record<
      Origem,
      TotaisOrigem
    >,
  };
}

export function agregarPorMes(ls: Lancamento[]): Map<string, MesAgregado> {
  const mapa = new Map<string, MesAgregado>();
  for (const l of ls) {
    const k = chaveMes(l.data);
    const m = mapa.get(k) ?? mesVazio(k);
    const o = m.origem[l.origem_recurso];
    if (l.tipo === "receita") {
      m.receita += l.valor;
      o.receita += l.valor;
      if (ehVenda(l)) {
        m.comissoes += l.valor;
        m.vendas += 1;
      }
    } else {
      m.despesa += l.valor;
      o.despesa += l.valor;
      m.porCategoria[l.categoria as CategoriaDespesa] += l.valor;
      if (ehRetirada(l)) m.retiradas += l.valor;
      else m.operacional += l.valor;
    }
    mapa.set(k, m);
  }
  for (const m of mapa.values()) {
    m.resultado = centavos(m.receita - m.despesa);
    for (const o of ORIGENS) m.origem[o].resultado = centavos(m.origem[o].receita - m.origem[o].despesa);
  }
  return mapa;
}

export interface PontoSerie extends MesAgregado {
  /** Caixa acumulado ao fim do mês (saldos iniciais + todo o histórico). */
  acumulado: number;
  acumuladoOrigem: Record<Origem, number>;
}

/** Série mensal com saldos acumulados, para qualquer lista de meses. */
export function serieMensal(ls: Lancamento[], cfg: Configuracoes, meses: string[]): PontoSerie[] {
  const mapa = agregarPorMes(ls);
  const chaves = [...mapa.keys()].sort();
  const inicial: Record<Origem, number> = { Caixa: cfg.saldo_inicial_caixa, Cris: cfg.saldo_inicial_cris };

  return meses.map((mes) => {
    const acumuladoOrigem = { ...inicial };
    for (const k of chaves) {
      if (k > mes) break;
      const m = mapa.get(k)!;
      for (const o of ORIGENS) acumuladoOrigem[o] += m.origem[o].resultado;
    }
    for (const o of ORIGENS) acumuladoOrigem[o] = centavos(acumuladoOrigem[o]);
    return {
      ...(mapa.get(mes) ?? mesVazio(mes)),
      acumulado: centavos(acumuladoOrigem.Caixa + acumuladoOrigem.Cris),
      acumuladoOrigem,
    };
  });
}

// ─── Visão geral do mês ─────────────────────────────────────────────────

export interface ResumoMes {
  atual: PontoSerie;
  anterior: PontoSerie;
  variacao: {
    receita: number | null;
    despesa: number | null;
    resultado: number | null;
    acumulado: number | null;
  };
}

export function resumoMes(ls: Lancamento[], cfg: Configuracoes, mes: string): ResumoMes {
  const [anterior, atual] = serieMensal(ls, cfg, [somarMeses(mes, -1), mes]);
  return {
    atual,
    anterior,
    variacao: {
      receita: variacao(atual.receita, anterior.receita),
      despesa: variacao(atual.despesa, anterior.despesa),
      resultado: variacao(atual.resultado, anterior.resultado),
      acumulado: variacao(atual.acumulado, anterior.acumulado),
    },
  };
}

// ─── Ponto de equilíbrio ────────────────────────────────────────────────

/**
 * De onde veio um número de referência:
 * - realizado: o próprio mês já tem esse valor lançado
 * - historico: média dos meses anteriores com lançamentos
 * - estimado:  valor digitado em Configurações (falta histórico)
 * - sem-dados: nem histórico nem estimativa
 */
export type Fonte = "realizado" | "historico" | "estimado" | "sem-dados";

export interface Referencia {
  valor: number;
  fonte: Fonte;
  /** Quantos meses de histórico entraram na média. */
  mesesHistorico: number;
}

/** Mínimo de meses anteriores para confiar na média em vez da estimativa. */
export const MIN_MESES_HISTORICO = 2;
/** Mínimo de vendas nos últimos 12 meses para confiar na comissão média. */
export const MIN_VENDAS_HISTORICO = 3;

function mediaOperacional(ls: Lancamento[], cfg: Configuracoes, mes: string, janela: number): Referencia {
  const mapa = agregarPorMes(ls);
  const primeiro = primeiroMesComDados(ls);
  const anteriores = Array.from({ length: janela }, (_, i) => somarMeses(mes, -(i + 1))).filter(
    (m) => primeiro !== null && m >= primeiro,
  );
  const mediaHist = media(anteriores.map((m) => mapa.get(m)?.operacional ?? 0));

  if (anteriores.length >= MIN_MESES_HISTORICO && mediaHist > 0)
    return { valor: centavos(mediaHist), fonte: "historico", mesesHistorico: anteriores.length };
  if (cfg.custo_fixo_estimado > 0)
    return { valor: cfg.custo_fixo_estimado, fonte: "estimado", mesesHistorico: anteriores.length };
  if (mediaHist > 0) return { valor: centavos(mediaHist), fonte: "historico", mesesHistorico: anteriores.length };
  return { valor: 0, fonte: "sem-dados", mesesHistorico: anteriores.length };
}

/**
 * Custo operacional de referência do mês (sem retiradas).
 * Mês já encerrado: o que foi lançado. Mês em curso: o maior entre o já
 * lançado e a média dos 3 meses anteriores (ou a estimativa), porque as
 * contas do mês ainda estão chegando.
 */
export function custoOperacionalDoMes(
  ls: Lancamento[],
  cfg: Configuracoes,
  mes: string,
  mesCorrente: string,
): Referencia & { realizado: number } {
  const realizado = centavos(agregarPorMes(ls).get(mes)?.operacional ?? 0);
  const base = mediaOperacional(ls, cfg, mes, 3);
  if (mes < mesCorrente && realizado > 0) return { ...base, valor: realizado, fonte: "realizado", realizado };
  if (realizado >= base.valor && realizado > 0) return { ...base, valor: realizado, fonte: "realizado", realizado };
  return { ...base, realizado };
}

/** Comissão líquida média por venda nos 12 meses até `mes`. */
export function comissaoMedia(ls: Lancamento[], cfg: Configuracoes, mes: string): Referencia & { vendas: number } {
  const inicio = somarMeses(mes, -11);
  const vendas = ls.filter((l) => ehVenda(l) && chaveMes(l.data) >= inicio && chaveMes(l.data) <= mes);
  const mediaHist = media(vendas.map((v) => v.valor));
  const base = { vendas: vendas.length, mesesHistorico: 12 };

  if (vendas.length >= MIN_VENDAS_HISTORICO) return { ...base, valor: centavos(mediaHist), fonte: "historico" };
  if (cfg.comissao_media_esperada > 0) return { ...base, valor: cfg.comissao_media_esperada, fonte: "estimado" };
  if (vendas.length) return { ...base, valor: centavos(mediaHist), fonte: "historico" };
  return { ...base, valor: 0, fonte: "sem-dados" };
}

export interface PontoEquilibrio {
  custo: ReturnType<typeof custoOperacionalDoMes>;
  comissaoMedia: ReturnType<typeof comissaoMedia>;
  /** null quando não há comissão média para dividir */
  vendasNecessarias: number | null;
  vendasFechadas: number;
  comissoesDoMes: number;
  faltam: number | null;
  /** comissões do mês ÷ custo (1 = equilíbrio) */
  cobertura: number | null;
}

/**
 * custo operacional do mês ÷ comissão média por venda = vendas necessárias.
 * Retirada de sócios nunca entra: é distribuição de lucro, não custo.
 */
export function pontoEquilibrio(ls: Lancamento[], cfg: Configuracoes, mes: string, mesCorrente: string): PontoEquilibrio {
  const custo = custoOperacionalDoMes(ls, cfg, mes, mesCorrente);
  const cm = comissaoMedia(ls, cfg, mes);
  const doMes = agregarPorMes(ls).get(mes);
  const vendasFechadas = doMes?.vendas ?? 0;
  const comissoesDoMes = centavos(doMes?.comissoes ?? 0);

  const vendasNecessarias = custo.valor === 0 ? 0 : cm.valor > 0 ? Math.ceil(custo.valor / cm.valor) : null;

  return {
    custo,
    comissaoMedia: cm,
    vendasNecessarias,
    vendasFechadas,
    comissoesDoMes,
    faltam: vendasNecessarias === null ? null : Math.max(0, vendasNecessarias - vendasFechadas),
    cobertura: custo.valor > 0 ? comissoesDoMes / custo.valor : null,
  };
}

// ─── Reserva de caixa ───────────────────────────────────────────────────

export interface Reserva {
  caixa: number;
  custoMedio: Referencia;
  meta: number;
  /** caixa ÷ meta; null sem meta definida */
  progresso: number | null;
  /** quantos meses de custo o caixa cobre */
  mesesCobertos: number | null;
}

/** Caixa acumulado (Caixa + Cris) vs. custo operacional médio × meses-alvo. */
export function reserva(ls: Lancamento[], cfg: Configuracoes, mes: string): Reserva {
  const [ponto] = serieMensal(ls, cfg, [mes]);
  const custoMedio = mediaOperacional(ls, cfg, mes, 6);
  const meta = centavos(custoMedio.valor * cfg.reserva_meses_alvo);
  return {
    caixa: ponto.acumulado,
    custoMedio,
    meta,
    progresso: meta > 0 ? ponto.acumulado / meta : null,
    mesesCobertos: custoMedio.valor > 0 ? ponto.acumulado / custoMedio.valor : null,
  };
}

export function serieReserva(ls: Lancamento[], cfg: Configuracoes, meses: string[]) {
  const serie = serieMensal(ls, cfg, meses);
  return serie.map((p) => {
    const custoMedio = mediaOperacional(ls, cfg, p.mes, 6);
    return { mes: p.mes, acumulado: p.acumulado, meta: centavos(custoMedio.valor * cfg.reserva_meses_alvo) };
  });
}

// ─── Projeção ───────────────────────────────────────────────────────────

export interface Projecao {
  base: { meses: string[]; receitaMedia: number; despesaMedia: number; fonte: Fonte };
  saldoPartida: number;
  pontos: { mes: string; receita: number; despesa: number; resultado: number; acumulado: number }[];
}

/**
 * Média móvel simples dos últimos `janela` meses encerrados, projetada para
 * os `n` meses seguintes ao mês corrente, a partir do caixa atual.
 * Sem histórico, usa o custo estimado e nenhuma receita (cenário prudente).
 */
export function projecao(ls: Lancamento[], cfg: Configuracoes, mesCorrente: string, n = 3, janela = 3): Projecao {
  const primeiro = primeiroMesComDados(ls);
  const fechados = ultimosMeses(somarMeses(mesCorrente, -1), janela).filter((m) => primeiro !== null && m >= primeiro);
  const serie = serieMensal(ls, cfg, [...fechados, mesCorrente]);
  const historico = serie.slice(0, -1);
  const saldoPartida = serie[serie.length - 1].acumulado;

  const temHistorico = historico.length > 0;
  const receitaMedia = temHistorico ? centavos(media(historico.map((p) => p.receita))) : 0;
  const despesaMedia = temHistorico ? centavos(media(historico.map((p) => p.despesa))) : cfg.custo_fixo_estimado;
  const fonte: Fonte = temHistorico ? "historico" : cfg.custo_fixo_estimado > 0 ? "estimado" : "sem-dados";

  let acumulado = saldoPartida;
  const pontos = Array.from({ length: n }, (_, i) => {
    const resultado = centavos(receitaMedia - despesaMedia);
    acumulado = centavos(acumulado + resultado);
    return { mes: somarMeses(mesCorrente, i + 1), receita: receitaMedia, despesa: despesaMedia, resultado, acumulado };
  });

  return { base: { meses: fechados, receitaMedia, despesaMedia, fonte }, saldoPartida, pontos };
}

// ─── Vendas & corretores ────────────────────────────────────────────────

export const NAO_INFORMADO = "Não informado";

export function vendasNoPeriodo(ls: Lancamento[], inicio: string, fim: string) {
  return ls
    .filter((l) => ehVenda(l) && dentroDe(l.data, inicio, fim))
    .sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0));
}

export interface Grupo {
  nome: string;
  total: number;
  qtd: number;
  /** total ÷ qtd */
  ticket: number;
  /** fatia do total geral (0–1) */
  participacao: number;
}

type CampoTexto = "corretor" | "cliente" | "produto" | "cidade" | "socio" | "categoria";

/** Soma por um campo de texto, do maior para o menor. */
export function agruparPor(ls: Lancamento[], campo: CampoTexto): Grupo[] {
  const mapa = new Map<string, { total: number; qtd: number }>();
  let geral = 0;
  for (const l of ls) {
    const nome = (l[campo] as string | null)?.trim() || NAO_INFORMADO;
    const g = mapa.get(nome) ?? { total: 0, qtd: 0 };
    g.total += l.valor;
    g.qtd += 1;
    geral += l.valor;
    mapa.set(nome, g);
  }
  return [...mapa.entries()]
    .map(([nome, g]) => ({
      nome,
      total: centavos(g.total),
      qtd: g.qtd,
      ticket: centavos(g.total / g.qtd),
      participacao: geral ? g.total / geral : 0,
    }))
    .sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, "pt-BR"));
}

export function ticketMedioPorMes(ls: Lancamento[], meses: string[]) {
  const mapa = agregarPorMes(ls);
  return meses.map((mes) => {
    const m = mapa.get(mes);
    const qtd = m?.vendas ?? 0;
    return { mes, qtd, total: centavos(m?.comissoes ?? 0), ticket: qtd ? centavos(m!.comissoes / qtd) : null };
  });
}

// ─── Despesas ───────────────────────────────────────────────────────────

export function despesasPorCategoriaMes(ls: Lancamento[], meses: string[]) {
  const mapa = agregarPorMes(ls);
  return meses.map((mes) => {
    const m = mapa.get(mes);
    const linha: { mes: string; total: number } & Record<CategoriaDespesa, number> = {
      mes,
      total: centavos(m?.despesa ?? 0),
      ...(Object.fromEntries(
        CATEGORIAS_DESPESA.map((c) => [c, centavos(m?.porCategoria[c] ?? 0)]),
      ) as Record<CategoriaDespesa, number>),
    };
    return linha;
  });
}

export function despesasPorCategoria(ls: Lancamento[], inicio: string, fim: string): Grupo[] {
  const despesas = ls.filter((l) => l.tipo === "despesa" && dentroDe(l.data, inicio, fim));
  return agruparPor(despesas, "categoria");
}

export function maioresDespesas(ls: Lancamento[], inicio: string, fim: string, n = 10) {
  return ls
    .filter((l) => l.tipo === "despesa" && dentroDe(l.data, inicio, fim))
    .sort((a, b) => b.valor - a.valor || (a.data < b.data ? 1 : -1))
    .slice(0, n);
}

// ─── Sócios ─────────────────────────────────────────────────────────────

export function retiradasNoPeriodo(ls: Lancamento[], inicio: string, fim: string) {
  return ls
    .filter((l) => ehRetirada(l) && dentroDe(l.data, inicio, fim))
    .sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0));
}

/** Meses do primeiro lançamento até `fim` (mínimo `min` meses). */
export function mesesDoHistorico(ls: Lancamento[], fim: string, min = 12): string[] {
  const primeiro = primeiroMesComDados(ls);
  const inicioMin = somarMeses(fim, -(min - 1));
  const inicio = primeiro && primeiro < inicioMin ? primeiro : inicioMin;
  return listaMeses(inicio, fim);
}

// ─── Autocomplete ───────────────────────────────────────────────────────

export function valoresUsados(ls: Lancamento[], campo: Exclude<CampoTexto, "categoria">): string[] {
  const vistos = new Map<string, string>();
  for (const l of ls) {
    const v = l[campo]?.trim();
    if (v && !vistos.has(v.toLocaleLowerCase("pt-BR"))) vistos.set(v.toLocaleLowerCase("pt-BR"), v);
  }
  return [...vistos.values()].sort((a, b) => a.localeCompare(b, "pt-BR"));
}
