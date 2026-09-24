"use client";

import Link from "next/link";
import { useMemo } from "react";
import { NavegadorMes, useMesSelecionado } from "@/components/Filtros";
import { GraficoFluxoCaixa } from "@/components/graficos/Graficos";
import { Barras, CabecalhoPagina, Delta, Figura, Figuras, Medidor, ROTULO_FONTE, Secao, Valor } from "@/components/ui";
import { useDados } from "@/components/Painel";
import {
  caixaAgora,
  despesasPorCategoria,
  pontoEquilibrio,
  progressoMeta,
  resumoMes,
  serieMensal,
} from "@/lib/financeiro/calculos";
import { hojeISO, mesAtual, nomeMes, primeiroDia, somarMeses, ultimoDia, ultimosMeses } from "@/lib/financeiro/datas";
import { dataBR, moeda, moedaCompacta, num, percentual } from "@/lib/financeiro/formato";

export function VisaoGeral() {
  const { lancamentos: ls, config, metas, propostas } = useDados();
  const mes = useMesSelecionado();
  const corrente = mesAtual();
  const hoje = hojeISO();
  const ano = Number(mes.slice(0, 4));

  const r = useMemo(() => resumoMes(ls, config, mes), [ls, config, mes]);
  const caixa = useMemo(() => caixaAgora(ls, config, hoje), [ls, config, hoje]);
  const pe = useMemo(() => pontoEquilibrio(ls, config, mes, corrente), [ls, config, mes, corrente]);
  const meta = metas.find((m) => m.ano === ano)?.meta_vgv ?? 0;
  const pm = useMemo(() => progressoMeta(ls, ano, meta, hoje), [ls, ano, meta, hoje]);
  const fluxo = useMemo(() => serieMensal(ls, config, ultimosMeses(mes, 12)), [ls, config, mes]);
  const categorias = useMemo(() => despesasPorCategoria(ls, primeiroDia(mes), ultimoDia(mes)), [ls, mes]);
  const abertas = propostas.filter((p) => p.status === "negociacao");
  const vgvNegociacao = abertas.reduce((s, p) => s + p.vgv, 0);

  const { atual, anterior } = r;

  return (
    <main className="pagina">
      <CabecalhoPagina titulo="Visão geral" descricao={`Resumo de ${nomeMes(mes)}`}>
        <NavegadorMes />
      </CabecalhoPagina>

      {ls.length === 0 && (
        <p className="aviso">
          Ainda não há lançamentos. Comece pelas{" "}
          <Link className="link" href="/configuracoes/">
            configurações
          </Link>{" "}
          (saldo inicial do caixa, custo fixo estimado) e depois registre o{" "}
          <Link className="link" href="/lancamentos/novo/">
            primeiro lançamento
          </Link>
          .
        </p>
      )}

      <Figuras>
        <Figura
          rotulo="Caixa agora"
          valor={caixa.saldo}
          tom="auto"
          rodape={<span className="delta__sufixo">Saldo em {dataBR(hoje)}</span>}
        />
        <Figura rotulo="Receita do mês" valor={atual.receita} rodape={<Delta v={r.variacao.receita} />} />
        <Figura
          rotulo="Despesa do mês"
          valor={atual.despesa}
          rodape={<Delta v={r.variacao.despesa} bomQuandoSobe={false} />}
        />
        <Figura rotulo="Resultado do mês" valor={atual.resultado} tom="auto" rodape={<Delta v={r.variacao.resultado} />} />
      </Figuras>

      <div className="colunas">
        <Secao titulo="Movimento do caixa" nota={nomeMes(mes)}>
          <table className="tabela">
            <tbody>
              <tr>
                <td>Saldo no início do mês</td>
                <td className="num">
                  <Valor v={anterior.caixa} />
                </td>
              </tr>
              <tr>
                <td>
                  Entradas
                  <span className="secundario">todas as receitas entram no caixa</span>
                </td>
                <td className="num pos">+{moeda(atual.receita)}</td>
              </tr>
              <tr>
                <td>
                  Saídas pagas pelo caixa
                  <span className="secundario">despesas com origem Caixa</span>
                </td>
                <td className="num neg">−{moeda(atual.despesaCaixa)}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td>Saldo no fim do mês</td>
                <td className="num">
                  <Valor v={atual.caixa} tom="auto" />
                </td>
              </tr>
            </tfoot>
          </table>
          <p className="campo__ajuda" style={{ margin: "12px 0 0" }}>
            Pago pela Cris no mês: <strong>{moeda(atual.despesaCris)}</strong> (não sai do caixa). Total já bancado pela Cris:{" "}
            <strong>{moeda(caixa.bancadoCris)}</strong>.
            {caixa.aVencer !== 0 && <> Lançamentos com data futura: {moeda(caixa.aVencer)}.</>}
          </p>
        </Secao>

        <Secao
          titulo={`Meta de vendas ${ano}`}
          nota={
            <Link className="link" href={`/metas/?mes=${mes}`}>
              {meta ? "Detalhar" : "Definir meta"}
            </Link>
          }
        >
          {meta ? (
            <>
              <Figuras>
                <Figura
                  rotulo="VGV vendido"
                  valor={pm.alcancado}
                  formato="compacto"
                  rodape={
                    <span>
                      {pm.vendas} {pm.vendas === 1 ? "venda" : "vendas"}
                    </span>
                  }
                />
                <Figura rotulo="Meta de VGV" valor={pm.meta} formato="compacto" rodape={<span>faltam {moedaCompacta(pm.falta)}</span>} />
              </Figuras>
              <Medidor progresso={pm.progresso ?? 0} ok={(pm.progresso ?? 0) >= 1} rotulo="VGV vendido sobre a meta do ano" />
              <p className="campo__ajuda" style={{ margin: 0 }}>
                {percentual(pm.progresso ?? 0)} da meta
                {pm.esperadoAteHoje !== null &&
                  (pm.alcancado >= pm.esperadoAteHoje
                    ? ` · adiantado em ${moedaCompacta(pm.alcancado - pm.esperadoAteHoje)} no ritmo do ano`
                    : ` · atrasado em ${moedaCompacta(pm.esperadoAteHoje - pm.alcancado)} no ritmo do ano`)}
                .
              </p>
              {abertas.length > 0 && (
                <p className="campo__ajuda" style={{ margin: "6px 0 0" }}>
                  Em negociação:{" "}
                  <Link className="link" href="/propostas/">
                    {moedaCompacta(vgvNegociacao)} em {abertas.length} {abertas.length === 1 ? "proposta" : "propostas"}
                  </Link>{" "}
                  (ainda fora do vendido).
                </p>
              )}
            </>
          ) : (
            <p className="vazio">
              Nenhuma meta de VGV para {ano}.{" "}
              <Link className="link" href={`/metas/?mes=${mes}`}>
                Definir meta
              </Link>
            </p>
          )}
        </Secao>
      </div>

      <Secao
        titulo="Ponto de equilíbrio"
        nota={
          <Link className="link" href={`/metas/?mes=${mes}`}>
            Detalhar
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
          <Figura rotulo="Comissões cobrem" valor={pe.cobertura} formato="pct" rodape={<span>do custo operacional</span>} />
        </Figuras>
        {pe.vendasNecessarias !== null && pe.vendasNecessarias > 0 && (
          <Medidor
            progresso={pe.vendasFechadas / pe.vendasNecessarias}
            ok={pe.vendasFechadas >= pe.vendasNecessarias}
            rotulo="Vendas fechadas sobre as necessárias"
          />
        )}
        <p className="campo__ajuda" style={{ margin: 0 }}>
          {pe.vendasNecessarias === null ? (
            <>Defina a comissão média esperada nas configurações para calcular. </>
          ) : pe.faltam === 0 ? (
            <span className="pos">Equilíbrio atingido no mês. </span>
          ) : (
            <>
              Faltam <strong>{num(pe.faltam ?? 0)}</strong> {pe.faltam === 1 ? "venda" : "vendas"}.{" "}
            </>
          )}
          Custo operacional de {moeda(pe.custo.valor)} ({ROTULO_FONTE[pe.custo.fonte]}) ÷ comissão líquida média de{" "}
          {moeda(pe.comissaoMedia.valor)} ({ROTULO_FONTE[pe.comissaoMedia.fonte]}). Retiradas de sócios não entram.
        </p>
      </Secao>

      <Secao titulo="Fluxo de caixa" nota={`${nomeMes(somarMeses(mes, -11), "curto")} a ${nomeMes(mes, "curto")}`}>
        <GraficoFluxoCaixa
          dados={fluxo.map((p) => ({ mes: p.mes, receita: p.receita, despesa: p.despesaCaixa, resultado: p.fluxoCaixa }))}
        />
        <details style={{ marginTop: 12 }}>
          <summary className="link" style={{ fontSize: 14 }}>
            Ver em tabela
          </summary>
          <div className="tabela-wrap">
            <table className="tabela" style={{ marginTop: 10 }}>
              <thead>
                <tr>
                  <th>Mês</th>
                  <th className="num">Entradas</th>
                  <th className="num">Saídas do caixa</th>
                  <th className="num">Pago pela Cris</th>
                  <th className="num">Caixa no fim do mês</th>
                </tr>
              </thead>
              <tbody>
                {fluxo.map((p) => (
                  <tr key={p.mes}>
                    <td>{nomeMes(p.mes)}</td>
                    <td className="num">{moeda(p.receita)}</td>
                    <td className="num">{moeda(p.despesaCaixa)}</td>
                    <td className="num muted">{moeda(p.despesaCris)}</td>
                    <td className="num">
                      <Valor v={p.caixa} tom="auto" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </Secao>

      <Secao titulo="Despesas por categoria" nota={nomeMes(mes)}>
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
