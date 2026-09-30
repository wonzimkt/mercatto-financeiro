/**
 * Lançamentos futuros: agenda do que já está lançado com data à frente,
 * séries (fixo mensal / parcelado) e caixa previsto. Lançamentos futuros são
 * lançamentos normais — entram no financeiro no mês de cada um.
 */
import { comSinal, mexeNoCaixa, type CaixaAgora } from "./calculos";
import { chaveMes, somarMesesData } from "./datas";
import { COMISSAO, MESES_FIXO, type Lancamento, type LancamentoEntrada, type Recorrencia } from "./tipos";

const centavos = (n: number) => Math.round(n * 100) / 100;

/**
 * Gera as ocorrências de uma série. `dataPrimeira` é a data da parcela 1:
 * todas as datas saem dela (dia 31 continua 31 depois de fevereiro).
 * `quantidade`: parcelas (parcelado) ou meses a agendar (fixo).
 * `inicioParcela`: para estender um fixo, continua a numeração.
 */
export function gerarSerie(
  base: LancamentoEntrada,
  recorrencia: Recorrencia,
  quantidade: number,
  serieId: string,
  inicioParcela = 1,
  dataPrimeira = base.data,
): LancamentoEntrada[] {
  return Array.from({ length: quantidade }, (_, i) => ({
    ...base,
    data: somarMesesData(dataPrimeira, inicioParcela - 1 + i),
    serie_id: serieId,
    recorrencia,
    parcela: inicioParcela + i,
    parcelas_total: recorrencia === "parcelado" ? quantidade : null,
  }));
}

/** Nome curto de um lançamento para listas. */
export function rotuloLancamento(l: Lancamento): string {
  if (l.categoria === COMISSAO) return [l.cliente, l.produto].filter(Boolean).join(" · ") || COMISSAO;
  return l.item_custo || (l.socio ? `Retirada · ${l.socio}` : "") || l.descricao || l.categoria;
}

/** "Fixo" ou "3/10". */
export function rotuloSerie(l: Pick<Lancamento, "recorrencia" | "parcela" | "parcelas_total">): string | null {
  if (!l.recorrencia) return null;
  return l.recorrencia === "fixo" ? "Fixo mensal" : `Parcela ${l.parcela}/${l.parcelas_total}`;
}

export interface ItemAgenda {
  lancamento: Lancamento;
  /** Caixa previsto logo após este lançamento; null quando não mexe no caixa (aporte). */
  caixaApos: number | null;
}

export interface MesAgenda {
  mes: string;
  entradas: number;
  saidasCaixa: number;
  aportes: number;
  caixaFim: number;
  itens: ItemAgenda[];
}

export interface Agenda {
  caixaInicial: number;
  meses: MesAgenda[];
  entradas: number;
  saidasCaixa: number;
  aportes: number;
  caixaFinal: number;
}

/**
 * Tudo que está lançado com data depois de hoje até `ate` (inclusive), em
 * ordem, com o caixa previsto a partir do caixa de hoje.
 */
export function agendaFutura(ls: Lancamento[], caixa: Pick<CaixaAgora, "saldo">, hoje: string, ate: string | null): Agenda {
  const futuros = ls
    .filter((l) => l.data > hoje && (ate === null || l.data <= ate))
    .sort((a, b) => a.data.localeCompare(b.data) || (a.tipo === b.tipo ? 0 : a.tipo === "receita" ? -1 : 1));

  let saldo = caixa.saldo;
  const meses: MesAgenda[] = [];
  for (const l of futuros) {
    const mes = chaveMes(l.data);
    let m = meses[meses.length - 1];
    if (!m || m.mes !== mes) {
      m = { mes, entradas: 0, saidasCaixa: 0, aportes: 0, caixaFim: saldo, itens: [] };
      meses.push(m);
    }
    let caixaApos: number | null = null;
    if (mexeNoCaixa(l)) {
      saldo = centavos(saldo + comSinal(l));
      caixaApos = saldo;
      if (l.tipo === "receita") m.entradas = centavos(m.entradas + l.valor);
      else m.saidasCaixa = centavos(m.saidasCaixa + l.valor);
    } else {
      m.aportes = centavos(m.aportes + l.valor);
    }
    m.caixaFim = saldo;
    m.itens.push({ lancamento: l, caixaApos });
  }

  return {
    caixaInicial: caixa.saldo,
    meses,
    entradas: centavos(meses.reduce((s, m) => s + m.entradas, 0)),
    saidasCaixa: centavos(meses.reduce((s, m) => s + m.saidasCaixa, 0)),
    aportes: centavos(meses.reduce((s, m) => s + m.aportes, 0)),
    caixaFinal: saldo,
  };
}

export interface ResumoSerie {
  serieId: string;
  recorrencia: Recorrencia;
  nome: string;
  tipo: Lancamento["tipo"];
  categoria: Lancamento["categoria"];
  origem: string | null;
  /** Valor da próxima ocorrência (ou da última, se já acabou) */
  valor: number;
  proxima: Lancamento | null;
  primeira: Lancamento;
  ultima: Lancamento;
  /** Ocorrências ainda por vir (data > hoje) */
  restantes: number;
  total: number;
  /** Fixos que acabam em até 3 meses: hora de estender */
  acabando: boolean;
}

export function resumoSeries(ls: Lancamento[], hoje: string): ResumoSerie[] {
  const grupos = new Map<string, Lancamento[]>();
  for (const l of ls) {
    if (!l.serie_id) continue;
    const g = grupos.get(l.serie_id) ?? [];
    g.push(l);
    grupos.set(l.serie_id, g);
  }
  const limiteAviso = somarMesesData(hoje, 3);
  return [...grupos.entries()]
    .map(([serieId, g]) => {
      g.sort((a, b) => a.data.localeCompare(b.data));
      const futuros = g.filter((l) => l.data > hoje);
      const primeira = g[0];
      const ultima = g[g.length - 1];
      const proxima = futuros[0] ?? null;
      const recorrencia = (ultima.recorrencia ?? "fixo") as Recorrencia;
      return {
        serieId,
        recorrencia,
        nome: rotuloLancamento(ultima),
        tipo: ultima.tipo,
        categoria: ultima.categoria,
        origem: ultima.origem_recurso,
        valor: (proxima ?? ultima).valor,
        proxima,
        primeira,
        ultima,
        restantes: futuros.length,
        total: recorrencia === "parcelado" ? (ultima.parcelas_total ?? g.length) : g.length,
        acabando: recorrencia === "fixo" && ultima.data <= limiteAviso,
      };
    })
    .sort((a, b) => (a.proxima?.data ?? "9999").localeCompare(b.proxima?.data ?? "9999") || a.nome.localeCompare(b.nome, "pt-BR"));
}

/**
 * Próximas ocorrências para estender um fixo por mais `meses` meses.
 * Os valores vêm da última ocorrência (ex.: aluguel reajustado); as datas,
 * da primeira (mantém o dia do mês original).
 */
export function extensaoFixo(s: Pick<ResumoSerie, "primeira" | "ultima">, meses = MESES_FIXO): LancamentoEntrada[] {
  const { id: _id, criado_por: _cp, criado_em: _ce, atualizado_em: _ae, ...base } = s.ultima;
  const numero = s.ultima.parcela ?? 1;
  const primeira = s.primeira.parcela ?? 1;
  return gerarSerie(base, "fixo", meses, s.ultima.serie_id!, numero + 1, somarMesesData(s.primeira.data, 1 - primeira));
}
