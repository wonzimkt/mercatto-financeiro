"use client";

import { useMemo } from "react";
import { FiltroPeriodo, usePeriodo } from "@/components/Filtros";
import { GraficoLinha } from "@/components/graficos/Graficos";
import { Barras, CabecalhoPagina, Figura, Figuras, Secao } from "@/components/Livro";
import { useDados } from "@/components/Painel";
import { agruparPor, ticketMedioPorMes, vendasNoPeriodo } from "@/lib/financeiro/calculos";
import { mesesDeEvolucao, nomeMes } from "@/lib/financeiro/datas";
import { dataBR, moeda, num, percentual } from "@/lib/financeiro/formato";

export function Vendas() {
  const { lancamentos: ls } = useDados();
  const periodo = usePeriodo();

  const vendas = useMemo(() => vendasNoPeriodo(ls, periodo.inicio, periodo.fim), [ls, periodo]);
  const corretores = useMemo(() => agruparPor(vendas, "corretor"), [vendas]);
  const cidades = useMemo(() => agruparPor(vendas, "cidade"), [vendas]);
  const produtos = useMemo(() => agruparPor(vendas, "produto"), [vendas]);
  const mesesEvolucao = mesesDeEvolucao(periodo);
  const ticket = ticketMedioPorMes(ls, mesesEvolucao);

  const total = vendas.reduce((s, v) => s + v.valor, 0);
  const comBruta = vendas.filter((v) => v.comissao_bruta !== null);
  const bruta = comBruta.reduce((s, v) => s + (v.comissao_bruta ?? 0), 0);
  const repasse = bruta - comBruta.reduce((s, v) => s + v.valor, 0);

  return (
    <main className="pagina">
      <CabecalhoPagina titulo="Vendas" destaque="& corretores" descricao={`Comissões que ficaram com a empresa · ${periodo.rotulo}`}>
        <FiltroPeriodo />
      </CabecalhoPagina>

      <Secao folio="1" titulo="Resumo do período">
        <Figuras>
          <Figura rotulo="Comissão à empresa" valor={total} grande />
          <Figura rotulo="Vendas fechadas" valor={vendas.length} formato="numero" />
          <Figura rotulo="Ticket médio de comissão" valor={vendas.length ? total / vendas.length : null} />
          <Figura
            rotulo="Repasse a corretores"
            valor={comBruta.length ? repasse : null}
            rodape={
              comBruta.length ? (
                <span>
                  de {moeda(bruta)} em comissão total
                  {comBruta.length < vendas.length && ` (${comBruta.length} de ${vendas.length} vendas com cálculo)`}
                </span>
              ) : (
                <span>calculado quando a venda usa a calculadora</span>
              )
            }
          />
        </Figuras>
      </Secao>

      <Secao folio="2" titulo="Ranking de corretores" nota="por comissão gerada à empresa">
        {corretores.length ? (
          <div className="tabela-wrap">
            <table className="razao">
              <thead>
                <tr>
                  <th aria-label="Posição" />
                  <th>Corretor</th>
                  <th className="num">Vendas</th>
                  <th className="num">Ticket médio</th>
                  <th className="num">Comissão à empresa</th>
                  <th className="num">Participação</th>
                </tr>
              </thead>
              <tbody>
                {corretores.map((c, i) => (
                  <tr key={c.nome}>
                    <td className="posicao">{i + 1}º</td>
                    <td>
                      {c.nome}
                      <span className="fatia" aria-hidden>
                        <span style={{ width: `${(c.total / corretores[0].total) * 100}%` }} />
                      </span>
                    </td>
                    <td className="num">{num(c.qtd)}</td>
                    <td className="num">{moeda(c.ticket)}</td>
                    <td className="num">{moeda(c.total)}</td>
                    <td className="num">{percentual(c.participacao)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td />
                  <td>Total</td>
                  <td className="num">{num(vendas.length)}</td>
                  <td className="num">{moeda(vendas.length ? total / vendas.length : 0)}</td>
                  <td className="num">{moeda(total)}</td>
                  <td className="num">{percentual(1)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <p className="vazio">Nenhuma venda no período.</p>
        )}
      </Secao>

      <div className="colunas">
        <Secao folio="3" titulo="Comissão por cidade">
          <Barras
            itens={cidades.map((c) => ({ nome: c.nome, valor: c.total, detalhe: `${c.qtd} ${c.qtd === 1 ? "venda" : "vendas"}` }))}
            vazio="Nenhuma venda no período."
          />
        </Secao>
        <Secao folio="4" titulo="Comissão por empreendimento">
          <Barras
            itens={produtos.map((c) => ({ nome: c.nome, valor: c.total, detalhe: `${c.qtd} ${c.qtd === 1 ? "venda" : "vendas"}` }))}
            vazio="Nenhuma venda no período."
          />
        </Secao>
      </div>

      <Secao
        folio="5"
        titulo="Ticket médio mês a mês"
        nota={`${nomeMes(mesesEvolucao[0], "curto")} a ${nomeMes(mesesEvolucao[mesesEvolucao.length - 1], "curto")} · meses sem venda ficam em branco`}
      >
        <GraficoLinha dados={ticket.map((t) => ({ mes: t.mes, valor: t.ticket }))} nome="Ticket médio" altura={240} />
      </Secao>

      <Secao folio="6" titulo="Vendas do período" nota={`${vendas.length} ${vendas.length === 1 ? "venda" : "vendas"}`}>
        {vendas.length ? (
          <div className="tabela-wrap">
            <table className="razao">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Cliente</th>
                  <th>Empreendimento</th>
                  <th>Cidade</th>
                  <th>Corretor</th>
                  <th className="num">Comissão total</th>
                  <th className="num">Empresa</th>
                </tr>
              </thead>
              <tbody>
                {vendas.map((v) => (
                  <tr key={v.id}>
                    <td className="num">{dataBR(v.data)}</td>
                    <td>{v.cliente ?? "—"}</td>
                    <td>{v.produto ?? "—"}</td>
                    <td>{v.cidade ?? "—"}</td>
                    <td>{v.corretor ?? "—"}</td>
                    <td className="num muted">{v.comissao_bruta !== null ? moeda(v.comissao_bruta) : "—"}</td>
                    <td className="num">{moeda(v.valor)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={5}>Total</td>
                  <td className="num muted">{comBruta.length ? moeda(bruta) : "—"}</td>
                  <td className="num">{moeda(total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <p className="vazio">Nenhuma venda no período.</p>
        )}
      </Secao>
    </main>
  );
}
