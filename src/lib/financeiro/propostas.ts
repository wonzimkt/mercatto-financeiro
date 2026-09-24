/**
 * Propostas em negociação. Servem só para acompanhar o funil: nada aqui
 * entra no caixa, no resultado ou na meta — isso só acontece quando a
 * venda é lançada como "Comissão de Venda".
 */
import { calcularComissao } from "./calculos";
import type { Configuracoes, Proposta } from "./tipos";

const DIA = 86_400_000;

/** Dias entre duas datas AAAA-MM-DD (b − a). */
export function diasEntre(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DIA);
}

/** Há quantos dias a proposta está (ou ficou) em negociação. */
export function diasEmNegociacao(p: Proposta, hoje: string): number {
  return Math.max(0, diasEntre(p.data, p.encerrada_em ?? hoje));
}

/** Líquido que ficaria com a Mercatto se a proposta fechar, pelos percentuais padrão. */
export function liquidoPotencial(vgv: number, cfg: Configuracoes): number {
  return calcularComissao({
    vgv,
    comissaoPercent: cfg.comissao_percent,
    splitPercent: cfg.split_empresa_percent,
    impostoPercent: cfg.imposto_nf_percent,
  }).liquidoMercatto;
}

export interface ResumoPropostas {
  emNegociacao: number;
  vgvEmNegociacao: number;
  liquidoPotencial: number;
  /** Média de dias das propostas ainda em negociação */
  diasMedios: number | null;
  /** Propostas paradas há mais de `diasAlerta` dias */
  paradas: number;
  /** fechadas ÷ (fechadas + perdidas) encerradas nos últimos 12 meses; null sem base */
  conversao: number | null;
  fechadas12m: number;
  perdidas12m: number;
}

export const DIAS_ALERTA = 30;

export function resumoPropostas(ps: Proposta[], cfg: Configuracoes, hoje: string): ResumoPropostas {
  const abertas = ps.filter((p) => p.status === "negociacao");
  const vgvEmNegociacao = abertas.reduce((s, p) => s + p.vgv, 0);
  const dias = abertas.map((p) => diasEmNegociacao(p, hoje));

  const limite = new Date(Date.parse(`${hoje}T00:00:00Z`) - 365 * DIA).toISOString().slice(0, 10);
  const encerradas = ps.filter((p) => p.status !== "negociacao" && (p.encerrada_em ?? "") >= limite);
  const fechadas12m = encerradas.filter((p) => p.status === "fechada").length;
  const perdidas12m = encerradas.length - fechadas12m;

  return {
    emNegociacao: abertas.length,
    vgvEmNegociacao: Math.round(vgvEmNegociacao * 100) / 100,
    liquidoPotencial: Math.round(abertas.reduce((s, p) => s + liquidoPotencial(p.vgv, cfg), 0) * 100) / 100,
    diasMedios: dias.length ? Math.round(dias.reduce((a, b) => a + b, 0) / dias.length) : null,
    paradas: dias.filter((d) => d > DIAS_ALERTA).length,
    conversao: encerradas.length ? fechadas12m / encerradas.length : null,
    fechadas12m,
    perdidas12m,
  };
}

/** VGV em negociação por corretor, do maior para o menor. */
export function negociacaoPorCorretor(ps: Proposta[]) {
  const mapa = new Map<string, { nome: string; vgv: number; qtd: number }>();
  for (const p of ps) {
    if (p.status !== "negociacao") continue;
    const chave = p.corretor.trim().toLocaleLowerCase("pt-BR");
    const g = mapa.get(chave) ?? { nome: p.corretor.trim(), vgv: 0, qtd: 0 };
    g.vgv += p.vgv;
    g.qtd += 1;
    mapa.set(chave, g);
  }
  return [...mapa.values()].sort((a, b) => b.vgv - a.vgv);
}
