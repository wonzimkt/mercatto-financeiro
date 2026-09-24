/**
 * Dados fictícios para ver o painel sem login: `NEXT_PUBLIC_DEMO=1 npm run dev`.
 * Só funciona em desenvolvimento (NODE_ENV !== "production"); o build
 * publicado nunca entra neste modo. Nada aqui toca o Supabase.
 */
import { listaMeses, mesAtual, somarMeses } from "@/lib/financeiro/datas";
import type { Configuracoes, Lancamento, LancamentoEntrada } from "@/lib/financeiro/tipos";

export const MODO_DEMO = process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_DEMO === "1";

export const CONFIG_DEMO: Configuracoes = {
  split_empresa_percent: 50,
  reserva_meses_alvo: 6,
  custo_fixo_estimado: 22000,
  comissao_media_esperada: 18000,
  saldo_inicial_caixa: 60000,
  saldo_inicial_cris: 15000,
};

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
    descricao: null, corretor: null, cliente: null, produto: null, cidade: null, socio: null,
    comissao_bruta: null, split_empresa_percent: null,
  };

  const fim = mesAtual();
  for (const mes of listaMeses(somarMeses(fim, -13), fim)) {
    const dia = (d: number) => `${mes}-${String(d).padStart(2, "0")}`;
    add({ ...base, tipo: "despesa", categoria: "Custo Fixo", valor: 9800, data: dia(5), descricao: "Aluguel da sala", origem_recurso: "Caixa" });
    add({ ...base, tipo: "despesa", categoria: "Custo Fixo", valor: 7200 + Math.round(aleatorio() * 1500), data: dia(6), descricao: "Folha administrativa", origem_recurso: "Caixa" });
    add({ ...base, tipo: "despesa", categoria: "Custo Fixo", valor: 1400, data: dia(10), descricao: "Sistemas e CRM", origem_recurso: "Cris" });
    add({ ...base, tipo: "despesa", categoria: "Marketing", valor: 2500 + Math.round(aleatorio() * 4500), data: dia(12), descricao: "Anúncios e portais", origem_recurso: "Caixa" });
    if (aleatorio() > 0.6)
      add({ ...base, tipo: "despesa", categoria: "Outro", valor: 600 + Math.round(aleatorio() * 2400), data: dia(18), descricao: "Fotografia e tour 360", origem_recurso: "Cris" });

    const vendas = mes === fim ? 1 : 1 + Math.floor(aleatorio() * 2.6);
    let comissoes = 0;
    for (let v = 0; v < vendas; v++) {
      const bruta = Math.round((24000 + aleatorio() * 46000) / 100) * 100;
      comissoes += bruta / 2;
      add({
        ...base, tipo: "receita", categoria: "Comissão de Venda", valor: bruta / 2, data: dia(8 + v * 7),
        origem_recurso: aleatorio() > 0.8 ? "Cris" : "Caixa", corretor: escolher(corretores), cliente: escolher(clientes),
        produto: escolher(produtos), cidade: escolher(cidades), comissao_bruta: bruta, split_empresa_percent: 50,
      });
    }
    if (comissoes)
      add({ ...base, tipo: "despesa", categoria: "Imposto", valor: Math.round(comissoes * 0.11), data: dia(20), descricao: "Simples Nacional", origem_recurso: "Caixa" });
    if (aleatorio() > 0.75)
      add({ ...base, tipo: "receita", categoria: "Outra Receita", valor: 1800, data: dia(15), descricao: "Taxa de administração de locação", origem_recurso: "Caixa" });
    if (comissoes > 20000)
      add({ ...base, tipo: "despesa", categoria: "Retirada de Sócios", valor: 8000, data: dia(28), socio: escolher(["Cris", "Leandro"]), origem_recurso: "Caixa" });
  }
  return ls;
}
