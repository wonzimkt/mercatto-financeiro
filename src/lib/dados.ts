"use client";

import { supabase } from "@/lib/supabase/cliente";
import {
  normalizarConfiguracoes,
  normalizarLancamento,
  normalizarProposta,
  type Configuracoes,
  type Lancamento,
  type LancamentoEntrada,
  type MetaAnual,
  type Pagador,
  type Proposta,
  type PropostaEntrada,
} from "@/lib/financeiro/tipos";

const PAGINA = 1000; // limite padrão de linhas por requisição do Supabase

export async function buscarLancamentos(): Promise<Lancamento[]> {
  const todos: Lancamento[] = [];
  for (let de = 0; ; de += PAGINA) {
    const { data, error } = await supabase()
      .from("lancamentos")
      .select("*")
      .order("data", { ascending: true })
      .order("criado_em", { ascending: true })
      .range(de, de + PAGINA - 1);
    if (error) throw new Error(traduzirErro(error.message));
    todos.push(...(data ?? []).map(normalizarLancamento));
    if (!data || data.length < PAGINA) return todos;
  }
}

export async function buscarConfiguracoes(): Promise<Configuracoes> {
  const { data, error } = await supabase().from("configuracoes").select("*").eq("id", true).maybeSingle();
  if (error) throw new Error(traduzirErro(error.message));
  return normalizarConfiguracoes(data);
}

export async function buscarMetas(): Promise<MetaAnual[]> {
  const { data, error } = await supabase().from("metas_anuais").select("ano, meta_vgv").order("ano");
  if (error) throw new Error(traduzirErro(error.message));
  return (data ?? []).map((m) => ({ ano: Number(m.ano), meta_vgv: Number(m.meta_vgv) }));
}

export async function salvarMeta(meta: MetaAnual) {
  const { error } = await supabase().from("metas_anuais").upsert(meta, { onConflict: "ano" });
  if (error) throw new Error(traduzirErro(error.message));
}

/** Cria o lançamento e devolve o id (usado para ligar uma proposta à venda). */
export async function criarLancamento(l: LancamentoEntrada): Promise<string> {
  const { data, error } = await supabase().from("lancamentos").insert(l).select("id").single();
  if (error) throw new Error(traduzirErro(error.message));
  return data.id as string;
}

/** Cria várias ocorrências de uma vez (séries). Tudo ou nada. */
export async function criarLancamentos(ls: LancamentoEntrada[]) {
  if (!ls.length) return;
  const { error } = await supabase().from("lancamentos").insert(ls);
  if (error) throw new Error(traduzirErro(error.message));
}

/** Campos que valem para a série toda (datas e numeração ficam como estão). */
export type CamposSerie = Pick<
  LancamentoEntrada,
  "tipo" | "categoria" | "valor" | "descricao" | "origem_recurso" | "item_custo" | "socio"
>;

/** Aplica os campos às ocorrências da série com data a partir de `desde` (inclusive). */
export async function atualizarSerieDesde(serieId: string, desde: string, campos: CamposSerie) {
  const { error } = await supabase().from("lancamentos").update(campos).eq("serie_id", serieId).gte("data", desde);
  if (error) throw new Error(traduzirErro(error.message));
}

/** Exclui as ocorrências da série com data a partir de `desde` (inclusive). Devolve quantas. */
export async function excluirSerieDesde(serieId: string, desde: string): Promise<number> {
  const { error, count } = await supabase()
    .from("lancamentos")
    .delete({ count: "exact" })
    .eq("serie_id", serieId)
    .gte("data", desde);
  if (error) throw new Error(traduzirErro(error.message));
  return count ?? 0;
}

export async function atualizarLancamento(id: string, l: LancamentoEntrada) {
  const { error } = await supabase().from("lancamentos").update(l).eq("id", id);
  if (error) throw new Error(traduzirErro(error.message));
}

export async function excluirLancamento(id: string) {
  const { error, count } = await supabase().from("lancamentos").delete({ count: "exact" }).eq("id", id);
  if (error) throw new Error(traduzirErro(error.message));
  if (count === 0) throw new Error("Lançamento não encontrado ou sem permissão para excluir.");
}

export async function buscarPropostas(): Promise<Proposta[]> {
  const { data, error } = await supabase().from("propostas").select("*").order("data", { ascending: false }).limit(5000);
  if (error) throw new Error(traduzirErro(error.message));
  return (data ?? []).map(normalizarProposta);
}

export async function criarProposta(p: PropostaEntrada) {
  const { error } = await supabase().from("propostas").insert(p);
  if (error) throw new Error(traduzirErro(error.message));
}

export async function atualizarProposta(id: string, p: Partial<PropostaEntrada>) {
  const { error } = await supabase().from("propostas").update(p).eq("id", id);
  if (error) throw new Error(traduzirErro(error.message));
}

export async function excluirProposta(id: string) {
  const { error, count } = await supabase().from("propostas").delete({ count: "exact" }).eq("id", id);
  if (error) throw new Error(traduzirErro(error.message));
  if (count === 0) throw new Error("Proposta não encontrada ou sem permissão para excluir.");
}

// ─── Pagadores ─────────────────────────────────────────────────────────

export async function buscarPagadores(): Promise<Pagador[]> {
  const { data, error } = await supabase().from("pagadores").select("nome, ativo, ordem").order("ordem").order("nome");
  if (error) throw new Error(traduzirErro(error.message));
  return (data ?? []) as Pagador[];
}

export async function criarPagador(nome: string, ordem: number) {
  const { error } = await supabase().from("pagadores").insert({ nome: nome.trim(), ordem });
  if (error) throw new Error(/duplicate|unique|pagadores_pkey/i.test(error.message) ? "Já existe alguém com esse nome." : traduzirErro(error.message));
}

export async function atualizarPagador(nome: string, dados: Partial<Pagador>) {
  const { error } = await supabase().from("pagadores").update(dados).eq("nome", nome);
  if (error) throw new Error(/duplicate|unique|pagadores_pkey/i.test(error.message) ? "Já existe alguém com esse nome." : traduzirErro(error.message));
}

// ─── Links de visualização ─────────────────────────────────────────────

export interface LinkCompartilhado {
  id: string;
  nome: string;
  expira_em: string | null;
  revogado_em: string | null;
  ultimo_acesso_em: string | null;
  acessos: number;
  criado_em: string;
}

export async function buscarLinks(): Promise<LinkCompartilhado[]> {
  const { data, error } = await supabase()
    .from("links_compartilhados")
    .select("id, nome, expira_em, revogado_em, ultimo_acesso_em, acessos, criado_em")
    .order("criado_em", { ascending: false });
  if (error) throw new Error(traduzirErro(error.message));
  return (data ?? []) as LinkCompartilhado[];
}

/** SHA-256 em hexadecimal, calculado no navegador. */
async function sha256Hex(texto: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Cria um link de visualização. O código (256 bits aleatórios) é gerado no
 * navegador; o banco recebe só o hash. Devolve o código para montar o link,
 * que é mostrado uma única vez.
 */
export async function criarLink(nome: string, expiraEm: string | null): Promise<string> {
  const aleatorio = crypto.getRandomValues(new Uint8Array(32));
  const token = btoa(String.fromCharCode(...aleatorio)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const { error } = await supabase()
    .from("links_compartilhados")
    .insert({ nome: nome.trim(), token_hash: await sha256Hex(token), expira_em: expiraEm });
  if (error) throw new Error(traduzirErro(error.message));
  return token;
}

export async function revogarLink(id: string) {
  const { error } = await supabase().from("links_compartilhados").update({ revogado_em: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(traduzirErro(error.message));
}

export async function excluirLink(id: string) {
  const { error } = await supabase().from("links_compartilhados").delete().eq("id", id);
  if (error) throw new Error(traduzirErro(error.message));
}

export interface VisaoCompartilhada {
  nome: string;
  expira_em: string | null;
  lancamentos: Lancamento[];
  config: Configuracoes;
  metas: MetaAnual[];
  propostas: Proposta[];
}

/**
 * Dados de um link de visualização (sem login). O banco devolve só o
 * mínimo para a Visão geral; os demais campos chegam vazios.
 * `null` quando o link não existe, expirou ou foi revogado.
 */
export async function buscarVisaoCompartilhada(token: string): Promise<VisaoCompartilhada | null> {
  const { data, error } = await supabase().rpc("visao_compartilhada", { p_token: token });
  if (error) throw new Error(traduzirErro(error.message));
  if (!data) return null;
  const d = data as {
    nome: string;
    expira_em: string | null;
    configuracoes: Record<string, unknown> | null;
    metas: MetaAnual[];
    lancamentos: Record<string, unknown>[];
    propostas: Pick<Proposta, "status" | "vgv">[] & Partial<Pick<Proposta, "data" | "encerrada_em" | "corretor">>[];
  };
  return {
    nome: d.nome,
    expira_em: d.expira_em,
    config: normalizarConfiguracoes(d.configuracoes),
    metas: d.metas.map((m) => ({ ano: Number(m.ano), meta_vgv: Number(m.meta_vgv) })),
    lancamentos: d.lancamentos.map((l, i) =>
      normalizarLancamento({
        id: `v${i}`,
        descricao: null,
        item_custo: null,
        corretor: null,
        cliente: null,
        produto: null,
        cidade: null,
        socio: null,
        comissao_percent: null,
        comissao_bruta: null,
        split_empresa_percent: null,
        imposto_nf_percent: null,
        criado_por: null,
        criado_em: "",
        atualizado_em: "",
        ...l,
      }),
    ),
    propostas: d.propostas.map((p, i) =>
      normalizarProposta({
        id: `p${i}`,
        data: "",
        corretor: "",
        produto: "",
        cliente: null,
        cidade: null,
        observacao: null,
        encerrada_em: null,
        motivo_perda: null,
        lancamento_id: null,
        criado_em: "",
        atualizado_em: "",
        ...p,
      }),
    ),
  };
}

export async function salvarConfiguracoes(c: Omit<Configuracoes, "atualizado_em">) {
  const { error } = await supabase().from("configuracoes").update(c).eq("id", true);
  if (error) throw new Error(traduzirErro(error.message));
}

function traduzirErro(msg: string): string {
  if (/JWT expired/i.test(msg)) return "Sua sessão expirou. Entre novamente.";
  if (/row-level security|permission denied/i.test(msg))
    return "Sem permissão. Entre novamente e confirme o código do autenticador.";
  if (/lancamentos_categoria_valida/.test(msg)) return "Categoria incompatível com o tipo do lançamento.";
  if (/lancamentos_comissao_tem_corretor/.test(msg)) return "Informe o corretor da venda.";
  if (/lancamentos_retirada_tem_socio/.test(msg)) return "Informe o sócio da retirada.";
  if (/lancamentos_comissao_tem_vgv/.test(msg)) return "Informe o VGV da venda.";
  if (/lancamentos_origem_so_em_despesa/.test(msg)) return "Despesas precisam de origem (Caixa ou Cris); receitas não têm origem.";
  if (/lancamentos_serie_consistente/.test(msg)) return "Dados da série inconsistentes (parcela ou total de parcelas).";
  if (/lancamentos_origem_recurso_fkey/.test(msg)) return "Quem pagou não está na lista de pagadores (Configurações).";
  if (/pagadores/.test(msg) && /foreign key|violates/i.test(msg))
    return "Essa pessoa já tem despesas lançadas e não pode ser excluída. Desative-a.";
  if (/propostas_encerramento/.test(msg)) return "Informe a data de encerramento da proposta.";
  if (/propostas_vgv_check|propostas_corretor_check|propostas_produto_check/.test(msg))
    return "Preencha VGV, corretor e produto da proposta.";
  if (/Failed to fetch|NetworkError/i.test(msg)) return "Sem conexão com o servidor. Verifique sua internet.";
  return msg;
}
