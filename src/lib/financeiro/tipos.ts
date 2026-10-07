export const TIPOS = ["receita", "despesa"] as const;
export type Tipo = (typeof TIPOS)[number];

export const COMISSAO = "Comissão de Venda";
export const RETIRADA = "Retirada de Sócios";

export const CATEGORIAS_RECEITA = [COMISSAO, "Outra Receita"] as const;
export const CATEGORIAS_DESPESA = [
  "Custo Fixo",
  "Imposto",
  RETIRADA,
  "Marketing",
  "Outro",
] as const;

export type CategoriaReceita = (typeof CATEGORIAS_RECEITA)[number];
export type CategoriaDespesa = (typeof CATEGORIAS_DESPESA)[number];
export type Categoria = CategoriaReceita | CategoriaDespesa;

export const CATEGORIAS: Record<Tipo, readonly Categoria[]> = {
  receita: CATEGORIAS_RECEITA,
  despesa: CATEGORIAS_DESPESA,
};

/**
 * Despesas que entram no custo operacional (ponto de equilíbrio, reserva).
 * "Retirada de Sócios" fica de fora: é distribuição de lucro, não custo.
 */
export const CATEGORIAS_OPERACIONAIS: readonly CategoriaDespesa[] =
  CATEGORIAS_DESPESA.filter((c) => c !== RETIRADA);

/**
 * Quem pagou uma despesa. "Caixa" é a empresa e é o único que mexe no caixa;
 * os demais (Cris, Leandro, Geyson, Valor Marketing…) são aportes: a despesa
 * conta no resultado, mas não sai do caixa. A lista fica na tabela
 * `pagadores` e é editável em Configurações.
 */
export const CAIXA = "Caixa";
export type Origem = string;

export interface Pagador {
  nome: string;
  ativo: boolean;
  ordem: number;
}

export const PAGADORES_PADRAO: Pagador[] = [
  { nome: CAIXA, ativo: true, ordem: 0 },
  { nome: "Cris", ativo: true, ordem: 1 },
  { nome: "Leandro", ativo: true, ordem: 2 },
  { nome: "Geyson", ativo: true, ordem: 3 },
  { nome: "Valor Marketing", ativo: true, ordem: 4 },
];

/** fixo = todo mês (ex.: aluguel); parcelado = N parcelas mensais. */
export type Recorrencia = "fixo" | "parcelado";

/** Quantos meses um lançamento fixo é agendado de cada vez. */
export const MESES_FIXO = 12;

export interface Lancamento {
  id: string;
  tipo: Tipo;
  categoria: Categoria;
  /** Sempre positivo. Em comissões, o líquido da Mercatto (split − imposto NF). */
  valor: number;
  /** AAAA-MM-DD */
  data: string;
  descricao: string | null;
  /** Só em despesas: quem pagou (Caixa ou um aportador). Receitas entram no Caixa. */
  origem_recurso: Origem | null;
  /** Só em despesas: qual custo é (ex.: aluguel), além da categoria. */
  item_custo: string | null;
  corretor: string | null;
  cliente: string | null;
  produto: string | null;
  cidade: string | null;
  socio: string | null;
  /** Comissões: VGV do imóvel e memória do cálculo. */
  vgv: number | null;
  comissao_percent: number | null;
  /** Comissão total (VGV × comissao_percent). */
  comissao_bruta: number | null;
  /** Parte da comissão total que é da Mercatto (%). */
  split_empresa_percent: number | null;
  imposto_nf_percent: number | null;
  imposto_nf: number | null;
  /** Gestor comercial: % do split da Mercatto e valor (fora da NF da Mercatto). */
  gestor_percent: number | null;
  gestor_valor: number | null;
  /** Séries (lançamentos que se repetem): mesmo serie_id em todas as ocorrências. */
  serie_id: string | null;
  recorrencia: Recorrencia | null;
  parcela: number | null;
  /** Só em parcelados; fixos não têm fim definido. */
  parcelas_total: number | null;
  criado_por: string | null;
  criado_em: string;
  atualizado_em: string;
}

export type LancamentoEntrada = Omit<
  Lancamento,
  "id" | "criado_por" | "criado_em" | "atualizado_em"
>;

export interface Configuracoes {
  /** Comissão total sobre o VGV (%). */
  comissao_percent: number;
  /** Parte da comissão total que é da Mercatto (%). */
  split_empresa_percent: number;
  /** Imposto sobre a NF da Mercatto (%), sobre o split menos a parte do gestor. */
  imposto_nf_percent: number;
  /** Parte do split da Mercatto que vai para o gestor comercial (%). */
  gestor_percent: number;
  custo_fixo_estimado: number;
  comissao_media_esperada: number;
  saldo_inicial_caixa: number;
  atualizado_em?: string;
}

export const CONFIG_PADRAO: Configuracoes = {
  comissao_percent: 5,
  split_empresa_percent: 50,
  imposto_nf_percent: 6,
  gestor_percent: 15,
  custo_fixo_estimado: 0,
  comissao_media_esperada: 0,
  saldo_inicial_caixa: 0,
};

/** Meta de VGV vendido por ano. */
export interface MetaAnual {
  ano: number;
  meta_vgv: number;
}

/** O PostgREST devolve numeric como número, mas normalizamos por garantia. */
export function normalizarLancamento(l: Record<string, unknown>): Lancamento {
  const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
  return {
    ...(l as unknown as Lancamento),
    valor: Number(l.valor),
    vgv: num(l.vgv),
    comissao_percent: num(l.comissao_percent),
    comissao_bruta: num(l.comissao_bruta),
    split_empresa_percent: num(l.split_empresa_percent),
    imposto_nf_percent: num(l.imposto_nf_percent),
    imposto_nf: num(l.imposto_nf),
    gestor_percent: num(l.gestor_percent),
    gestor_valor: num(l.gestor_valor),
    origem_recurso: (l.origem_recurso as Origem | null) ?? null,
    item_custo: (l.item_custo as string | null) ?? null,
    serie_id: (l.serie_id as string | null) ?? null,
    recorrencia: (l.recorrencia as Recorrencia | null) ?? null,
    parcela: num(l.parcela),
    parcelas_total: num(l.parcelas_total),
  };
}

export function normalizarConfiguracoes(c: Record<string, unknown> | null): Configuracoes {
  if (!c) return CONFIG_PADRAO;
  return {
    comissao_percent: Number(c.comissao_percent ?? 5),
    split_empresa_percent: Number(c.split_empresa_percent ?? 50),
    imposto_nf_percent: Number(c.imposto_nf_percent ?? 6),
    // Bancos antigos sem a coluna: sem gestor (não muda contas já feitas)
    gestor_percent: Number(c.gestor_percent ?? 0),
    custo_fixo_estimado: Number(c.custo_fixo_estimado ?? 0),
    comissao_media_esperada: Number(c.comissao_media_esperada ?? 0),
    saldo_inicial_caixa: Number(c.saldo_inicial_caixa ?? 0),
    atualizado_em: c.atualizado_em as string | undefined,
  };
}

// ─── Propostas (não entram no financeiro) ──────────────────────────────

export const STATUS_PROPOSTA = ["negociacao", "fechada", "perdida"] as const;
export type StatusProposta = (typeof STATUS_PROPOSTA)[number];

export const ROTULO_STATUS: Record<StatusProposta, string> = {
  negociacao: "Em negociação",
  fechada: "Fechada",
  perdida: "Perdida",
};

export interface Proposta {
  id: string;
  /** Data de envio para negociação (AAAA-MM-DD) */
  data: string;
  vgv: number;
  corretor: string;
  produto: string;
  cliente: string | null;
  cidade: string | null;
  observacao: string | null;
  status: StatusProposta;
  /** Quando saiu de negociação (fechada ou perdida) */
  encerrada_em: string | null;
  motivo_perda: string | null;
  /** Lançamento de comissão gerado quando virou venda */
  lancamento_id: string | null;
  criado_em: string;
  atualizado_em: string;
}

export type PropostaEntrada = Omit<Proposta, "id" | "criado_em" | "atualizado_em">;

export function normalizarProposta(p: Record<string, unknown>): Proposta {
  return { ...(p as unknown as Proposta), vgv: Number(p.vgv) };
}
