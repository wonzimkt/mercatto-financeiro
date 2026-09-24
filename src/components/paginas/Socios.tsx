"use client";

import { useMemo } from "react";
import { FiltroPeriodo, usePeriodo } from "@/components/Filtros";
import { GraficoOrigens } from "@/components/graficos/Graficos";
import { Barras, CabecalhoPagina, Figura, Figuras, Secao, Valor } from "@/components/Livro";
import { useDados } from "@/components/Painel";
import { agruparPor, ehRetirada, mesesDoHistorico, retiradasNoPeriodo, serieMensal } from "@/lib/financeiro/calculos";
import { chaveMes } from "@/lib/financeiro/datas";
import { dataBR, moeda } from "@/lib/financeiro/formato";

export function Socios() {
  const { lancamentos: ls, config } = useDados();
  const periodo = usePeriodo();

  const doPeriodo = useMemo(() => retiradasNoPeriodo(ls, periodo.inicio, periodo.fim), [ls, periodo]);
  const porSocio = useMemo(() => agruparPor(doPeriodo, "socio"), [doPeriodo]);
  const historico = useMemo(
    () => ls.filter(ehRetirada).sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0)),
    [ls],
  );
  const porSocioTotal = useMemo(() => agruparPor(historico, "socio"), [historico]);
  const origens = useMemo(
    () =>
      serieMensal(ls, config, mesesDoHistorico(ls, chaveMes(periodo.fim), 12)).map((p) => ({
        mes: p.mes,
        Caixa: p.acumuladoOrigem.Caixa,
        Cris: p.acumuladoOrigem.Cris,
      })),
    [ls, config, periodo.fim],
  );

  const totalPeriodo = doPeriodo.reduce((s, l) => s + l.valor, 0);
  const totalHistorico = historico.reduce((s, l) => s + l.valor, 0);
  const ultimo = origens[origens.length - 1];

  return (
    <main className="pagina">
      <CabecalhoPagina titulo="Sócios" destaque="& retiradas" descricao={periodo.rotulo}>
        <FiltroPeriodo />
      </CabecalhoPagina>

      <Secao folio="1" titulo="Retiradas no período">
        <Figuras>
          <Figura rotulo="Total retirado" valor={totalPeriodo} grande />
          {porSocio.slice(0, 3).map((s) => (
            <Figura key={s.nome} rotulo={s.nome} valor={s.total} rodape={<span>{s.qtd} {s.qtd === 1 ? "retirada" : "retiradas"}</span>} />
          ))}
        </Figuras>
        <div className="colunas" style={{ marginTop: 18 }}>
          <div>
            <p className="versal" style={{ margin: "0 0 6px" }}>Por sócio · período</p>
            <Barras
              itens={porSocio.map((s) => ({ nome: s.nome, valor: s.total, detalhe: `${s.qtd} ${s.qtd === 1 ? "retirada" : "retiradas"}` }))}
              vazio="Nenhuma retirada no período."
            />
          </div>
          <div>
            <p className="versal" style={{ margin: "0 0 6px" }}>Por sócio · todo o histórico</p>
            <Barras
              itens={porSocioTotal.map((s) => ({ nome: s.nome, valor: s.total, detalhe: `${s.qtd} ${s.qtd === 1 ? "retirada" : "retiradas"}` }))}
              vazio="Nenhuma retirada registrada."
            />
          </div>
        </div>
      </Secao>

      <Secao folio="2" titulo="Saldo por origem ao longo do tempo" nota="acumulado ao fim de cada mês, com saldos iniciais">
        <Figuras>
          <Figura rotulo="Caixa" valor={ultimo?.Caixa ?? 0} tom="auto" />
          <Figura rotulo="Cris" valor={ultimo?.Cris ?? 0} tom="auto" />
        </Figuras>
        <div style={{ marginTop: 16 }}>
          <GraficoOrigens dados={origens} />
        </div>
      </Secao>

      <Secao folio="3" titulo="Histórico completo de retiradas" nota={`${historico.length} registros`}>
        {historico.length ? (
          <div className="tabela-wrap">
            <table className="razao">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Sócio</th>
                  <th>Origem</th>
                  <th>Descrição</th>
                  <th className="num">Valor</th>
                </tr>
              </thead>
              <tbody>
                {historico.map((l) => (
                  <tr key={l.id}>
                    <td className="num">{dataBR(l.data)}</td>
                    <td>{l.socio}</td>
                    <td>{l.origem_recurso}</td>
                    <td>{l.descricao || <span className="muted">—</span>}</td>
                    <td className="num">{moeda(l.valor)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4}>Total retirado</td>
                  <td className="num">
                    <Valor v={totalHistorico} />
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <p className="vazio">Nenhuma retirada registrada.</p>
        )}
      </Secao>
    </main>
  );
}
