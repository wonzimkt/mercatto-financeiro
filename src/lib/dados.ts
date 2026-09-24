"use client";

import { supabase } from "@/lib/supabase/cliente";
import {
  normalizarConfiguracoes,
  normalizarLancamento,
  type Configuracoes,
  type Lancamento,
  type LancamentoEntrada,
  type MetaAnual,
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

export async function criarLancamento(l: LancamentoEntrada) {
  const { error } = await supabase().from("lancamentos").insert(l);
  if (error) throw new Error(traduzirErro(error.message));
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
  if (/Failed to fetch|NetworkError/i.test(msg)) return "Sem conexão com o servidor. Verifique sua internet.";
  return msg;
}
