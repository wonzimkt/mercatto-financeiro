"use client";

import { FiltroPeriodo, usePeriodo } from "@/components/Filtros";
import { CabecalhoPagina, Secao } from "@/components/ui";
import { useDados } from "@/components/Painel";
import {
  agruparPor,
  despesasPorCategoriaMes,
  noPeriodo,
  retiradasNoPeriodo,
  serieMensal,
  vendasNoPeriodo,
} from "@/lib/financeiro/calculos";
import { baixarCsv, gerarCsv, type Celula } from "@/lib/financeiro/csv";
import { hojeISO, nomeMes } from "@/lib/financeiro/datas";
import { CATEGORIAS_DESPESA, type Lancamento } from "@/lib/financeiro/tipos";

const COLUNAS: (keyof Lancamento)[] = [
  "id",
  "data",
  "tipo",
  "categoria",
  "valor",
  "origem_recurso",
  "descricao",
  "corretor",
  "cliente",
  "produto",
  "cidade",
  "socio",
  "comissao_bruta",
  "split_empresa_percent",
  "criado_por",
  "criado_em",
  "atualizado_em",
];

const linhasLancamentos = (ls: Lancamento[]): Celula[][] =>
  [...ls].sort((a, b) => a.data.localeCompare(b.data)).map((l) => COLUNAS.map((c) => l[c] as Celula));

export function Exportar() {
  const { lancamentos: ls, config } = useDados();
  const periodo = usePeriodo();
  const sufixo = periodo.tipo === "personalizado" ? `${periodo.inicio}_a_${periodo.fim}` : periodo.ref;

  const relatorios: { titulo: string; descricao: string; gerar: () => [string, string] }[] = [
    {
      titulo: "Lançamentos — histórico completo",
      descricao: "Todas as colunas, todos os lançamentos. Serve como backup.",
      gerar: () => [`mercatto-lancamentos-completo-${hojeISO()}`, gerarCsv(COLUNAS, linhasLancamentos(ls))],
    },
    {
      titulo: "Lançamentos do período",
      descricao: "Todas as colunas, só o período selecionado.",
      gerar: () => [
        `mercatto-lancamentos-${sufixo}`,
        gerarCsv(COLUNAS, linhasLancamentos(noPeriodo(ls, periodo.inicio, periodo.fim))),
      ],
    },
    {
      titulo: "Vendas do período",
      descricao: "Data, cliente, empreendimento, cidade, corretor, comissão total, % e líquido da empresa.",
      gerar: () => [
        `mercatto-vendas-${sufixo}`,
        gerarCsv(
          ["Data", "Cliente", "Empreendimento", "Cidade", "Corretor", "Comissão total", "% empresa", "Líquido empresa", "Origem"],
          vendasNoPeriodo(ls, periodo.inicio, periodo.fim).map((v) => [
            v.data,
            v.cliente,
            v.produto,
            v.cidade,
            v.corretor,
            v.comissao_bruta,
            v.split_empresa_percent,
            v.valor,
            v.origem_recurso,
          ]),
        ),
      ],
    },
    {
      titulo: "Ranking de corretores",
      descricao: "Comissão gerada à empresa, número de vendas e ticket médio por corretor.",
      gerar: () => [
        `mercatto-corretores-${sufixo}`,
        gerarCsv(
          ["Posição", "Corretor", "Vendas", "Comissão à empresa", "Ticket médio", "Participação %"],
          agruparPor(vendasNoPeriodo(ls, periodo.inicio, periodo.fim), "corretor").map((g, i) => [
            String(i + 1),
            g.nome,
            String(g.qtd),
            g.total,
            g.ticket,
            g.participacao * 100,
          ]),
        ),
      ],
    },
    {
      titulo: "Despesas por categoria, mês a mês",
      descricao: "Uma linha por mês do período, uma coluna por categoria.",
      gerar: () => [
        `mercatto-despesas-${sufixo}`,
        gerarCsv(
          ["Mês", ...CATEGORIAS_DESPESA, "Total"],
          despesasPorCategoriaMes(ls, periodo.meses).map((m) => [nomeMes(m.mes), ...CATEGORIAS_DESPESA.map((c) => m[c]), m.total]),
        ),
      ],
    },
    {
      titulo: "Retiradas de sócios",
      descricao: "Retiradas do período, com sócio e origem.",
      gerar: () => [
        `mercatto-retiradas-${sufixo}`,
        gerarCsv(
          ["Data", "Sócio", "Origem", "Descrição", "Valor"],
          retiradasNoPeriodo(ls, periodo.inicio, periodo.fim).map((l) => [l.data, l.socio, l.origem_recurso, l.descricao, l.valor]),
        ),
      ],
    },
    {
      titulo: "Fluxo de caixa mensal",
      descricao: "Entradas, saídas, resultado e saldo acumulado (total, Caixa e Cris) por mês.",
      gerar: () => [
        `mercatto-fluxo-${sufixo}`,
        gerarCsv(
          ["Mês", "Entradas", "Saídas", "Operacional", "Retiradas", "Resultado", "Acumulado", "Acumulado Caixa", "Acumulado Cris"],
          serieMensal(ls, config, periodo.meses).map((p) => [
            nomeMes(p.mes),
            p.receita,
            p.despesa,
            p.operacional,
            p.retiradas,
            p.resultado,
            p.acumulado,
            p.acumuladoOrigem.Caixa,
            p.acumuladoOrigem.Cris,
          ]),
        ),
      ],
    },
  ];

  return (
    <main className="pagina">
      <CabecalhoPagina
        titulo="Exportação"
        descricao="Arquivos CSV prontos para o Excel (separador ponto e vírgula, vírgula decimal). Gerados no seu navegador — nada passa por outro servidor."
      >
        <FiltroPeriodo />
      </CabecalhoPagina>

      <Secao titulo="Relatórios" nota={periodo.rotulo}>
        <table className="tabela">
          <tbody>
            {relatorios.map((r) => (
              <tr key={r.titulo}>
                <td>
                  {r.titulo}
                  <span className="secundario">{r.descricao}</span>
                </td>
                <td className="acoes">
                  <button
                    className="btn btn--pequeno"
                    onClick={() => {
                      const [nome, csv] = r.gerar();
                      baixarCsv(nome, csv);
                    }}
                  >
                    Baixar CSV
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Secao>
    </main>
  );
}
