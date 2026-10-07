"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { GraficoFluxoCaixa, GraficoMeta, GraficoProjecao, GraficoResultado, Tendencia } from "@/components/graficos/Graficos";
import { useDados } from "@/components/Painel";
import { Barras, CabecalhoPagina, Delta, Medidor, Secao } from "@/components/ui";
import {
  agruparPor,
  aportesPorPessoa,
  caixaAgora,
  despesasPorCategoria,
  despesasPorItem,
  progressoMeta,
  serieMensal,
  variacao,
  vendasNoPeriodo,
} from "@/lib/financeiro/calculos";
import { hojeISO, mesAtual, mesesDoPainel, nomeMes, primeiroDia, somarMeses, ultimoDia } from "@/lib/financeiro/datas";
import { moeda, moedaCompacta, percentual } from "@/lib/financeiro/formato";
import { agendaFutura } from "@/lib/financeiro/futuros";
import { negociacaoPorCorretor, resumoPropostas } from "@/lib/financeiro/propostas";

type Tipo = "12m" | "ano";

/** Indicador com minigráfico de tendência ao lado. */
function Indicador({
  rotulo,
  valor,
  tom,
  tendencia,
  rodape,
}: {
  rotulo: string;
  valor: string;
  tom?: "pos" | "neg" | "";
  tendencia?: { valores: number[]; descricao: string };
  rodape?: ReactNode;
}) {
  return (
    <div className="figura figura--indicador">
      <span className="figura__rotulo">{rotulo}</span>
      <span className={`figura__valor ${tom ?? ""}`}>{valor}</span>
      {tendencia && <Tendencia valores={tendencia.valores} rotulo={tendencia.descricao} />}
      {rodape && <div className="figura__rodape">{rodape}</div>}
    </div>
  );
}

const tomDe = (v: number): "pos" | "neg" | "" => (v > 0 ? "pos" : v < 0 ? "neg" : "");

export function Dashboard() {
  const { lancamentos: ls, config, metas, propostas } = useDados();
  const [tipo, setTipo] = useState<Tipo>("12m");
  const hoje = hojeISO();
  const atual = mesAtual();
  const ano = Number(atual.slice(0, 4));

  const { meses, anteriores } = useMemo(() => mesesDoPainel(tipo, atual), [tipo, atual]);
  const inicio = primeiroDia(meses[0]);
  const fim = ultimoDia(meses[meses.length - 1]);

  const serie = useMemo(() => serieMensal(ls, config, meses), [ls, config, meses]);
  const serieAnterior = useMemo(() => serieMensal(ls, config, anteriores), [ls, config, anteriores]);
  const caixa = useMemo(() => caixaAgora(ls, config, hoje), [ls, config, hoje]);
  const meta = metas.find((m) => m.ano === ano)?.meta_vgv ?? 0;
  const pm = useMemo(() => progressoMeta(ls, ano, meta, hoje), [ls, ano, meta, hoje]);

  const soma = (s: typeof serie, f: (p: (typeof serie)[number]) => number) => s.reduce((t, p) => t + f(p), 0);
  const receita = soma(serie, (p) => p.receita);
  const despesa = soma(serie, (p) => p.despesa);
  const resultado = receita - despesa;
  const vgv = soma(serie, (p) => p.vgv);
  const vendas = soma(serie, (p) => p.vendas);
  const aportesPeriodo = soma(serie, (p) => p.aportes);
  const ant = {
    receita: soma(serieAnterior, (p) => p.receita),
    despesa: soma(serieAnterior, (p) => p.despesa),
  };
  const sufixo = tipo === "12m" ? "vs. 12 meses anteriores" : `vs. mesmo período de ${ano - 1}`;

  // Caixa: realizado até hoje (fim de cada mês; no mês atual, o saldo de hoje) + previsto com o já lançado
  const agenda = useMemo(() => agendaFutura(ls, caixa, hoje, ultimoDia(somarMeses(atual, 3))), [ls, caixa, hoje, atual]);
  const dadosCaixa = useMemo(() => {
    const realizados = serie.slice(-9).map((p) => ({
      mes: p.mes,
      realizado: p.mes === atual ? caixa.saldo : p.caixa,
      projetado: p.mes === atual ? caixa.saldo : null,
    }));
    let v = caixa.saldo;
    const futuros = [1, 2, 3].map((i) => {
      const mes = somarMeses(atual, i);
      for (const m of agenda.meses) if (m.mes <= mes) v = m.caixaFim;
      return { mes, realizado: null, projetado: v };
    });
    return [...realizados, ...futuros];
  }, [serie, atual, caixa.saldo, agenda]);
  const caixaEm3Meses = dadosCaixa[dadosCaixa.length - 1].projetado ?? caixa.saldo;

  const categorias = useMemo(() => despesasPorCategoria(ls, inicio, fim), [ls, inicio, fim]);
  const itens = useMemo(() => despesasPorItem(ls, inicio, fim).slice(0, 6), [ls, inicio, fim]);
  const corretores = useMemo(() => agruparPor(vendasNoPeriodo(ls, inicio, fim), "corretor").slice(0, 5), [ls, inicio, fim]);
  const aportes = useMemo(() => aportesPorPessoa(ls, inicio, fim).filter((a) => a.periodo > 0), [ls, inicio, fim]);
  const rp = useMemo(() => resumoPropostas(propostas, config, hoje), [propostas, config, hoje]);
  const negociacao = useMemo(() => negociacaoPorCorretor(propostas).slice(0, 5), [propostas]);

  const rotuloPeriodo = `${nomeMes(meses[0], "curto")} a ${nomeMes(meses[meses.length - 1], "curto")}`;
  const tendencia = (f: (p: (typeof serie)[number]) => number, nome: string) => ({
    valores: serie.map(f),
    descricao: `${nome} mês a mês, ${rotuloPeriodo}`,
  });

  return (
    <main className="pagina">
      <CabecalhoPagina titulo="Dashboard" descricao={`Overview do financeiro · ${rotuloPeriodo}`}>
        <div className="segmentos" role="group" aria-label="Período">
          <button type="button" aria-pressed={tipo === "12m"} onClick={() => setTipo("12m")}>
            Últimos 12 meses
          </button>
          <button type="button" aria-pressed={tipo === "ano"} onClick={() => setTipo("ano")}>
            {ano} até agora
          </button>
        </div>
      </CabecalhoPagina>

      {ls.length === 0 && (
        <p className="aviso">
          Ainda não há lançamentos. Os gráficos aparecem conforme você{" "}
          <Link className="link" href="/lancamentos/novo/">
            registra receitas e despesas
          </Link>
          .
        </p>
      )}

      <div className="figuras figuras--5">
        <Indicador
          rotulo="Caixa agora"
          valor={moeda(caixa.saldo)}
          tom={tomDe(caixa.saldo)}
          tendencia={{ valores: [...serie.slice(0, -1).map((p) => p.caixa), caixa.saldo], descricao: `Caixa no fim de cada mês, ${rotuloPeriodo}` }}
          rodape={<span>previsto em 3 meses: {moedaCompacta(caixaEm3Meses)}</span>}
        />
        <Indicador
          rotulo="Receita"
          valor={moeda(receita)}
          tendencia={tendencia((p) => p.receita, "Receita")}
          rodape={<Delta v={variacao(receita, ant.receita)} sufixo={sufixo} />}
        />
        <Indicador
          rotulo="Despesa"
          valor={moeda(despesa)}
          tendencia={tendencia((p) => p.despesa, "Despesa")}
          rodape={<Delta v={variacao(despesa, ant.despesa)} bomQuandoSobe={false} sufixo={sufixo} />}
        />
        <Indicador
          rotulo="Resultado"
          valor={moeda(resultado)}
          tom={tomDe(resultado)}
          tendencia={tendencia((p) => p.resultado, "Resultado")}
          rodape={
            <span>
              margem {receita > 0 ? percentual(resultado / receita) : "—"}
              {aportesPeriodo > 0 && ` · aportes ${moedaCompacta(aportesPeriodo)}`}
            </span>
          }
        />
        <div className="figura figura--indicador">
          <span className="figura__rotulo">VGV vendido em {ano}</span>
          <span className="figura__valor" title={moeda(pm.alcancado)}>
            {moedaCompacta(pm.alcancado)}
          </span>
          {meta > 0 ? (
            <>
              <Medidor progresso={pm.progresso ?? 0} ok={(pm.progresso ?? 0) >= 1} rotulo="VGV vendido sobre a meta do ano" />
              <div className="figura__rodape">
                <span>
                  {percentual(pm.progresso ?? 0)} da meta de {moedaCompacta(meta)}
                </span>
              </div>
            </>
          ) : (
            <div className="figura__rodape">
              <Link className="link" href="/metas/">
                Definir meta do ano
              </Link>
            </div>
          )}
        </div>
      </div>

      <div className="painel-grade">
        <Secao className="span-8" titulo="Fluxo de caixa" nota="entradas e saídas do caixa por mês">
          <GraficoFluxoCaixa
            altura={260}
            dados={serie.map((p) => ({ mes: p.mes, receita: p.receita, despesa: p.despesaCaixa, resultado: p.fluxoCaixa }))}
          />
        </Secao>

        <Secao className="span-4" titulo={`Meta de VGV ${ano}`} nota={meta > 0 ? `${pm.vendas} vendas · ${moedaCompacta(pm.alcancado)}` : undefined}>
          {meta > 0 ? (
            <GraficoMeta dados={pm.serie} altura={260} />
          ) : (
            <p className="vazio">
              Sem meta para {ano}.{" "}
              <Link className="link" href="/metas/">
                Definir meta
              </Link>
            </p>
          )}
        </Secao>

        <Secao className="span-6" titulo="Caixa: realizado e previsto" nota="previsto = só o que já está lançado">
          <GraficoProjecao dados={dadosCaixa} altura={240} />
        </Secao>

        <Secao className="span-6" titulo="Resultado mês a mês" nota="receitas − despesas">
          <GraficoResultado dados={serie.map((p) => ({ mes: p.mes, resultado: p.resultado }))} />
        </Secao>

        <Secao className="span-4" titulo="Despesas por categoria" nota={moedaCompacta(despesa)}>
          <Barras
            itens={categorias.map((c) => ({ nome: c.nome, valor: c.total, detalhe: percentual(c.participacao) }))}
            formatar={moedaCompacta}
            vazio="Nenhuma despesa no período."
          />
        </Secao>

        <Secao className="span-4"
          titulo="Top corretores"
          nota={
            <Link className="link" href="/vendas/">
              {vendas} {vendas === 1 ? "venda" : "vendas"} · VGV {moedaCompacta(vgv)}
            </Link>
          }
        >
          <Barras
            itens={corretores.map((c) => ({
              nome: c.nome,
              valor: c.total,
              detalhe: `${c.qtd} ${c.qtd === 1 ? "venda" : "vendas"} · VGV ${moedaCompacta(c.vgv)}`,
            }))}
            formatar={moedaCompacta}
            vazio="Nenhuma venda no período."
          />
        </Secao>

        <Secao className="span-4"
          titulo="Em negociação"
          nota={
            <Link className="link" href="/propostas/">
              {rp.emNegociacao} {rp.emNegociacao === 1 ? "proposta" : "propostas"} · VGV {moedaCompacta(rp.vgvEmNegociacao)}
            </Link>
          }
        >
          <Barras
            itens={negociacao.map((c) => ({ nome: c.nome, valor: c.vgv, detalhe: `${c.qtd} ${c.qtd === 1 ? "proposta" : "propostas"}` }))}
            formatar={moedaCompacta}
            vazio="Nenhuma proposta em negociação."
          />
          {rp.emNegociacao > 0 && (
            <p className="campo__ajuda" style={{ margin: "10px 0 0" }}>
              Líquido potencial {moedaCompacta(rp.liquidoPotencial)}
              {rp.conversao !== null && ` · conversão de ${percentual(rp.conversao)} em 12 meses`}
              {rp.paradas > 0 && ` · ${rp.paradas} parada${rp.paradas === 1 ? "" : "s"} há +30 dias`}
            </p>
          )}
        </Secao>

        <Secao className="span-6" titulo="Maiores custos" nota="por item de custo">
          <Barras
            itens={itens.map((g) => ({ nome: g.nome, valor: g.total, detalhe: g.categorias.join(", ") }))}
            formatar={moedaCompacta}
            vazio="Nenhuma despesa no período."
          />
        </Secao>

        <Secao className="span-6" titulo="Aportes por pessoa" nota="despesas pagas fora do caixa">
          <Barras
            itens={aportes.map((a) => ({ nome: a.nome, valor: a.periodo, detalhe: `total histórico ${moedaCompacta(a.total)}` }))}
            formatar={moedaCompacta}
            vazio="Nenhum aporte no período."
          />
        </Secao>
      </div>
    </main>
  );
}
