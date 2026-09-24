"use client";

import { useMemo } from "react";
import { FiltroPeriodo, usePeriodo } from "@/components/Filtros";
import { GraficoLinha } from "@/components/graficos/Graficos";
import { Barras, CabecalhoPagina, Figura, Figuras, Secao } from "@/components/ui";
import { useDados } from "@/components/Painel";
import { agruparPor, ticketMedioPorMes, vendasNoPeriodo } from "@/lib/financeiro/calculos";
import { mesesDeEvolucao, nomeMes } from "@/lib/financeiro/datas";
import { dataBR, moeda, moedaCompacta, num, percentual } from "@/lib/financeiro/formato";

export function Vendas() {
  const { lancamentos: ls } = useDados();
  const periodo = usePeriodo();

  const vendas = useMemo(() => vendasNoPeriodo(ls, periodo.inicio, periodo.fim), [ls, periodo]);
  const corretores = useMemo(() => agruparPor(vendas, "corretor"), [vendas]);
  const cidades = useMemo(() => agruparPor(vendas, "cidade"), [vendas]);
  const produtos = useMemo(() => agruparPor(vendas, "produto"), [vendas]);
  const mesesEvolucao = mesesDeEvolucao(periodo);
  const ticket = ticketMedioPorMes(ls, mesesEvolucao);

  const soma = (f: (v: (typeof vendas)[number]) => number | null) => vendas.reduce((s, v) => s + (f(v) ?? 0), 0);
  const total = soma((v) => v.valor);
  const vgv = soma((v) => v.vgv);
  const bruta = soma((v) => v.comissao_bruta);
  const imposto = soma((v) => v.imposto_nf);
  const splitMercatto = total + imposto;
  const splitCorretores = bruta - splitMercatto;

  return (
    <main className="pagina">
      <CabecalhoPagina titulo="Vendas & corretores" descricao={periodo.rotulo}>
        <FiltroPeriodo />
      </CabecalhoPagina>
      <Figuras>
        <Figura rotulo="VGV vendido" valor={vgv} formato="compacto" rodape={<span>{vendas.length} {vendas.length === 1 ? "venda" : "vendas"}</span>} />
        <Figura rotulo="Comissão total" valor={bruta} rodape={<span>corretores: {moeda(splitCorretores)}</span>} />
        <Figura rotulo="Líquido Mercatto" valor={total} rodape={<span>após {moeda(imposto)} de imposto na NF</span>} />
        <Figura rotulo="Ticket médio líquido" valor={vendas.length ? total / vendas.length : null} rodape={<span>por venda</span>} />
      </Figuras>

      <Secao titulo="Ranking de corretores" nota="por líquido gerado à Mercatto">
        {corretores.length ? (
          <div className="tabela-wrap">
            <table className="tabela">
              <thead>
                <tr>
                  <th aria-label="Posição" />
                  <th>Corretor</th>
                  <th className="num">Vendas</th>
                  <th className="num">VGV</th>
                  <th className="num">Ticket médio</th>
                  <th className="num">Líquido Mercatto</th>
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
                    <td className="num">{moedaCompacta(c.vgv)}</td>
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
                  <td className="num">{moedaCompacta(vgv)}</td>
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
        <Secao titulo="Comissão por cidade">
          <Barras
            itens={cidades.map((c) => ({ nome: c.nome, valor: c.total, detalhe: `${c.qtd} ${c.qtd === 1 ? "venda" : "vendas"} · VGV ${moedaCompacta(c.vgv)}` }))}
            vazio="Nenhuma venda no período."
          />
        </Secao>
        <Secao titulo="Comissão por empreendimento">
          <Barras
            itens={produtos.map((c) => ({ nome: c.nome, valor: c.total, detalhe: `${c.qtd} ${c.qtd === 1 ? "venda" : "vendas"} · VGV ${moedaCompacta(c.vgv)}` }))}
            vazio="Nenhuma venda no período."
          />
        </Secao>
      </div>

      <Secao
       
        titulo="Ticket médio mês a mês"
        nota={`${nomeMes(mesesEvolucao[0], "curto")} a ${nomeMes(mesesEvolucao[mesesEvolucao.length - 1], "curto")} · meses sem venda ficam em branco`}
      >
        <GraficoLinha dados={ticket.map((t) => ({ mes: t.mes, valor: t.ticket }))} nome="Ticket médio" altura={240} />
      </Secao>

      <Secao titulo="Vendas do período" nota={`${vendas.length} ${vendas.length === 1 ? "venda" : "vendas"}`}>
        {vendas.length ? (
          <div className="tabela-wrap">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Cliente</th>
                  <th>Empreendimento</th>
                  <th>Cidade</th>
                  <th>Corretor</th>
                  <th className="num">VGV</th>
                  <th className="num">Comissão total</th>
                  <th className="num">Imposto NF</th>
                  <th className="num">Líquido Mercatto</th>
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
                    <td className="num">{v.vgv !== null ? moeda(v.vgv) : "—"}</td>
                    <td className="num muted">{v.comissao_bruta !== null ? moeda(v.comissao_bruta) : "—"}</td>
                    <td className="num muted">{v.imposto_nf !== null ? moeda(v.imposto_nf) : "—"}</td>
                    <td className="num">{moeda(v.valor)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={5}>Total</td>
                  <td className="num">{moeda(vgv)}</td>
                  <td className="num">{moeda(bruta)}</td>
                  <td className="num">{moeda(imposto)}</td>
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
