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
import { liquidoPotencial } from "@/lib/financeiro/propostas";
import { CATEGORIAS_DESPESA, ROTULO_STATUS, type Lancamento } from "@/lib/financeiro/tipos";

const COLUNAS: (keyof Lancamento)[] = [
  "id",
  "data",
  "tipo",
  "categoria",
  "valor",
  "origem_recurso",
  "item_custo",
  "descricao",
  "corretor",
  "cliente",
  "produto",
  "cidade",
  "socio",
  "vgv",
  "comissao_percent",
  "comissao_bruta",
  "split_empresa_percent",
  "imposto_nf_percent",
  "imposto_nf",
  "criado_por",
  "criado_em",
  "atualizado_em",
];

const linhasLancamentos = (ls: Lancamento[]): Celula[][] =>
  [...ls].sort((a, b) => a.data.localeCompare(b.data)).map((l) => COLUNAS.map((c) => l[c] as Celula));

export function Exportar() {
  const { lancamentos: ls, config, propostas } = useDados();
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
      descricao: "Data, cliente, empreendimento, cidade, corretor, VGV, comissão, splits, imposto da NF e líquido Mercatto.",
      gerar: () => [
        `mercatto-vendas-${sufixo}`,
        gerarCsv(
          ["Data", "Cliente", "Empreendimento", "Cidade", "Corretor", "VGV", "Comissão total", "Split Mercatto", "Split corretor", "Imposto NF", "Líquido Mercatto"],
          vendasNoPeriodo(ls, periodo.inicio, periodo.fim).map((v) => {
            const splitMercatto = v.valor + (v.imposto_nf ?? 0);
            return [
              v.data,
              v.cliente,
              v.produto,
              v.cidade,
              v.corretor,
              v.vgv,
              v.comissao_bruta,
              splitMercatto,
              v.comissao_bruta !== null ? v.comissao_bruta - splitMercatto : null,
              v.imposto_nf,
              v.valor,
            ];
          }),
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
      titulo: "Propostas",
      descricao: "Todas as propostas (em negociação, fechadas e perdidas), com VGV e líquido potencial.",
      gerar: () => [
        `mercatto-propostas-${hojeISO()}`,
        gerarCsv(
          ["Enviada em", "Situação", "Encerrada em", "Produto", "Cliente", "Cidade", "Corretor", "VGV", "Líquido potencial", "Motivo da perda", "Observação"],
          [...propostas]
            .sort((a, b) => a.data.localeCompare(b.data))
            .map((p) => [
              p.data,
              ROTULO_STATUS[p.status],
              p.encerrada_em,
              p.produto,
              p.cliente,
              p.cidade,
              p.corretor,
              p.vgv,
              liquidoPotencial(p.vgv, config),
              p.motivo_perda,
              p.observacao,
            ]),
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
      descricao: "Entradas, saídas do caixa, pago pela Cris, resultado e caixa no fim de cada mês.",
      gerar: () => [
        `mercatto-fluxo-${sufixo}`,
        gerarCsv(
          ["Mês", "Entradas", "Despesas", "Saídas do caixa", "Pago pela Cris", "Operacional", "Retiradas", "Resultado", "Caixa no fim do mês", "Bancado pela Cris (acumulado)"],
          serieMensal(ls, config, periodo.meses).map((p) => [
            nomeMes(p.mes),
            p.receita,
            p.despesa,
            p.despesaCaixa,
            p.despesaCris,
            p.operacional,
            p.retiradas,
            p.resultado,
            p.caixa,
            p.bancadoCris,
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
