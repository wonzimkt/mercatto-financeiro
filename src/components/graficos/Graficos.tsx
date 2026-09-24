"use client";

/**
 * Gráficos do painel. Regras seguidas em todos:
 * - um eixo só (nunca dois eixos Y);
 * - cores por papel, validadas para daltonismo nos dois temas
 *   (--viz-pos / --viz-neg para entrada/saída, --viz-caixa / --viz-cris
 *   para origem, --viz-bar para magnitude de uma série só);
 * - barras ≤ 24px com ponta arredondada, linhas de 2px, marcadores com
 *   anel da cor do fundo;
 * - legenda sempre que há 2+ séries; dica (tooltip) ao passar o mouse;
 * - texto nunca na cor da série.
 */

import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { moeda, moedaCompacta } from "@/lib/financeiro/formato";
import { nomeMes } from "@/lib/financeiro/datas";

// ─── Peças comuns ───────────────────────────────────────────────────────

const eixoX = {
  tick: { fill: "var(--viz-axis)", fontSize: 12 },
  axisLine: { stroke: "var(--rule)" },
  tickLine: false,
  tickMargin: 8,
  interval: "preserveStartEnd" as const,
  minTickGap: 12,
};

const eixoY = {
  tick: { fill: "var(--viz-axis)", fontSize: 12 },
  axisLine: false,
  tickLine: false,
  width: 76,
  tickFormatter: (v: number) => moedaCompacta(v),
};

const grade = <CartesianGrid vertical={false} stroke="var(--viz-grid)" strokeWidth={1} />;

interface ItemDica {
  name?: string | number;
  value?: unknown;
  color?: string;
  dataKey?: unknown;
  payload?: Record<string, unknown>;
}

interface PropsDica {
  active?: boolean;
  payload?: ReadonlyArray<ItemDica>;
  label?: unknown;
  formatar?: (v: number) => string;
  /** Troca o valor exibido (ex.: despesa guardada negativa aparece positiva). */
  transformar?: (item: ItemDica) => number | null;
  tracejadas?: string[];
}

function Dica({ active, payload, label, formatar = moeda, transformar, tracejadas = [] }: PropsDica) {
  if (!active || !payload?.length) return null;
  const titulo = typeof label === "string" && /^\d{4}-\d{2}$/.test(label) ? nomeMes(label) : String(label ?? "");
  return (
    <div className="dica">
      <div className="dica__titulo">{titulo}</div>
      {payload
        .filter((p) => p.value !== null && p.value !== undefined)
        .map((p) => {
          const v = transformar ? transformar(p) : Number(p.value);
          const tracejada = tracejadas.includes(String(p.dataKey));
          return (
            <div className="dica__linha" key={String(p.dataKey)}>
              <span>
                <i
                  className={`chave ${tracejada ? "chave--tracejada" : ""}`}
                  style={tracejada ? { borderColor: p.color } : { background: p.color }}
                />
                {p.name}
              </span>
              <span className="num">{v === null ? "—" : formatar(v)}</span>
            </div>
          );
        })}
    </div>
  );
}

export function Legenda({
  itens,
}: {
  itens: { rotulo: string; cor: string; forma?: "bloco" | "linha" | "tracejada" }[];
}) {
  return (
    <ul className="grafico__legenda">
      {itens.map((i) => (
        <li key={i.rotulo}>
          <i
            className={`chave ${i.forma === "linha" ? "chave--linha" : i.forma === "tracejada" ? "chave--tracejada" : ""}`}
            style={i.forma === "tracejada" ? { borderColor: i.cor } : { background: i.cor }}
          />
          {i.rotulo}
        </li>
      ))}
    </ul>
  );
}

const rotuloMes = (m: string) => nomeMes(m, "curto");
const ponto = (cor: string) => ({ r: 4, fill: cor, stroke: "var(--bg)", strokeWidth: 2 });
const pontoAtivo = (cor: string) => ({ r: 6, fill: cor, stroke: "var(--bg)", strokeWidth: 2 });

// ─── Fluxo de caixa (entradas ↑, saídas ↓, resultado em linha) ──────────

export function GraficoFluxoCaixa({
  dados,
  altura = 300,
}: {
  dados: { mes: string; receita: number; despesa: number; resultado: number }[];
  altura?: number;
}) {
  const serie = dados.map((d) => ({ ...d, saida: -d.despesa }));
  return (
    <figure className="grafico" style={{ margin: 0 }}>
      <Legenda
        itens={[
          { rotulo: "Entradas", cor: "var(--viz-pos)" },
          { rotulo: "Saídas", cor: "var(--viz-neg)" },
          { rotulo: "Resultado do mês", cor: "var(--viz-line)", forma: "linha" },
        ]}
      />
      <ResponsiveContainer width="100%" height={altura}>
        <ComposedChart data={serie} stackOffset="sign" margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="28%">
          {grade}
          <XAxis dataKey="mes" tickFormatter={rotuloMes} {...eixoX} />
          <YAxis {...eixoY} />
          <ReferenceLine y={0} stroke="var(--rule-strong)" />
          <Tooltip
            cursor={{ fill: "var(--rule-soft)" }}
            content={(p) => (
              <Dica
                active={p.active}
                payload={p.payload as ReadonlyArray<ItemDica> | undefined}
                label={p.label}
                transformar={(i) => (i.dataKey === "saida" ? Math.abs(Number(i.value)) : Number(i.value))}
              />
            )}
          />
          <Bar dataKey="receita" name="Entradas" stackId="fluxo" fill="var(--viz-pos)" maxBarSize={22} radius={[4, 4, 0, 0]} />
          <Bar dataKey="saida" name="Saídas" stackId="fluxo" fill="var(--viz-neg)" maxBarSize={22} radius={[0, 0, 4, 4]} />
          <Line
            dataKey="resultado"
            name="Resultado"
            type="linear"
            stroke="var(--viz-line)"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            dot={ponto("var(--viz-line)")}
            activeDot={pontoAtivo("var(--viz-line)")}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </figure>
  );
}

// ─── Linha de uma série (ticket médio, small multiples) ─────────────────

export function GraficoLinha({
  dados,
  nome,
  altura = 220,
  cor = "var(--viz-bar)",
  compacto = false,
  formatar = moeda,
}: {
  dados: { mes: string; valor: number | null }[];
  nome: string;
  altura?: number;
  cor?: string;
  compacto?: boolean;
  formatar?: (v: number) => string;
}) {
  return (
    <ResponsiveContainer width="100%" height={altura}>
      <LineChart data={dados} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        {grade}
        <XAxis dataKey="mes" tickFormatter={rotuloMes} {...eixoX} hide={compacto} />
        <YAxis {...eixoY} width={compacto ? 56 : 76} tickCount={compacto ? 3 : 5} />
        <Tooltip
          cursor={{ stroke: "var(--rule-strong)", strokeWidth: 1 }}
          content={(p) => (
            <Dica active={p.active} payload={p.payload as ReadonlyArray<ItemDica> | undefined} label={p.label} formatar={formatar} />
          )}
        />
        <Line
          dataKey="valor"
          name={nome}
          type="linear"
          stroke={cor}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          dot={compacto ? false : ponto(cor)}
          activeDot={pontoAtivo(cor)}
          connectNulls={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ─── Saldo acumulado por origem (Caixa × Cris) ──────────────────────────

export function GraficoOrigens({
  dados,
  altura = 280,
}: {
  dados: { mes: string; Caixa: number; Cris: number }[];
  altura?: number;
}) {
  return (
    <figure className="grafico" style={{ margin: 0 }}>
      <Legenda
        itens={[
          { rotulo: "Caixa", cor: "var(--viz-caixa)", forma: "linha" },
          { rotulo: "Cris", cor: "var(--viz-cris)", forma: "linha" },
        ]}
      />
      <ResponsiveContainer width="100%" height={altura}>
        <LineChart data={dados} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          {grade}
          <XAxis dataKey="mes" tickFormatter={rotuloMes} {...eixoX} />
          <YAxis {...eixoY} />
          <ReferenceLine y={0} stroke="var(--rule-strong)" />
          <Tooltip
            cursor={{ stroke: "var(--rule-strong)", strokeWidth: 1 }}
            content={(p) => <Dica active={p.active} payload={p.payload as ReadonlyArray<ItemDica> | undefined} label={p.label} />}
          />
          {(["Caixa", "Cris"] as const).map((o) => {
            const cor = o === "Caixa" ? "var(--viz-caixa)" : "var(--viz-cris)";
            return (
              <Line
                key={o}
                dataKey={o}
                name={o}
                type="linear"
                stroke={cor}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                dot={dados.length <= 18 ? ponto(cor) : false}
                activeDot={pontoAtivo(cor)}
              />
            );
          })}
        </LineChart>
      </ResponsiveContainer>
    </figure>
  );
}

// ─── Reserva de caixa: acumulado vs. meta ───────────────────────────────

export function GraficoReserva({
  dados,
  altura = 280,
}: {
  dados: { mes: string; acumulado: number; meta: number }[];
  altura?: number;
}) {
  return (
    <figure className="grafico" style={{ margin: 0 }}>
      <Legenda
        itens={[
          { rotulo: "Caixa acumulado", cor: "var(--viz-caixa)", forma: "linha" },
          { rotulo: "Meta de reserva", cor: "var(--ink-3)", forma: "tracejada" },
        ]}
      />
      <ResponsiveContainer width="100%" height={altura}>
        <ComposedChart data={dados} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          {grade}
          <XAxis dataKey="mes" tickFormatter={rotuloMes} {...eixoX} />
          <YAxis {...eixoY} />
          <Tooltip
            cursor={{ stroke: "var(--rule-strong)", strokeWidth: 1 }}
            content={(p) => (
              <Dica active={p.active} payload={p.payload as ReadonlyArray<ItemDica> | undefined} label={p.label} tracejadas={["meta"]} />
            )}
          />
          <Area
            dataKey="acumulado"
            name="Caixa acumulado"
            type="linear"
            stroke="var(--viz-caixa)"
            strokeWidth={2}
            fill="var(--viz-caixa)"
            fillOpacity={0.1}
            dot={dados.length <= 18 ? ponto("var(--viz-caixa)") : false}
            activeDot={pontoAtivo("var(--viz-caixa)")}
          />
          <Line
            dataKey="meta"
            name="Meta de reserva"
            type="stepAfter"
            stroke="var(--ink-3)"
            strokeWidth={1.5}
            strokeDasharray="5 4"
            dot={false}
            activeDot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </figure>
  );
}

// ─── Projeção: caixa realizado (sólido) e projetado (tracejado) ─────────

export function GraficoProjecao({
  dados,
  altura = 280,
}: {
  dados: { mes: string; realizado: number | null; projetado: number | null }[];
  altura?: number;
}) {
  return (
    <figure className="grafico" style={{ margin: 0 }}>
      <Legenda
        itens={[
          { rotulo: "Caixa realizado", cor: "var(--viz-caixa)", forma: "linha" },
          { rotulo: "Caixa projetado", cor: "var(--viz-caixa)", forma: "tracejada" },
        ]}
      />
      <ResponsiveContainer width="100%" height={altura}>
        <LineChart data={dados} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          {grade}
          <XAxis dataKey="mes" tickFormatter={rotuloMes} {...eixoX} />
          <YAxis {...eixoY} />
          <ReferenceLine y={0} stroke="var(--rule-strong)" />
          <Tooltip
            cursor={{ stroke: "var(--rule-strong)", strokeWidth: 1 }}
            content={(p) => (
              <Dica
                active={p.active}
                payload={(p.payload as ReadonlyArray<ItemDica> | undefined)?.filter(
                  // No mês de emenda as duas séries têm o mesmo valor: mostra uma só.
                  (i, _, todos) => !(i.dataKey === "projetado" && todos.some((t) => t.dataKey === "realizado" && t.value != null)),
                )}
                label={p.label}
                tracejadas={["projetado"]}
              />
            )}
          />
          <Line
            dataKey="realizado"
            name="Realizado"
            type="linear"
            stroke="var(--viz-caixa)"
            strokeWidth={2}
            dot={ponto("var(--viz-caixa)")}
            activeDot={pontoAtivo("var(--viz-caixa)")}
            connectNulls={false}
          />
          <Line
            dataKey="projetado"
            name="Projetado"
            type="linear"
            stroke="var(--viz-caixa)"
            strokeWidth={2}
            strokeDasharray="6 5"
            dot={{ r: 4, fill: "var(--bg)", stroke: "var(--viz-caixa)", strokeWidth: 2 }}
            activeDot={pontoAtivo("var(--viz-caixa)")}
            connectNulls={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </figure>
  );
}
