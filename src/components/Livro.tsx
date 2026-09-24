/**
 * Peças de composição do livro-razão: seção, figura (KPI), valor contábil,
 * barras horizontais e medidor.
 */
import type { ReactNode } from "react";
import { contabil, moeda, num, percentual, variacaoTexto } from "@/lib/financeiro/formato";

export function Secao({
  folio,
  titulo,
  nota,
  acoes,
  children,
  id,
}: {
  folio?: string;
  titulo: string;
  nota?: ReactNode;
  acoes?: ReactNode;
  children: ReactNode;
  id?: string;
}) {
  return (
    <section className="secao" id={id} aria-labelledby={id ? `${id}-titulo` : undefined}>
      <header className="secao__cab">
        {folio && <span className="secao__folio">§ {folio}</span>}
        <h2 className="secao__titulo" id={id ? `${id}-titulo` : undefined}>
          {titulo}
        </h2>
        {nota && <span className="secao__nota">{nota}</span>}
        {acoes}
      </header>
      {children}
    </section>
  );
}

export function CabecalhoPagina({ titulo, destaque, descricao, children }: {
  titulo: string;
  destaque?: string;
  descricao?: string;
  children?: ReactNode;
}) {
  return (
    <div className="pagina__cab">
      <div>
        <h1 className="pagina__titulo">
          {titulo} {destaque && <em>{destaque}</em>}
        </h1>
        {descricao && <p className="pagina__desc">{descricao}</p>}
      </div>
      {children}
    </div>
  );
}

type Tom = "auto" | "neutro" | "positivo" | "negativo";

function classeTom(v: number, tom: Tom) {
  if (tom === "positivo") return "pos";
  if (tom === "negativo") return "neg";
  if (tom === "auto") return v < 0 ? "neg" : v > 0 ? "pos" : "";
  return "";
}

/** Valor em reais com convenção contábil; negativos entre parênteses. */
export function Valor({ v, tom = "neutro", sinal = false }: { v: number; tom?: Tom; sinal?: boolean }) {
  const texto = sinal && v > 0 ? `+${moeda(v)}` : contabil(v);
  return <span className={`num ${classeTom(v, tom)}`}>{texto}</span>;
}

/**
 * Seta + texto: a direção nunca depende só da cor.
 * `bomQuandoSobe=false` para despesas (subir é ruim).
 */
export function Delta({ v, bomQuandoSobe = true, sufixo = "vs. mês anterior" }: {
  v: number | null;
  bomQuandoSobe?: boolean;
  sufixo?: string;
}) {
  if (v === null || !Number.isFinite(v)) return <span className="delta muted">— sem base de comparação</span>;
  if (Math.abs(v) < 0.0005) v = 0; // abaixo de 0,05%: estável
  const seta = v > 0 ? "▲" : v < 0 ? "▼" : "■";
  const bom = v === 0 ? null : (v > 0) === bomQuandoSobe;
  return (
    <span className={`delta ${bom === null ? "muted" : bom ? "pos" : "neg"}`}>
      <span aria-hidden>{seta}</span> {variacaoTexto(v)} <span className="muted">{sufixo}</span>
    </span>
  );
}

export function Figura({
  rotulo,
  valor,
  formato = "moeda",
  tom = "neutro",
  grande = false,
  rodape,
}: {
  rotulo: string;
  valor: number | null;
  formato?: "moeda" | "numero" | "pct";
  tom?: Tom;
  grande?: boolean;
  rodape?: ReactNode;
}) {
  const texto =
    valor === null ? "—" : formato === "moeda" ? contabil(valor) : formato === "pct" ? percentual(valor) : num(valor);
  return (
    <div className="figura">
      <span className="figura__rotulo versal">{rotulo}</span>
      <span className={`figura__valor ${grande ? "figura__valor--grande" : ""} ${valor === null ? "" : classeTom(valor, tom)}`}>
        {texto}
      </span>
      {rodape && <div className="figura__rodape">{rodape}</div>}
    </div>
  );
}

export function Figuras({ children }: { children: ReactNode }) {
  return <div className="figuras">{children}</div>;
}

/**
 * Barras horizontais em HTML: nome, fio proporcional e valor na ponta.
 * Um único tom (magnitude), sem legenda — o título da seção diz o que é.
 */
export function Barras({
  itens,
  formatar = moeda,
  detalhe,
  vazio = "Nada no período.",
}: {
  itens: { nome: string; valor: number; detalhe?: string }[];
  formatar?: (v: number) => string;
  detalhe?: (i: { nome: string; valor: number }) => string;
  vazio?: string;
}) {
  if (!itens.length) return <p className="vazio">{vazio}</p>;
  const max = Math.max(...itens.map((i) => i.valor), 1);
  return (
    <table className="razao">
      <tbody>
        {itens.map((i) => (
          <tr key={i.nome}>
            <td>
              {i.nome}
              {(i.detalhe ?? detalhe?.(i)) && <span className="secundario">{i.detalhe ?? detalhe?.(i)}</span>}
              <span className="fatia" aria-hidden>
                <span style={{ width: `${(i.valor / max) * 100}%` }} />
              </span>
            </td>
            <td className="num" style={{ width: "1%" }}>
              {formatar(i.valor)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function Medidor({ progresso, ok = false, marco, rotulo }: {
  progresso: number;
  ok?: boolean;
  marco?: number;
  rotulo: string;
}) {
  const p = Math.max(0, Math.min(1, progresso));
  return (
    <div
      className="medidor"
      role="meter"
      aria-label={rotulo}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(p * 100)}
    >
      <div className={`medidor__barra ${ok ? "medidor__barra--ok" : ""}`} style={{ width: `${p * 100}%` }} />
      {marco !== undefined && <div className="medidor__marco" style={{ left: `${Math.min(1, marco) * 100}%` }} />}
    </div>
  );
}

export const ROTULO_FONTE: Record<string, string> = {
  realizado: "lançado no mês",
  historico: "média do histórico",
  estimado: "estimativa das configurações",
  "sem-dados": "sem dados — preencha as configurações",
};
