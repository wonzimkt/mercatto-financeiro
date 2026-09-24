/**
 * Datas no formato do banco (AAAA-MM-DD) e meses como chave "AAAA-MM".
 * Tudo em texto para não sofrer com fuso horário: uma despesa do dia 1º
 * nunca "escorrega" para o mês anterior.
 */

const MESES_LONGOS = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];
const MESES_CURTOS = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

const dois = (n: number) => String(n).padStart(2, "0");

export function hojeISO(agora: Date = new Date()): string {
  return `${agora.getFullYear()}-${dois(agora.getMonth() + 1)}-${dois(agora.getDate())}`;
}

export function chaveMes(data: string): string {
  return data.slice(0, 7);
}

export function mesAtual(agora: Date = new Date()): string {
  return chaveMes(hojeISO(agora));
}

export function somarMeses(chave: string, n: number): string {
  const [a, m] = chave.split("-").map(Number);
  const total = a * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${dois((total % 12) + 1)}`;
}

export function primeiroDia(chave: string): string {
  return `${chave}-01`;
}

export function ultimoDia(chave: string): string {
  const [a, m] = chave.split("-").map(Number);
  const dias = new Date(Date.UTC(a, m, 0)).getUTCDate();
  return `${chave}-${dois(dias)}`;
}

/** Meses de `inicio` a `fim`, inclusive (chaves AAAA-MM). */
export function listaMeses(inicio: string, fim: string): string[] {
  const meses: string[] = [];
  for (let c = inicio; c <= fim; c = somarMeses(c, 1)) meses.push(c);
  return meses;
}

/** Os `n` meses que terminam em `fim` (inclusive), do mais antigo ao mais novo. */
export function ultimosMeses(fim: string, n: number): string[] {
  return listaMeses(somarMeses(fim, -(n - 1)), fim);
}

export function nomeMes(chave: string, formato: "longo" | "curto" = "longo"): string {
  const [a, m] = chave.split("-").map(Number);
  return formato === "longo"
    ? `${MESES_LONGOS[m - 1]} de ${a}`
    : `${MESES_CURTOS[m - 1]}/${String(a).slice(2)}`;
}

export function validaChaveMes(v: string | null | undefined): v is string {
  return !!v && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);
}

export function validaData(v: string | null | undefined): v is string {
  return !!v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
}

// ─── Períodos ───────────────────────────────────────────────────────────

export type TipoPeriodo = "mes" | "trimestre" | "ano" | "personalizado";

export interface Periodo {
  tipo: TipoPeriodo;
  /** AAAA-MM, AAAA-Tn ou AAAA (vazio no personalizado) */
  ref: string;
  inicio: string;
  fim: string;
  rotulo: string;
  meses: string[];
}

export interface ParamsPeriodo {
  p?: string | null;
  ref?: string | null;
  de?: string | null;
  ate?: string | null;
}

function montar(tipo: TipoPeriodo, ref: string, inicio: string, fim: string, rotulo: string): Periodo {
  return { tipo, ref, inicio, fim, rotulo, meses: listaMeses(chaveMes(inicio), chaveMes(fim)) };
}

export function resolverPeriodo(params: ParamsPeriodo, agora: Date = new Date()): Periodo {
  const atual = mesAtual(agora);
  const [anoAtual, mesNum] = atual.split("-").map(Number);
  const tipo = (["mes", "trimestre", "ano", "personalizado"] as const).find((t) => t === params.p) ?? "mes";

  if (tipo === "trimestre") {
    const m = /^(\d{4})-T([1-4])$/.exec(params.ref ?? "");
    const ano = m ? Number(m[1]) : anoAtual;
    const tri = m ? Number(m[2]) : Math.ceil(mesNum / 3);
    const ini = `${ano}-${dois((tri - 1) * 3 + 1)}`;
    const fim = somarMeses(ini, 2);
    return montar("trimestre", `${ano}-T${tri}`, primeiroDia(ini), ultimoDia(fim), `${tri}º trimestre de ${ano}`);
  }

  if (tipo === "ano") {
    const ano = /^\d{4}$/.test(params.ref ?? "") ? Number(params.ref) : anoAtual;
    return montar("ano", String(ano), `${ano}-01-01`, `${ano}-12-31`, String(ano));
  }

  if (tipo === "personalizado" && validaData(params.de) && validaData(params.ate)) {
    const [de, ate] = params.de <= params.ate ? [params.de, params.ate] : [params.ate, params.de];
    return montar("personalizado", "", de, ate, `${formatarDataCurta(de)} a ${formatarDataCurta(ate)}`);
  }

  if (tipo === "personalizado") {
    // Sem datas válidas: começa com o ano corrente até hoje.
    return montar("personalizado", "", `${anoAtual}-01-01`, hojeISO(agora),
      `${formatarDataCurta(`${anoAtual}-01-01`)} a ${formatarDataCurta(hojeISO(agora))}`);
  }

  const ref = validaChaveMes(params.ref) ? params.ref : atual;
  return montar("mes", ref, primeiroDia(ref), ultimoDia(ref), nomeMes(ref));
}

/** Parâmetros do período vizinho (anterior = -1, seguinte = +1). */
export function deslocarPeriodo(p: Periodo, delta: number): ParamsPeriodo {
  if (p.tipo === "mes") return { p: "mes", ref: somarMeses(p.ref, delta) };
  if (p.tipo === "ano") return { p: "ano", ref: String(Number(p.ref) + delta) };
  if (p.tipo === "trimestre") {
    const ini = somarMeses(chaveMes(p.inicio), delta * 3);
    const [a, m] = ini.split("-").map(Number);
    return { p: "trimestre", ref: `${a}-T${Math.ceil(m / 3)}` };
  }
  return { p: "personalizado", de: p.inicio, ate: p.fim };
}

export function formatarDataCurta(iso: string): string {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

export function dentroDe(data: string, inicio: string, fim: string): boolean {
  return data >= inicio && data <= fim;
}

/** Meses do período que já começaram (exclui meses futuros). */
export function mesesDecorridos(p: Periodo, atual: string = mesAtual()): string[] {
  return p.meses.filter((m) => m <= atual);
}

/**
 * Meses para gráficos de evolução: os do período já decorridos, ou os 12
 * meses até o fim do período se ele for curto. Meses futuros nunca entram
 * (apareceriam como zero e distorceriam a curva).
 */
export function mesesDeEvolucao(p: Periodo, atual: string = mesAtual()): string[] {
  const meses = mesesDecorridos(p, atual);
  if (meses.length >= 3) return meses;
  const fim = chaveMes(p.fim) < atual ? chaveMes(p.fim) : atual;
  return ultimosMeses(fim, 12);
}
