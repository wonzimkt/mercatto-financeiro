"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { NavegadorMes, useMesSelecionado } from "@/components/Filtros";
import { GraficoMeta, GraficoProjecao } from "@/components/graficos/Graficos";
import { CabecalhoPagina, Figura, Figuras, Medidor, ROTULO_FONTE, Secao, Valor } from "@/components/ui";
import { useDados } from "@/components/Painel";
import { salvarMeta } from "@/lib/dados";
import {
  agregarPorMes,
  MIN_MESES_HISTORICO,
  MIN_VENDAS_HISTORICO,
  pontoEquilibrio,
  progressoMeta,
  projecao,
  serieMensal,
} from "@/lib/financeiro/calculos";
import { hojeISO, mesAtual, nomeMes, ultimosMeses } from "@/lib/financeiro/datas";
import { lerValor, moeda, moedaCompacta, paraCampo, percentual } from "@/lib/financeiro/formato";
import { CATEGORIAS_OPERACIONAIS } from "@/lib/financeiro/tipos";

function MetaDeVendas({ ano }: { ano: number }) {
  const { lancamentos: ls, metas, recarregar } = useDados();
  const hoje = hojeISO();
  const meta = metas.find((m) => m.ano === ano)?.meta_vgv ?? 0;
  const pm = useMemo(() => progressoMeta(ls, ano, meta, hoje), [ls, ano, meta, hoje]);

  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(paraCampo(meta || null));
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  useEffect(() => {
    setValor(paraCampo(meta || null));
    setEditando(false);
    setErro("");
  }, [ano, meta]);

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    const v = lerValor(valor);
    if (!(v >= 0)) return setErro("Informe um valor válido.");
    setSalvando(true);
    setErro("");
    try {
      await salvarMeta({ ano, meta_vgv: v });
      await recarregar();
      setEditando(false);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setSalvando(false);
    }
  }

  const formulario = (
    <form className="form-linha" onSubmit={salvar} noValidate>
      <div className="campo">
        <label htmlFor="meta-vgv">Meta de VGV para {ano} (R$)</label>
        <input
          id="meta-vgv"
          className="num"
          inputMode="decimal"
          placeholder="0,00"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          aria-invalid={erro ? true : undefined}
          autoFocus={editando}
        />
      </div>
      <button className="btn btn--primario" type="submit" disabled={salvando}>
        {salvando ? "Salvando…" : "Salvar meta"}
      </button>
      {meta > 0 && (
        <button className="btn btn--fantasma" type="button" onClick={() => setEditando(false)}>
          Cancelar
        </button>
      )}
      {erro && <p className="campo__erro" style={{ width: "100%", margin: 0 }}>{erro}</p>}
    </form>
  );

  const ritmo =
    pm.esperadoAteHoje === null
      ? null
      : pm.alcancado >= pm.esperadoAteHoje
        ? { tom: "positivo" as const, texto: "Adiantado", valor: pm.alcancado - pm.esperadoAteHoje }
        : { tom: "negativo" as const, texto: "Atrasado", valor: pm.esperadoAteHoje - pm.alcancado };

  return (
    <Secao
      titulo={`Meta de vendas ${ano}`}
      nota="em VGV vendido"
      acoes={
        meta > 0 &&
        !editando && (
          <button className="btn btn--pequeno" onClick={() => setEditando(true)}>
            Alterar meta
          </button>
        )
      }
    >
      {!meta || editando ? (
        <>
          {!meta && (
            <p className="campo__ajuda" style={{ margin: "0 0 12px" }}>
              Defina quanto de VGV a Mercatto quer vender em {ano}. O painel acompanha o vendido e o ritmo mês a mês.
            </p>
          )}
          {formulario}
        </>
      ) : (
        <>
          <Figuras>
            <Figura rotulo="Meta de VGV" valor={pm.meta} formato="compacto" />
            <Figura
              rotulo="VGV vendido"
              valor={pm.alcancado}
              formato="compacto"
              rodape={
                <span>
                  {pm.vendas} {pm.vendas === 1 ? "venda" : "vendas"} · {percentual(pm.progresso ?? 0)} da meta
                </span>
              }
            />
            <Figura rotulo="Falta vender" valor={pm.falta} formato="compacto" tom={pm.falta === 0 ? "positivo" : "neutro"} />
            {ritmo ? (
              <Figura
                rotulo={`${ritmo.texto} no ritmo`}
                valor={ritmo.valor}
                formato="compacto"
                tom={ritmo.tom}
                rodape={<span>esperado até hoje: {moedaCompacta(pm.esperadoAteHoje ?? 0)}</span>}
              />
            ) : (
              <Figura rotulo="Média por mês" valor={pm.alcancado / 12} formato="compacto" />
            )}
          </Figuras>
          <Medidor progresso={pm.progresso ?? 0} ok={(pm.progresso ?? 0) >= 1} rotulo="VGV vendido sobre a meta" />
        </>
      )}

      {meta > 0 && (
        <div style={{ marginTop: 12 }}>
          <GraficoMeta dados={pm.serie} />
        </div>
      )}
    </Secao>
  );
}

export function Metas() {
  const { lancamentos: ls, config } = useDados();
  const mes = useMesSelecionado();
  const corrente = mesAtual();
  const ano = Number(mes.slice(0, 4));

  const pe = useMemo(() => pontoEquilibrio(ls, config, mes, corrente), [ls, config, mes, corrente]);
  const doMes = useMemo(() => agregarPorMes(ls).get(mes), [ls, mes]);
  const proj = useMemo(() => projecao(ls, config, corrente), [ls, config, corrente]);

  const realizados = useMemo(() => serieMensal(ls, config, ultimosMeses(corrente, 6)), [ls, config, corrente]);
  const dadosProjecao = [
    ...realizados.map((p, i) => ({
      mes: p.mes,
      realizado: p.caixa,
      // O último mês real também abre a linha projetada, para as duas se ligarem.
      projetado: i === realizados.length - 1 ? p.caixa : null,
    })),
    ...proj.pontos.map((p) => ({ mes: p.mes, realizado: null, projetado: p.caixa })),
  ];
  const ultimo = proj.pontos[proj.pontos.length - 1];

  return (
    <main className="pagina">
      <CabecalhoPagina titulo="Metas & projeções" descricao="Meta de vendas do ano, ponto de equilíbrio e para onde o caixa está indo.">
        <NavegadorMes />
      </CabecalhoPagina>

      <MetaDeVendas ano={ano} />

      <Secao titulo="Ponto de equilíbrio" nota={nomeMes(mes)}>
        <div className="colunas">
          <div className="tabela-wrap">
            <table className="tabela" style={{ minWidth: 0 }}>
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
                    ÷ Comissão líquida média por venda
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
                  <td className="num">{pe.vendasNecessarias === null ? "—" : pe.vendasNecessarias}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div>
            <Figuras>
              <Figura rotulo="Vendas fechadas" valor={pe.vendasFechadas} formato="numero" />
              <Figura rotulo="Faltam" valor={pe.faltam} formato="numero" tom={pe.faltam === 0 ? "positivo" : "neutro"} />
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
            <p className="rotulo" style={{ margin: "0 0 6px" }}>
              Custo operacional lançado no mês
            </p>
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
            <p className="rotulo" style={{ margin: "0 0 6px" }}>
              Como é calculado
            </p>
            <p>
              <strong>Custo operacional</strong> é toda despesa do mês, <em>exceto retirada de sócios</em> — retirada é
              distribuição de lucro, não custo. Despesas pagas pela Cris também contam. Em meses encerrados vale o que foi
              lançado; no mês em curso, vale o maior entre o já lançado e a média dos 3 meses anteriores.
            </p>
            <p>
              <strong>Comissão líquida média</strong> é o que ficou com a Mercatto por venda (split − imposto da NF) nos
              últimos 12 meses.
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
          <Figura rotulo="Saídas do caixa / mês" valor={proj.base.saidaMedia} />
          <Figura rotulo="Variação média / mês" valor={proj.base.receitaMedia - proj.base.saidaMedia} tom="auto" />
          <Figura rotulo={`Caixa em ${nomeMes(ultimo.mes, "curto")}`} valor={ultimo.caixa} tom="auto" />
        </Figuras>
        <p className="campo__ajuda">
          {proj.base.fonte === "historico"
            ? `Base: média de ${proj.base.meses.map((m) => nomeMes(m, "curto")).join(", ")} (meses encerrados). Despesas pagas pela Cris não entram, pois não saem do caixa.`
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
                    <td className="num">{moeda(p.saida)}</td>
                    <td className="num">
                      <Valor v={p.caixa} tom="auto" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Secao>
    </main>
  );
}
