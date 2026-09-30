"use client";

import Link from "next/link";
import { Fragment, useMemo, useState } from "react";
import { GraficoLinha } from "@/components/graficos/Graficos";
import { Icone } from "@/components/Icones";
import { useDados } from "@/components/Painel";
import { CabecalhoPagina, Figura, Figuras, Secao, Valor } from "@/components/ui";
import { criarLancamentos, excluirSerieDesde } from "@/lib/dados";
import { caixaAgora, comSinal } from "@/lib/financeiro/calculos";
import { chaveMes, hojeISO, nomeMes, somarMesesData } from "@/lib/financeiro/datas";
import { dataBR, moeda } from "@/lib/financeiro/formato";
import { agendaFutura, extensaoFixo, resumoSeries, rotuloLancamento, rotuloSerie, type ResumoSerie } from "@/lib/financeiro/futuros";
import { CAIXA, MESES_FIXO } from "@/lib/financeiro/tipos";

const HORIZONTES = [
  { id: "30", rotulo: "30 dias", meses: null, dias: 30 },
  { id: "90", rotulo: "90 dias", meses: null, dias: 90 },
  { id: "12m", rotulo: "12 meses", meses: 12, dias: null },
  { id: "tudo", rotulo: "Tudo", meses: null, dias: null },
] as const;

const DIAS_SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const diaSemana = (iso: string) => DIAS_SEMANA[new Date(`${iso}T12:00:00Z`).getUTCDay()];

function limite(hoje: string, h: (typeof HORIZONTES)[number]): string | null {
  if (h.dias) return new Date(Date.parse(`${hoje}T00:00:00Z`) + h.dias * 86_400_000).toISOString().slice(0, 10);
  if (h.meses) return somarMesesData(hoje, h.meses);
  return null;
}

export function Futuros() {
  const { lancamentos: ls, config, recarregar } = useDados();
  const hoje = hojeISO();
  const [horizonte, setHorizonte] = useState<(typeof HORIZONTES)[number]["id"]>("90");
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "erro"; msg: string } | null>(null);

  const h = HORIZONTES.find((x) => x.id === horizonte)!;
  const ate = limite(hoje, h);
  const caixa = useMemo(() => caixaAgora(ls, config, hoje), [ls, config, hoje]);
  const agenda = useMemo(() => agendaFutura(ls, caixa, hoje, ate), [ls, caixa, hoje, ate]);
  const series = useMemo(() => resumoSeries(ls, hoje), [ls, hoje]);
  const ativas = series.filter((s) => s.restantes > 0);
  const acabando = series.filter((s) => s.acabando);

  async function executar(chave: string, fn: () => Promise<string>) {
    setOcupado(chave);
    setAviso(null);
    try {
      const msg = await fn();
      await recarregar();
      setAviso({ tipo: "ok", msg });
    } catch (e) {
      setAviso({ tipo: "erro", msg: e instanceof Error ? e.message : String(e) });
    } finally {
      setOcupado(null);
    }
  }

  const estender = (s: ResumoSerie) =>
    executar(`estender-${s.serieId}`, async () => {
      const novos = extensaoFixo(s);
      await criarLancamentos(novos);
      return `${s.nome}: agendado até ${nomeMes(chaveMes(novos[novos.length - 1].data))}.`;
    });

  const encerrar = (s: ResumoSerie) => {
    if (!s.proxima) return;
    if (
      !confirm(
        `Encerrar "${s.nome}"? As ${s.restantes} ocorrências a partir de ${dataBR(s.proxima.data)} serão excluídas. As que já passaram continuam no histórico.`,
      )
    )
      return;
    executar(`encerrar-${s.serieId}`, async () => {
      const n = await excluirSerieDesde(s.serieId, s.proxima!.data);
      return `${s.nome}: ${n} ${n === 1 ? "ocorrência futura excluída" : "ocorrências futuras excluídas"}.`;
    });
  };

  const grafico = [{ mes: chaveMes(hoje), valor: caixa.saldo }, ...agenda.meses.map((m) => ({ mes: m.mes, valor: m.caixaFim }))];
  const total = agenda.meses.reduce((n, m) => n + m.itens.length, 0);

  return (
    <main className="pagina">
      <CabecalhoPagina
        titulo="Lançamentos futuros"
        descricao="Tudo o que já está lançado com data à frente. Cada lançamento entra no financeiro no mês dele."
      >
        <Link href="/lancamentos/novo/" className="btn btn--primario">
          <Icone nome="mais" tamanho={16} />
          Novo lançamento
        </Link>
      </CabecalhoPagina>

      <div className="filtro" style={{ marginBottom: 16 }}>
        <div className="segmentos" role="group" aria-label="Horizonte">
          {HORIZONTES.map((x) => (
            <button key={x.id} type="button" aria-pressed={horizonte === x.id} onClick={() => setHorizonte(x.id)}>
              {x.rotulo}
            </button>
          ))}
        </div>
        <span className="muted" style={{ fontSize: 13.5 }}>
          {ate ? `de amanhã até ${dataBR(ate)}` : "todos os lançamentos futuros"}
        </span>
      </div>

      {acabando.length > 0 && (
        <p className="aviso">
          {acabando.length === 1 ? "Um lançamento fixo está" : `${acabando.length} lançamentos fixos estão`} perto do fim do
          agendamento: {acabando.map((s) => `${s.nome} (até ${nomeMes(chaveMes(s.ultima.data), "curto")})`).join(", ")}. Use{" "}
          <strong>Estender</strong> em Séries, abaixo.
        </p>
      )}

      <Figuras>
        <Figura rotulo="Entradas previstas" valor={agenda.entradas} tom={agenda.entradas ? "positivo" : "neutro"} />
        <Figura rotulo="Saídas do caixa previstas" valor={agenda.saidasCaixa} />
        <Figura
          rotulo="Aportes previstos"
          valor={agenda.aportes}
          rodape={<span>pagos por aportadores, fora do caixa</span>}
        />
        <Figura
          rotulo={ate ? `Caixa previsto em ${dataBR(ate)}` : "Caixa previsto no fim"}
          valor={agenda.caixaFinal}
          tom="auto"
          rodape={<span>partindo de {moeda(caixa.saldo)} hoje</span>}
        />
      </Figuras>

      {agenda.meses.length > 0 && (
        <Secao titulo="Caixa previsto" nota="só com o que já está lançado">
          <GraficoLinha dados={grafico} nome="Caixa previsto" altura={220} />
          <p className="campo__ajuda" style={{ margin: "8px 0 0" }}>
            Considera apenas lançamentos já registrados com data futura. Novas vendas ainda não lançadas não entram — a
            projeção pela média fica em Metas &amp; projeções.
          </p>
        </Secao>
      )}

      <Secao titulo="Agenda" nota={`${total} ${total === 1 ? "lançamento" : "lançamentos"}`}>
        {agenda.meses.length ? (
          <div className="tabela-wrap">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Lançamento</th>
                  <th>Quem pagou</th>
                  <th className="num">Valor</th>
                  <th className="num">Caixa após</th>
                  <th className="acoes">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {agenda.meses.map((m) => (
                  <Fragment key={m.mes}>
                    <tr className="tabela__grupo">
                      <td colSpan={6}>
                        <span>{nomeMes(m.mes)}</span>
                        <span className="muted">
                          entradas {moeda(m.entradas)} · saídas {moeda(m.saidasCaixa)}
                          {m.aportes > 0 && ` · aportes ${moeda(m.aportes)}`} · caixa no fim{" "}
                          <Valor v={m.caixaFim} tom="auto" />
                        </span>
                      </td>
                    </tr>
                    {m.itens.map(({ lancamento: l, caixaApos }) => (
                      <tr key={l.id}>
                        <td className="num">
                          {dataBR(l.data).slice(0, 5)}
                          <span className="secundario">{diaSemana(l.data)}</span>
                        </td>
                        <td>
                          {rotuloLancamento(l)}{" "}
                          {rotuloSerie(l) && <span className="selo">{rotuloSerie(l)}</span>}
                          <span className="secundario">
                            {[l.categoria, l.descricao && l.descricao !== rotuloLancamento(l) ? l.descricao : null]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        </td>
                        <td>{l.origem_recurso ?? <span className="muted">—</span>}</td>
                        <td className="num">
                          <Valor v={comSinal(l)} tom="auto" sinal />
                        </td>
                        <td className="num">
                          {caixaApos === null ? (
                            <span className="muted">aporte</span>
                          ) : (
                            <Valor v={caixaApos} tom={caixaApos < 0 ? "negativo" : "neutro"} />
                          )}
                        </td>
                        <td className="acoes">
                          <Link className="btn btn--pequeno btn--fantasma" href={`/lancamentos/editar/?id=${l.id}`}>
                            Editar
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="vazio">
            Nada agendado {ate ? "neste período" : "ainda"}.{" "}
            <Link className="link" href="/lancamentos/novo/">
              Lançar uma despesa ou receita futura
            </Link>
          </p>
        )}
      </Secao>

      <Secao titulo="Séries" nota="lançamentos que se repetem">
        {aviso && (
          <p className={`aviso ${aviso.tipo === "ok" ? "aviso--ok" : "aviso--erro"}`} role="status" style={{ marginBottom: 12 }}>
            {aviso.msg}
          </p>
        )}
        {series.length ? (
          <div className="tabela-wrap">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Lançamento</th>
                  <th>Tipo</th>
                  <th className="num">Valor</th>
                  <th>Próxima</th>
                  <th>Andamento</th>
                  <th className="acoes">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {series.map((s) => (
                  <tr key={s.serieId}>
                    <td>
                      {s.nome}
                      <span className="secundario">
                        {s.categoria}
                        {s.origem && s.origem !== CAIXA && ` · aporte de ${s.origem}`}
                      </span>
                    </td>
                    <td>{s.recorrencia === "fixo" ? "Fixo mensal" : `Parcelado em ${s.total}x`}</td>
                    <td className="num">{moeda(s.valor)}</td>
                    <td className="num">{s.proxima ? dataBR(s.proxima.data) : <span className="muted">—</span>}</td>
                    <td>
                      {s.recorrencia === "fixo" ? (
                        <>
                          até {nomeMes(chaveMes(s.ultima.data), "curto")}
                          {s.acabando && (
                            <>
                              {" "}
                              <span className="selo selo--alerta">acabando</span>
                            </>
                          )}
                        </>
                      ) : s.restantes ? (
                        `${s.total - s.restantes} de ${s.total} já passaram · faltam ${s.restantes}`
                      ) : (
                        <span className="selo selo--fechada">concluído</span>
                      )}
                    </td>
                    <td className="acoes">
                      {s.recorrencia === "fixo" && (
                        <button
                          className="btn btn--pequeno"
                          disabled={ocupado !== null}
                          onClick={() => estender(s)}
                          title={`Agenda mais ${MESES_FIXO} meses`}
                        >
                          {ocupado === `estender-${s.serieId}` ? "Estendendo…" : `Estender ${MESES_FIXO} meses`}
                        </button>
                      )}{" "}
                      {s.restantes > 0 && (
                        <button className="btn btn--pequeno btn--fantasma" disabled={ocupado !== null} onClick={() => encerrar(s)}>
                          Encerrar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="vazio">
            Nenhuma série ainda. Ao lançar, escolha <strong>Fixo mensal</strong> (ex.: aluguel) ou <strong>Parcelado</strong>{" "}
            em &ldquo;Repetição&rdquo;.
          </p>
        )}
        {ativas.length > 0 && (
          <p className="campo__ajuda" style={{ margin: "10px 0 0" }}>
            Para mudar o valor de uma série (ex.: reajuste do aluguel), edite a próxima ocorrência e marque &ldquo;aplicar às
            seguintes&rdquo;.
          </p>
        )}
      </Secao>
    </main>
  );
}
