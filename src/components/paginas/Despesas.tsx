"use client";

import { FiltroPeriodo, usePeriodo } from "@/components/Filtros";
import { GraficoLinha } from "@/components/graficos/Graficos";
import { CabecalhoPagina, Delta, Figura, Figuras, Secao } from "@/components/Livro";
import { useDados } from "@/components/Painel";
import { despesasPorCategoriaMes, maioresDespesas, noPeriodo, variacao } from "@/lib/financeiro/calculos";
import { mesesDecorridos, mesesDeEvolucao, nomeMes, somarMeses } from "@/lib/financeiro/datas";
import { dataBR, moeda, moedaCompacta } from "@/lib/financeiro/formato";
import { CATEGORIAS_DESPESA, RETIRADA } from "@/lib/financeiro/tipos";

export function Despesas() {
  const { lancamentos: ls } = useDados();
  const periodo = usePeriodo();
  const meses = mesesDeEvolucao(periodo);
  const decorridos = mesesDecorridos(periodo).length;

  // Um mês a mais no começo para calcular a variação do primeiro.
  const porMes = despesasPorCategoriaMes(ls, [somarMeses(meses[0], -1), ...meses]);
  const linhas = porMes.slice(1).map((m, i) => ({ ...m, variacao: variacao(m.total, porMes[i].total) }));

  const doPeriodo = noPeriodo(ls, periodo.inicio, periodo.fim).filter((l) => l.tipo === "despesa");
  const total = doPeriodo.reduce((s, l) => s + l.valor, 0);
  const retiradas = doPeriodo.filter((l) => l.categoria === RETIRADA).reduce((s, l) => s + l.valor, 0);
  const maiores = maioresDespesas(ls, periodo.inicio, periodo.fim, 12);
  const totalCategoria = (c: string) => doPeriodo.filter((l) => l.categoria === c).reduce((s, l) => s + l.valor, 0);

  return (
    <main className="pagina">
      <CabecalhoPagina titulo="Despesas" descricao={periodo.rotulo}>
        <FiltroPeriodo />
      </CabecalhoPagina>

      <Secao folio="1" titulo="Resumo do período">
        <Figuras>
          <Figura rotulo="Despesa total" valor={total} grande />
          <Figura rotulo="Custo operacional" valor={total - retiradas} rodape={<span>sem retiradas de sócios</span>} />
          <Figura rotulo="Retiradas de sócios" valor={retiradas} />
          <Figura
            rotulo="Média por mês"
            valor={decorridos ? total / decorridos : 0}
            rodape={<span>{decorridos} {decorridos === 1 ? "mês" : "meses"} decorridos</span>}
          />
        </Figuras>
      </Secao>

      <Secao
        folio="2"
        titulo="Evolução por categoria"
        nota={`${nomeMes(meses[0], "curto")} a ${nomeMes(meses[meses.length - 1], "curto")} · cada quadro na sua escala`}
      >
        <div className="multiplos">
          {CATEGORIAS_DESPESA.map((c) => (
            <div key={c}>
              <div className="multiplo__cab">
                <span className="multiplo__titulo">{c}</span>
                <span className="num muted" style={{ fontSize: 13 }}>
                  {moeda(linhas.reduce((s, m) => s + m[c], 0))}
                </span>
              </div>
              <GraficoLinha
                dados={linhas.map((m) => ({ mes: m.mes, valor: m[c] }))}
                nome={c}
                altura={130}
                compacto
                formatar={moeda}
              />
            </div>
          ))}
        </div>
      </Secao>

      <Secao folio="3" titulo="Comparativo mês a mês">
        <div className="tabela-wrap">
          <table className="razao">
            <thead>
              <tr>
                <th>Mês</th>
                {CATEGORIAS_DESPESA.map((c) => (
                  <th key={c} className="num">
                    {c}
                  </th>
                ))}
                <th className="num">Total</th>
                <th className="num">Var. mês ant.</th>
              </tr>
            </thead>
            <tbody>
              {[...linhas].reverse().map((m) => (
                <tr key={m.mes}>
                  <td>{nomeMes(m.mes)}</td>
                  {CATEGORIAS_DESPESA.map((c) => (
                    <td key={c} className={`num ${m[c] ? "" : "muted"}`}>
                      {m[c] ? moedaCompacta(m[c]) : "—"}
                    </td>
                  ))}
                  <td className="num">{moeda(m.total)}</td>
                  <td className="num">
                    <Delta v={m.variacao} bomQuandoSobe={false} sufixo="" />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Total</td>
                {CATEGORIAS_DESPESA.map((c) => (
                  <td key={c} className="num">
                    {moedaCompacta(linhas.reduce((s, m) => s + m[c], 0))}
                  </td>
                ))}
                <td className="num">{moeda(linhas.reduce((s, m) => s + m.total, 0))}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </Secao>

      <Secao folio="4" titulo="Maiores despesas do período">
        {maiores.length ? (
          <div className="tabela-wrap">
            <table className="razao">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Descrição</th>
                  <th>Categoria</th>
                  <th>Origem</th>
                  <th className="num">Valor</th>
                  <th className="num">% do período</th>
                </tr>
              </thead>
              <tbody>
                {maiores.map((l) => (
                  <tr key={l.id}>
                    <td className="num">{dataBR(l.data)}</td>
                    <td>
                      {l.descricao || <span className="muted">—</span>}
                      {l.socio && <span className="secundario">Sócio: {l.socio}</span>}
                    </td>
                    <td>{l.categoria}</td>
                    <td>{l.origem_recurso}</td>
                    <td className="num">{moeda(l.valor)}</td>
                    <td className="num muted">{total ? `${((l.valor / total) * 100).toFixed(1).replace(".", ",")}%` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="vazio">Nenhuma despesa no período.</p>
        )}
        <p className="campo__ajuda">
          Total por categoria no período:{" "}
          {CATEGORIAS_DESPESA.map((c) => `${c} ${moeda(totalCategoria(c))}`).join(" · ")}
        </p>
      </Secao>
    </main>
  );
}
