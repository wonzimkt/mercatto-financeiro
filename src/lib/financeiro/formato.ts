const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const brlInteiro = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const numero = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });
const pct = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 });
const compacto = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });

export const moeda = (v: number) => brl.format(v);
export const moedaInteira = (v: number) => brlInteiro.format(v);
export const num = (v: number) => numero.format(v);
export const percentual = (v: number) => pct.format(v);

/** Convenção contábil: negativos entre parênteses — (R$ 1.200,00). */
export function contabil(v: number): string {
  return v < 0 ? `(${brl.format(Math.abs(v))})` : brl.format(v);
}

/** Para eixos de gráfico: R$ 12,5 mil. */
export function moedaCompacta(v: number): string {
  if (Math.abs(v) < 1000) return brlInteiro.format(v);
  return `R$ ${compacto.format(v)}`;
}

/** +12,4% / −3,0% com sinal explícito. */
export function variacaoTexto(v: number | null): string {
  if (v === null || !Number.isFinite(v)) return "—";
  const s = pct.format(Math.abs(v));
  return v > 0 ? `+${s}` : v < 0 ? `−${s}` : s;
}

export function dataBR(iso: string): string {
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}

/** Aceita "1.234,56", "1234,56", "1234.56". Devolve NaN se inválido. */
export function lerValor(texto: string): number {
  const t = texto.trim().replace(/\s|R\$/g, "");
  if (!t) return Number.NaN;
  const normal = t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t;
  return /^-?\d+(\.\d+)?$/.test(normal) ? Number(normal) : Number.NaN;
}

/** Número → "1234,56" para preencher campos de formulário. */
export function paraCampo(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "";
  return v.toFixed(2).replace(".", ",");
}
