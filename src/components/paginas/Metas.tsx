"use client";

import { useMemo } from "react";
import { NavegadorMes, useMesSelecionado } from "@/components/Filtros";
import { GraficoProjecao, GraficoReserva } from "@/components/graficos/Graficos";
import { CabecalhoPagina, Figura, Figuras, Medidor, ROTULO_FONTE, Secao, Valor } from "@/components/ui";
import { useDados } from "@/components/Painel";
import {
  agregarPorMes,
  MIN_MESES_HISTORICO,
  MIN_VENDAS_HISTORICO,
  mesesDoHistorico,
  pontoEquilibrio,
  projecao,
  reserva,
  serieMensal,
  serieReserva,
} from "@/lib/financeiro/calculos";
import { mesAtual, nomeMes, ultimosMeses } from "@/lib/financeiro/datas";
import { moeda, num, percentual } from "@/lib/financeiro/formato";
import { CATEGORIAS_OPERACIONAIS } from "@/lib/financeiro/tipos";

export function Metas() {
  const { lancamentos: ls, config } = useDados();
  const mes = useMesSelecionado();
  const corrente = mesAtual();

  const pe = useMemo(() => pontoEquilibrio(ls, config, mes, corrente), [ls, config, mes, corrente]);
  const doMes = useMemo(() => agregarPorMes(ls).get(mes), [ls, mes]);
  const proj = useMemo(() => projecao(ls, config, corrente), [ls, config, corrente]);
  const res = useMemo(() => reserva(ls, config, mes), [ls, config, mes]);
  const historicoReserva = useMemo(() => serieReserva(ls, config, mesesDoHistorico(ls, mes, 12)), [ls, config, mes]);

  const realizados = useMemo(() => serieMensal(ls, config, ultimosMeses(corrente, 6)), [ls, config, corrente]);
  const dadosProjecao = [
    ...realizados.map((p, i) => ({
      mes: p.mes,
      realizado: p.acumulado,
      // O último mês real também abre a linha projetada, para as duas se ligarem.
      projetado: i === realizados.length - 1 ? p.acumulado : null,
    })),
    ...proj.pontos.map((p) => ({ mes: p.mes, realizado: null, projetado: p.acumulado })),
  ];

  const resultadoMedio = proj.base.receitaMedia - proj.base.despesaMedia;

  return (
    <main className="pagina">
      <CabecalhoPagina titulo="Metas & projeções" descricao="Ponto de equilíbrio, reserva e para onde o caixa está indo.">
        <NavegadorMes />
      </CabecalhoPagina>

      <Secao titulo="Ponto de equilíbrio" nota={nomeMes(mes)}>
        <div className="colunas">
          <div className="tabela-wrap">
            <table className="tabela">
              <tbody>
                <tr>
                  <td>
                    Custo operacional do mês
                    <span className="secundario">
                      {ROTULO_FONTE[pe.custo.fonte]}
                      {pe.custo.fonte !== "realizado" && ` · já lançado: ${moeda(pe.custo.realizado)}`}
                    </span>
                  </td>
                  <td className="num">{moeda(pe.custo.valor)}</td>
                </tr>
                <tr>
                  <td>
                    ÷ Comissão média por venda
                    <span className="secundario">
                      {ROTULO_FONTE[pe.comissaoMedia.fonte]} · {pe.comissaoMedia.vendas}{" "}
                      {pe.comissaoMedia.vendas === 1 ? "venda" : "vendas"} nos últimos 12 meses
                    </span>
                  </td>
                  <td className="num">{moeda(pe.comissaoMedia.valor)}</td>
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <td>= Vendas necessárias no mês</td>
                  <td className="num">{pe.vendasNecessarias === null ? "—" : num(pe.vendasNecessarias)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div>
            <Figuras>
              <Figura rotulo="Vendas fechadas" valor={pe.vendasFechadas} formato="numero" />
              <Figura
                rotulo="Faltam"
                valor={pe.faltam}
                formato="numero"
                tom={pe.faltam === 0 ? "positivo" : "neutro"}
              />
              <Figura
                rotulo="Comissões cobrem"
                valor={pe.cobertura}
                formato="pct"
                tom={pe.cobertura !== null && pe.cobertura >= 1 ? "positivo" : "neutro"}
                rodape={<span>{moeda(pe.comissoesDoMes)} do custo</span>}
              />
            </Figuras>
            {pe.cobertura !== null && (
              <Medidor progresso={pe.cobertura} ok={pe.cobertura >= 1} rotulo="Comissões do mês sobre o custo operacional" />
            )}
          </div>
        </div>

        <div className="colunas" style={{ marginTop: 20 }}>
          <div>
            <p className="rotulo" style={{ margin: "0 0 6px" }}>Custo operacional lançado no mês</p>
            <table className="tabela">
              <tbody>
                {CATEGORIAS_OPERACIONAIS.map((c) => (
                  <tr key={c}>
                    <td>{c}</td>
                    <td className="num">{moeda(doMes?.porCategoria[c] ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>Total operacional</td>
                  <td className="num">{moeda(doMes?.operacional ?? 0)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="ajuda-bloco">
            <p className="rotulo" style={{ margin: "0 0 6px" }}>Como é calculado</p>
            <p>
              <strong>Custo operacional</strong> é toda despesa do mês, <em>exceto retirada de sócios</em> — retirada é
              distribuição de lucro, não custo. Em meses encerrados vale o que foi lançado; no mês em curso, vale o maior entre
              o já lançado e a média dos 3 meses anteriores (as contas ainda estão chegando).
            </p>
            <p>
              <strong>Comissão média</strong> é o líquido da empresa por venda nos últimos 12 meses.
            </p>
            <p>
              Com menos de {MIN_MESES_HISTORICO} meses de histórico de custos ou menos de {MIN_VENDAS_HISTORICO} vendas, o
              painel usa as estimativas das configurações ({moeda(config.custo_fixo_estimado)} de custo e{" "}
              {moeda(config.comissao_media_esperada)} por venda).
            </p>
          </div>
        </div>
      </Secao>

      <Secao titulo="Projeção de caixa" nota="próximos 3 meses · média móvel">
        <Figuras>
          <Figura rotulo="Entradas médias / mês" valor={proj.base.receitaMedia} />
          <Figura rotulo="Saídas médias / mês" valor={proj.base.despesaMedia} />
          <Figura rotulo="Resultado médio / mês" valor={resultadoMedio} tom="auto" />
          <Figura
            rotulo={`Caixa em ${nomeMes(proj.pontos[proj.pontos.length - 1].mes, "curto")}`}
            valor={proj.pontos[proj.pontos.length - 1].acumulado}
            tom="auto"
          />
        </Figuras>
        <p className="campo__ajuda">
          {proj.base.fonte === "historico"
            ? `Base: média de ${proj.base.meses.map((m) => nomeMes(m, "curto")).join(", ")} (meses encerrados). Retiradas entram, pois o dinheiro sai do caixa.`
            : proj.base.fonte === "estimado"
              ? "Sem meses encerrados com lançamentos: projeção prudente com o custo fixo estimado e nenhuma receita."
              : "Sem histórico nem custo estimado — a projeção fica plana."}{" "}
          Ponto de partida: caixa de {moeda(proj.saldoPartida)} ao fim de {nomeMes(corrente)}.
        </p>
        <div className="colunas" style={{ marginTop: 16 }}>
          <GraficoProjecao dados={dadosProjecao} />
          <div className="tabela-wrap">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Mês</th>
                  <th className="num">Entradas</th>
                  <th className="num">Saídas</th>
                  <th className="num">Caixa projetado</th>
                </tr>
              </thead>
              <tbody>
                {proj.pontos.map((p) => (
                  <tr key={p.mes}>
                    <td>{nomeMes(p.mes)}</td>
                    <td className="num">{moeda(p.receita)}</td>
                    <td className="num">{moeda(p.despesa)}</td>
                    <td className="num">
                      <Valor v={p.acumulado} tom="auto" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Secao>

      <Secao titulo="Reserva de caixa" nota={`meta: ${config.reserva_meses_alvo} meses de custo operacional`}>
        <Figuras>
          <Figura rotulo="Caixa acumulado" valor={res.caixa} tom="auto" />
          <Figura rotulo="Meta" valor={res.meta} rodape={<span>{moeda(res.custoMedio.valor)}/mês · {ROTULO_FONTE[res.custoMedio.fonte]}</span>} />
          <Figura rotulo="Progresso" valor={res.progresso} formato="pct" tom={res.progresso !== null && res.progresso >= 1 ? "positivo" : "neutro"} />
          <Figura rotulo="Meses cobertos" valor={res.mesesCobertos === null ? null : Math.max(0, res.mesesCobertos)} formato="numero" />
        </Figuras>
        {res.progresso !== null && <Medidor progresso={res.progresso} ok={res.progresso >= 1} rotulo="Progresso da reserva" />}
        <div style={{ marginTop: 16 }}>
          <GraficoReserva dados={historicoReserva} />
        </div>
        <p className="campo__ajuda">
          A meta de cada mês usa o custo operacional médio dos 6 meses anteriores
          {res.progresso !== null && ` · hoje em ${percentual(Math.max(0, res.progresso))}`}.
        </p>
      </Secao>
    </main>
  );
}
