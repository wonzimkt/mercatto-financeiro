"use client";

import Link from "next/link";
import { useMemo } from "react";
import { NavegadorMes, useMesSelecionado } from "@/components/Filtros";
import { GraficoFluxoCaixa } from "@/components/graficos/Graficos";
import { Barras, CabecalhoPagina, Delta, Figura, Figuras, Medidor, ROTULO_FONTE, Secao, Valor } from "@/components/Livro";
import { useDados } from "@/components/Painel";
import {
  despesasPorCategoria,
  pontoEquilibrio,
  reserva,
  resumoMes,
  serieMensal,
} from "@/lib/financeiro/calculos";
import { mesAtual, nomeMes, primeiroDia, ultimoDia, ultimosMeses } from "@/lib/financeiro/datas";
import { moeda, num, percentual } from "@/lib/financeiro/formato";
import { ORIGENS } from "@/lib/financeiro/tipos";

export function VisaoGeral() {
  const { lancamentos: ls, config } = useDados();
  const mes = useMesSelecionado();
  const corrente = mesAtual();

  const r = useMemo(() => resumoMes(ls, config, mes), [ls, config, mes]);
  const pe = useMemo(() => pontoEquilibrio(ls, config, mes, corrente), [ls, config, mes, corrente]);
  const res = useMemo(() => reserva(ls, config, mes), [ls, config, mes]);
  const fluxo = useMemo(() => serieMensal(ls, config, ultimosMeses(mes, 12)), [ls, config, mes]);
  const categorias = useMemo(() => despesasPorCategoria(ls, primeiroDia(mes), ultimoDia(mes)), [ls, mes]);

  const { atual, anterior } = r;
  const semLancamentos = ls.length === 0;

  return (
    <main className="pagina">
      <CabecalhoPagina titulo="Visão geral" destaque={`de ${nomeMes(mes)}`}>
        <NavegadorMes />
      </CabecalhoPagina>

      {semLancamentos && (
        <p className="aviso" style={{ margin: "20px 0" }}>
          O livro-razão está vazio. Comece pelas{" "}
          <Link className="link" href="/configuracoes/">
            configurações
          </Link>{" "}
          (saldos iniciais, custo fixo estimado) e depois registre o{" "}
          <Link className="link" href="/lancamentos/novo/">
            primeiro lançamento
          </Link>
          .
        </p>
      )}

      <Secao folio="1" titulo="O mês em números">
        <Figuras>
          <Figura
            rotulo="Receita do mês"
            valor={atual.receita}
            rodape={<Delta v={r.variacao.receita} />}
          />
          <Figura
            rotulo="Despesa do mês"
            valor={atual.despesa}
            rodape={<Delta v={r.variacao.despesa} bomQuandoSobe={false} />}
          />
          <Figura
            rotulo="Saldo do mês"
            valor={atual.resultado}
            tom="auto"
            rodape={<Delta v={r.variacao.resultado} />}
          />
          <Figura
            rotulo="Caixa acumulado"
            valor={atual.acumulado}
            tom="auto"
            grande
            rodape={<Delta v={r.variacao.acumulado} />}
          />
        </Figuras>
      </Secao>

      <Secao folio="2" titulo="Saldo por origem" nota="Caixa da empresa e conta da Cris, separadamente">
        <div className="tabela-wrap">
          <table className="razao">
            <thead>
              <tr>
                <th>Origem</th>
                <th className="num">Entradas no mês</th>
                <th className="num">Saídas no mês</th>
                <th className="num">Saldo do mês</th>
                <th className="num">Mês anterior</th>
                <th className="num">Acumulado</th>
              </tr>
            </thead>
            <tbody>
              {ORIGENS.map((o) => (
                <tr key={o}>
                  <td>{o}</td>
                  <td className="num">{moeda(atual.origem[o].receita)}</td>
                  <td className="num">{moeda(atual.origem[o].despesa)}</td>
                  <td className="num">
                    <Valor v={atual.origem[o].resultado} tom="auto" />
                  </td>
                  <td className="num muted">
                    <Valor v={anterior.origem[o].resultado} />
                  </td>
                  <td className="num">
                    <Valor v={atual.acumuladoOrigem[o]} tom="auto" />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Total</td>
                <td className="num">{moeda(atual.receita)}</td>
                <td className="num">{moeda(atual.despesa)}</td>
                <td className="num">
                  <Valor v={atual.resultado} tom="auto" />
                </td>
                <td className="num muted">
                  <Valor v={anterior.resultado} />
                </td>
                <td className="num">
                  <Valor v={atual.acumulado} tom="auto" />
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Secao>

      <div className="colunas">
        <Secao
          folio="3"
          titulo="Ponto de equilíbrio"
          nota={
            <Link className="link" href={`/metas/?mes=${mes}`}>
              detalhar
            </Link>
          }
        >
          <Figuras>
            <Figura rotulo="Vendas necessárias" valor={pe.vendasNecessarias} formato="numero" />
            <Figura
              rotulo="Vendas fechadas"
              valor={pe.vendasFechadas}
              formato="numero"
              tom={pe.vendasNecessarias !== null && pe.vendasFechadas >= pe.vendasNecessarias ? "positivo" : "neutro"}
            />
          </Figuras>
          {pe.vendasNecessarias !== null && pe.vendasNecessarias > 0 && (
            <Medidor
              progresso={pe.vendasFechadas / pe.vendasNecessarias}
              ok={pe.vendasFechadas >= pe.vendasNecessarias}
              rotulo="Vendas fechadas sobre as necessárias"
            />
          )}
          <p className="campo__ajuda" style={{ margin: "8px 0 0" }}>
            {pe.vendasNecessarias === null ? (
              <>Defina a comissão média esperada nas configurações para calcular.</>
            ) : pe.faltam === 0 ? (
              <span className="pos">Equilíbrio atingido no mês. </span>
            ) : (
              <>
                Faltam <strong>{num(pe.faltam ?? 0)}</strong> {pe.faltam === 1 ? "venda" : "vendas"}.{" "}
              </>
            )}
            Custo operacional de {moeda(pe.custo.valor)} ({ROTULO_FONTE[pe.custo.fonte]}) ÷ comissão média de{" "}
            {moeda(pe.comissaoMedia.valor)} ({ROTULO_FONTE[pe.comissaoMedia.fonte]}). Retiradas de sócios não entram.
          </p>
        </Secao>

        <Secao folio="4" titulo="Reserva de caixa">
          <Figuras>
            <Figura rotulo="Caixa acumulado" valor={res.caixa} tom="auto" />
            <Figura rotulo={`Meta · ${config.reserva_meses_alvo} meses`} valor={res.meta} />
          </Figuras>
          {res.progresso !== null && (
            <Medidor progresso={res.progresso} ok={res.progresso >= 1} rotulo="Caixa acumulado sobre a meta de reserva" />
          )}
          <p className="campo__ajuda" style={{ margin: "8px 0 0" }}>
            {res.progresso === null ? (
              "Defina o custo fixo estimado e os meses de reserva nas configurações."
            ) : (
              <>
                {percentual(Math.max(0, res.progresso))} da meta
                {res.mesesCobertos !== null && ` · o caixa cobre ${num(Math.max(0, res.mesesCobertos))} meses de custo`}. Custo
                médio de {moeda(res.custoMedio.valor)} ({ROTULO_FONTE[res.custoMedio.fonte]}).
              </>
            )}
          </p>
        </Secao>
      </div>

      <Secao folio="5" titulo="Fluxo de caixa" nota={`12 meses até ${nomeMes(mes)}`}>
        <GraficoFluxoCaixa dados={fluxo} />
        <details style={{ marginTop: 12 }}>
          <summary className="link" style={{ fontSize: 13 }}>
            Ver em tabela
          </summary>
          <div className="tabela-wrap">
            <table className="razao" style={{ marginTop: 10 }}>
              <thead>
                <tr>
                  <th>Mês</th>
                  <th className="num">Entradas</th>
                  <th className="num">Saídas</th>
                  <th className="num">Resultado</th>
                  <th className="num">Acumulado</th>
                </tr>
              </thead>
              <tbody>
                {fluxo.map((p) => (
                  <tr key={p.mes}>
                    <td>{nomeMes(p.mes)}</td>
                    <td className="num">{moeda(p.receita)}</td>
                    <td className="num">{moeda(p.despesa)}</td>
                    <td className="num">
                      <Valor v={p.resultado} tom="auto" />
                    </td>
                    <td className="num">
                      <Valor v={p.acumulado} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </Secao>

      <Secao folio="6" titulo="Despesas por categoria" nota={nomeMes(mes)}>
        <Barras
          itens={categorias.map((c) => ({
            nome: c.nome,
            valor: c.total,
            detalhe: `${c.qtd} ${c.qtd === 1 ? "lançamento" : "lançamentos"} · ${percentual(c.participacao)}`,
          }))}
          vazio="Nenhuma despesa lançada neste mês."
        />
      </Secao>
    </main>
  );
}
