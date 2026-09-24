/**
 * Todos os números do painel saem daqui. Funções puras: recebem os
 * lançamentos e as configurações, devolvem valores — sem banco, sem React.
 * Assim cada regra de negócio tem um lugar só e um teste.
 *
 * Modelo de caixa: toda receita entra no Caixa da empresa. Despesas têm
 * origem — as pagas pelo Caixa saem dele; as pagas pela Cris NÃO saem do
 * caixa e são somadas à parte ("bancado pela Cris"). No resultado do mês
 * (receita − despesa) todas as despesas contam, independente de quem pagou.
 */
import {
  CATEGORIAS_DESPESA,
  COMISSAO,
  RETIRADA,
  type CategoriaDespesa,
  type Configuracoes,
  type Lancamento,
} from "./tipos";
import { chaveMes, dentroDe, listaMeses, somarMeses, ultimosMeses } from "./datas";

// ─── Utilitários ────────────────────────────────────────────────────────

const centavos = (n: number) => Math.round(n * 100) / 100;
const media = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export const ehVenda = (l: Lancamento) => l.categoria === COMISSAO;
export const ehRetirada = (l: Lancamento) => l.categoria === RETIRADA;
/** Despesa operacional: toda despesa, menos retirada de sócios. */
export const ehOperacional = (l: Lancamento) => l.tipo === "despesa" && l.categoria !== RETIRADA;
/** Movimenta o caixa: receitas (entram) e despesas pagas pelo Caixa (saem). */
export const mexeNoCaixa = (l: Lancamento) => l.tipo === "receita" || l.origem_recurso === "Caixa";

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

// ─── Calculadora de comissão ────────────────────────────────────────────

export interface ParametrosComissao {
  vgv: number;
  /** Comissão total sobre o VGV (%), ex.: 5 */
  comissaoPercent: number;
  /** Parte da comissão que é da Mercatto (%), ex.: 50 */
  splitPercent: number;
  /** Imposto sobre a NF, sobre o split da Mercatto (%), ex.: 6 */
  impostoPercent: number;
}

export interface Comissao {
  comissaoTotal: number;
  splitMercatto: number;
  splitCorretor: number;
  impostoNf: number;
  /** O que fica com a Mercatto: split − imposto. É o valor da receita. */
  liquidoMercatto: number;
}

/**
 * VGV → comissão total → split Mercatto / split corretor → imposto da NF
 * (só sobre o split da Mercatto) → líquido da Mercatto.
 * Cada etapa é arredondada ao centavo; o corretor fica com a diferença,
 * para as partes sempre somarem a comissão total.
 */
export function calcularComissao(p: ParametrosComissao): Comissao {
  const comissaoTotal = centavos((p.vgv * p.comissaoPercent) / 100);
  const splitMercatto = centavos((comissaoTotal * p.splitPercent) / 100);
  const splitCorretor = centavos(comissaoTotal - splitMercatto);
  const impostoNf = centavos((splitMercatto * p.impostoPercent) / 100);
  return { comissaoTotal, splitMercatto, splitCorretor, impostoNf, liquidoMercatto: centavos(splitMercatto - impostoNf) };
}

// ─── Agregação mensal ───────────────────────────────────────────────────

export interface MesAgregado {
  mes: string;
  receita: number;
  despesa: number;
  /** receita − despesa (inclui retiradas e despesas pagas pela Cris) */
  resultado: number;
  comissoes: number;
  vendas: number;
  vgv: number;
  impostoNf: number;
  operacional: number;
  retiradas: number;
  porCategoria: Record<CategoriaDespesa, number>;
  /** Despesas pagas pelo Caixa */
  despesaCaixa: number;
  /** Despesas pagas pela Cris (não saem do caixa) */
  despesaCris: number;
  /** Variação do caixa no mês: receita − despesaCaixa */
  fluxoCaixa: number;
}

function mesVazio(mes: string): MesAgregado {
  return {
    mes,
    receita: 0,
    despesa: 0,
    resultado: 0,
    comissoes: 0,
    vendas: 0,
    vgv: 0,
    impostoNf: 0,
    operacional: 0,
    retiradas: 0,
    porCategoria: Object.fromEntries(CATEGORIAS_DESPESA.map((c) => [c, 0])) as Record<CategoriaDespesa, number>,
    despesaCaixa: 0,
    despesaCris: 0,
    fluxoCaixa: 0,
  };
}

export function agregarPorMes(ls: Lancamento[]): Map<string, MesAgregado> {
  const mapa = new Map<string, MesAgregado>();
  for (const l of ls) {
    const k = chaveMes(l.data);
    const m = mapa.get(k) ?? mesVazio(k);
    if (l.tipo === "receita") {
      m.receita += l.valor;
      if (ehVenda(l)) {
        m.comissoes += l.valor;
        m.vendas += 1;
        m.vgv += l.vgv ?? 0;
        m.impostoNf += l.imposto_nf ?? 0;
      }
    } else {
      m.despesa += l.valor;
      m.porCategoria[l.categoria as CategoriaDespesa] += l.valor;
      if (ehRetirada(l)) m.retiradas += l.valor;
      else m.operacional += l.valor;
      if (l.origem_recurso === "Cris") m.despesaCris += l.valor;
      else m.despesaCaixa += l.valor;
    }
    mapa.set(k, m);
  }
  for (const m of mapa.values()) {
    m.resultado = centavos(m.receita - m.despesa);
    m.fluxoCaixa = centavos(m.receita - m.despesaCaixa);
  }
  return mapa;
}

export interface PontoSerie extends MesAgregado {
  /** Caixa ao fim do mês: saldo inicial + receitas − despesas pagas pelo Caixa. */
  caixa: number;
  /** Total bancado pela Cris até o fim do mês. */
  bancadoCris: number;
}

/** Série mensal com caixa acumulado, para qualquer lista de meses. */
export function serieMensal(ls: Lancamento[], cfg: Configuracoes, meses: string[]): PontoSerie[] {
  const mapa = agregarPorMes(ls);
  const chaves = [...mapa.keys()].sort();

  return meses.map((mes) => {
    let caixa = cfg.saldo_inicial_caixa;
    let bancadoCris = 0;
    for (const k of chaves) {
      if (k > mes) break;
      const m = mapa.get(k)!;
      caixa += m.fluxoCaixa;
      bancadoCris += m.despesaCris;
    }
    return { ...(mapa.get(mes) ?? mesVazio(mes)), caixa: centavos(caixa), bancadoCris: centavos(bancadoCris) };
  });
}

// ─── Caixa agora ────────────────────────────────────────────────────────

export interface CaixaAgora {
  /** Saldo do caixa hoje (lançamentos com data até hoje). */
  saldo: number;
  /** Lançamentos com data futura já registrados, que ainda vão mexer no caixa. */
  aVencer: number;
  /** Total pago pela Cris até hoje (não saiu do caixa). */
  bancadoCris: number;
}

export function caixaAgora(ls: Lancamento[], cfg: Configuracoes, hoje: string): CaixaAgora {
  let saldo = cfg.saldo_inicial_caixa;
  let aVencer = 0;
  let bancadoCris = 0;
  for (const l of ls) {
    const futuro = l.data > hoje;
    if (mexeNoCaixa(l)) {
      if (futuro) aVencer += comSinal(l);
      else saldo += comSinal(l);
    } else if (!futuro) {
      bancadoCris += l.valor;
    }
  }
  return { saldo: centavos(saldo), aVencer: centavos(aVencer), bancadoCris: centavos(bancadoCris) };
}

// ─── Visão geral do mês ─────────────────────────────────────────────────

export interface ResumoMes {
  atual: PontoSerie;
  anterior: PontoSerie;
  variacao: {
    receita: number | null;
    despesa: number | null;
    resultado: number | null;
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

// ─── Meta anual de VGV ──────────────────────────────────────────────────

export interface ProgressoMeta {
  ano: number;
  meta: number;
  alcancado: number;
  vendas: number;
  /** alcançado ÷ meta; null sem meta */
  progresso: number | null;
  falta: number;
  /** Quanto deveria ter sido vendido até hoje num ritmo linear; null fora do ano corrente */
  esperadoAteHoje: number | null;
  /** VGV acumulado mês a mês, com a meta proporcional (ritmo linear) */
  serie: { mes: string; alcancado: number | null; meta: number }[];
}

export function progressoMeta(ls: Lancamento[], ano: number, meta: number, hoje: string): ProgressoMeta {
  const vendas = ls.filter((l) => ehVenda(l) && l.data.startsWith(`${ano}-`));
  const alcancado = centavos(vendas.reduce((s, v) => s + (v.vgv ?? 0), 0));
  const mesHoje = chaveMes(hoje);

  let acumulado = 0;
  const serie = listaMeses(`${ano}-01`, `${ano}-12`).map((mes, i) => {
    acumulado += vendas.filter((v) => chaveMes(v.data) === mes).reduce((s, v) => s + (v.vgv ?? 0), 0);
    return { mes, alcancado: mes <= mesHoje ? centavos(acumulado) : null, meta: centavos((meta * (i + 1)) / 12) };
  });

  let esperadoAteHoje: number | null = null;
  if (hoje.startsWith(`${ano}-`)) {
    const inicio = Date.UTC(ano, 0, 1);
    const fim = Date.UTC(ano + 1, 0, 1);
    const [a, m, d] = hoje.split("-").map(Number);
    const fracao = (Date.UTC(a, m - 1, d) - inicio + 86_400_000) / (fim - inicio);
    esperadoAteHoje = centavos(meta * fracao);
  }

  return {
    ano,
    meta,
    alcancado,
    vendas: vendas.length,
    progresso: meta > 0 ? alcancado / meta : null,
    falta: centavos(Math.max(0, meta - alcancado)),
    esperadoAteHoje,
    serie,
  };
}

// ─── Projeção ───────────────────────────────────────────────────────────

export interface Projecao {
  base: { meses: string[]; receitaMedia: number; saidaMedia: number; fonte: Fonte };
  saldoPartida: number;
  pontos: { mes: string; receita: number; saida: number; resultado: number; caixa: number }[];
}

/**
 * Média móvel simples dos últimos `janela` meses encerrados (entradas e
 * saídas do caixa), projetada para os `n` meses seguintes ao mês corrente,
 * a partir do caixa ao fim do mês corrente. Sem histórico, usa o custo
 * estimado e nenhuma receita (cenário prudente).
 */
export function projecao(ls: Lancamento[], cfg: Configuracoes, mesCorrente: string, n = 3, janela = 3): Projecao {
  const primeiro = primeiroMesComDados(ls);
  const fechados = ultimosMeses(somarMeses(mesCorrente, -1), janela).filter((m) => primeiro !== null && m >= primeiro);
  const serie = serieMensal(ls, cfg, [...fechados, mesCorrente]);
  const historico = serie.slice(0, -1);
  const saldoPartida = serie[serie.length - 1].caixa;

  const temHistorico = historico.length > 0;
  const receitaMedia = temHistorico ? centavos(media(historico.map((p) => p.receita))) : 0;
  const saidaMedia = temHistorico ? centavos(media(historico.map((p) => p.despesaCaixa))) : cfg.custo_fixo_estimado;
  const fonte: Fonte = temHistorico ? "historico" : cfg.custo_fixo_estimado > 0 ? "estimado" : "sem-dados";

  let caixa = saldoPartida;
  const pontos = Array.from({ length: n }, (_, i) => {
    const resultado = centavos(receitaMedia - saidaMedia);
    caixa = centavos(caixa + resultado);
    return { mes: somarMeses(mesCorrente, i + 1), receita: receitaMedia, saida: saidaMedia, resultado, caixa };
  });

  return { base: { meses: fechados, receitaMedia, saidaMedia, fonte }, saldoPartida, pontos };
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
  /** soma do VGV (só faz sentido em vendas) */
  vgv: number;
}

type CampoTexto = "corretor" | "cliente" | "produto" | "cidade" | "socio" | "categoria" | "item_custo";

/** Chave de agrupamento: ignora maiúsculas e espaços nas pontas ("Aluguel" = " aluguel "). */
export const chaveTexto = (v: string | null | undefined) => v?.trim().toLocaleLowerCase("pt-BR") || "";

/** Soma por um campo de texto, do maior para o menor. Usa a primeira grafia vista como nome. */
export function agruparPor(ls: Lancamento[], campo: CampoTexto): Grupo[] {
  const mapa = new Map<string, { nome: string; total: number; qtd: number; vgv: number }>();
  let geral = 0;
  for (const l of ls) {
    const texto = l[campo] as string | null;
    const chave = chaveTexto(texto);
    const g = mapa.get(chave) ?? { nome: texto?.trim() || NAO_INFORMADO, total: 0, qtd: 0, vgv: 0 };
    g.total += l.valor;
    g.qtd += 1;
    g.vgv += l.vgv ?? 0;
    geral += l.valor;
    mapa.set(chave, g);
  }
  return [...mapa.values()]
    .map((g) => ({
      nome: g.nome,
      total: centavos(g.total),
      qtd: g.qtd,
      ticket: centavos(g.total / g.qtd),
      participacao: geral ? g.total / geral : 0,
      vgv: centavos(g.vgv),
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

/** Despesas do período agrupadas por item de custo (qual custo é). */
export function despesasPorItem(ls: Lancamento[], inicio: string, fim: string) {
  const despesas = ls.filter((l) => l.tipo === "despesa" && !ehRetirada(l) && dentroDe(l.data, inicio, fim));
  return agruparPor(despesas, "item_custo").map((g) => ({
    ...g,
    categorias: [
      ...new Set(
        despesas
          .filter((d) => chaveTexto(d.item_custo) === (g.nome === NAO_INFORMADO ? "" : chaveTexto(g.nome)))
          .map((d) => d.categoria),
      ),
    ],
  }));
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
