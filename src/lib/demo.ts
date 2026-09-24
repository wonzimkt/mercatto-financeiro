/**
 * Dados fictícios para ver o painel sem login: `NEXT_PUBLIC_DEMO=1 npm run dev`.
 * Só funciona em desenvolvimento (NODE_ENV !== "production"); o build
 * publicado nunca entra neste modo. Nada aqui toca o Supabase.
 */
import { hojeISO, listaMeses, mesAtual, somarMeses } from "@/lib/financeiro/datas";
import { calcularComissao } from "@/lib/financeiro/calculos";
import type { Configuracoes, Lancamento, LancamentoEntrada, MetaAnual, Proposta } from "@/lib/financeiro/tipos";

export const MODO_DEMO = process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_DEMO === "1";

export const CONFIG_DEMO: Configuracoes = {
  comissao_percent: 5,
  split_empresa_percent: 50,
  imposto_nf_percent: 6,
  custo_fixo_estimado: 22000,
  comissao_media_esperada: 30000,
  saldo_inicial_caixa: 60000,
};

export const METAS_DEMO: MetaAnual[] = [{ ano: Number(mesAtual().slice(0, 4)), meta_vgv: 24_000_000 }];

export function lancamentosDemo(): Lancamento[] {
  let semente = 42;
  const aleatorio = () => ((semente = (semente * 16807) % 2147483647) - 1) / 2147483646;
  const escolher = <T,>(xs: T[]) => xs[Math.floor(aleatorio() * xs.length)];
  const corretores = ["Ana Paula", "Bruno Reis", "Carla Moura", "Diego Lins"];
  const cidades = ["Balneário Camboriú", "Balneário Camboriú", "Itajaí", "Itapema", "Camboriú"];
  const produtos = ["Residencial Atlântico", "Brava Mar", "Torre Farol", "Maré Alta", "Villa Brava", "Mirante Sul"];
  const clientes = ["Família Souza", "R. Albuquerque", "M. Carvalho", "T. Nakamura", "J. Weber", "L. Fontana", "P. Andrade"];

  const ls: Lancamento[] = [];
  let id = 0;
  const add = (l: LancamentoEntrada) =>
    ls.push({ ...l, id: `demo-${++id}`, criado_por: null, criado_em: `${l.data}T12:00:00Z`, atualizado_em: `${l.data}T12:00:00Z` });
  const base = {
    descricao: null, corretor: null, cliente: null, produto: null, cidade: null, socio: null, item_custo: null,
    vgv: null, comissao_percent: null, comissao_bruta: null, split_empresa_percent: null,
    imposto_nf_percent: null, imposto_nf: null,
  };

  const fim = mesAtual();
  for (const mes of listaMeses(somarMeses(fim, -13), fim)) {
    const dia = (d: number) => `${mes}-${String(d).padStart(2, "0")}`;
    add({ ...base, tipo: "despesa", categoria: "Custo Fixo", valor: 9800, data: dia(5), item_custo: "Aluguel", origem_recurso: "Caixa" });
    add({ ...base, tipo: "despesa", categoria: "Custo Fixo", valor: 7200 + Math.round(aleatorio() * 1500), data: dia(6), item_custo: "Folha administrativa", origem_recurso: "Caixa" });
    add({ ...base, tipo: "despesa", categoria: "Custo Fixo", valor: 1400, data: dia(10), item_custo: "Sistemas e CRM", origem_recurso: "Cris" });
    add({ ...base, tipo: "despesa", categoria: "Custo Fixo", valor: 900, data: dia(10), item_custo: "Contador", origem_recurso: "Caixa" });
    add({ ...base, tipo: "despesa", categoria: "Marketing", valor: 2500 + Math.round(aleatorio() * 4500), data: dia(12), item_custo: "Anúncios e portais", origem_recurso: "Caixa" });
    if (aleatorio() > 0.6)
      add({ ...base, tipo: "despesa", categoria: "Outro", valor: 600 + Math.round(aleatorio() * 2400), data: dia(18), item_custo: "Fotografia e tour 360", origem_recurso: "Cris" });

    const vendas = mes === fim ? 1 : 1 + Math.floor(aleatorio() * 2.6);
    let comissoes = 0;
    for (let v = 0; v < vendas; v++) {
      const vgv = Math.round((900_000 + aleatorio() * 2_600_000) / 10_000) * 10_000;
      const c = calcularComissao({ vgv, comissaoPercent: 5, splitPercent: 50, impostoPercent: 6 });
      comissoes += c.liquidoMercatto;
      add({
        ...base, tipo: "receita", categoria: "Comissão de Venda", valor: c.liquidoMercatto, data: dia(8 + v * 7),
        origem_recurso: null, corretor: escolher(corretores), cliente: escolher(clientes),
        produto: escolher(produtos), cidade: escolher(cidades), vgv, comissao_percent: 5,
        comissao_bruta: c.comissaoTotal, split_empresa_percent: 50, imposto_nf_percent: 6, imposto_nf: c.impostoNf,
      });
    }
    if (comissoes)
      add({ ...base, tipo: "despesa", categoria: "Imposto", valor: Math.round(comissoes * 0.03), data: dia(20), item_custo: "ISS e taxas", origem_recurso: "Caixa" });
    if (aleatorio() > 0.75)
      add({ ...base, tipo: "receita", categoria: "Outra Receita", valor: 1800, data: dia(15), descricao: "Taxa de administração de locação", origem_recurso: null });
    if (comissoes > 20000)
      add({ ...base, tipo: "despesa", categoria: "Retirada de Sócios", valor: 8000, data: dia(28), socio: escolher(["Cris", "Leandro"]), origem_recurso: "Caixa" });
  }
  return ls;
}

export function propostasDemo(): Proposta[] {
  const hoje = Date.parse(`${hojeISO()}T00:00:00Z`);
  const dia = (atras: number) => new Date(hoje - atras * 86_400_000).toISOString().slice(0, 10);
  const base = { cliente: null, cidade: null, observacao: null, encerrada_em: null, motivo_perda: null, lancamento_id: null, criado_em: "", atualizado_em: "" };
  const lista: Omit<Proposta, "id">[] = [
    { ...base, data: dia(3), vgv: 2_450_000, corretor: "Ana Paula", produto: "Torre Farol", cliente: "Família Rocha", cidade: "Balneário Camboriú", status: "negociacao" },
    { ...base, data: dia(9), vgv: 1_180_000, corretor: "Bruno Reis", produto: "Brava Mar", cliente: "C. Menezes", cidade: "Itajaí", status: "negociacao" },
    { ...base, data: dia(21), vgv: 3_900_000, corretor: "Carla Moura", produto: "Villa Brava", cidade: "Itajaí", status: "negociacao", observacao: "Contraproposta de 3,6 mi enviada" },
    { ...base, data: dia(44), vgv: 890_000, corretor: "Ana Paula", produto: "Mirante Sul", cliente: "G. Tavares", cidade: "Itapema", status: "negociacao" },
    { ...base, data: dia(60), vgv: 1_600_000, corretor: "Diego Lins", produto: "Maré Alta", status: "perdida", encerrada_em: dia(40), motivo_perda: "Cliente desistiu" },
    { ...base, data: dia(75), vgv: 2_100_000, corretor: "Bruno Reis", produto: "Residencial Atlântico", status: "fechada", encerrada_em: dia(50) },
  ];
  return lista.map((p, i) => ({ ...p, id: `demo-p${i + 1}` }));
}
