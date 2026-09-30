import { describe, expect, it } from "vitest";
import { somarMesesData } from "./datas";
import { agendaFutura, extensaoFixo, gerarSerie, resumoSeries, rotuloSerie } from "./futuros";
import type { Lancamento, LancamentoEntrada } from "./tipos";

const base: LancamentoEntrada = {
  tipo: "despesa",
  categoria: "Custo Fixo",
  valor: 9800,
  data: "2026-01-31",
  descricao: "Sala comercial",
  origem_recurso: "Caixa",
  item_custo: "Aluguel",
  corretor: null,
  cliente: null,
  produto: null,
  cidade: null,
  socio: null,
  vgv: null,
  comissao_percent: null,
  comissao_bruta: null,
  split_empresa_percent: null,
  imposto_nf_percent: null,
  imposto_nf: null,
  serie_id: null,
  recorrencia: null,
  parcela: null,
  parcelas_total: null,
};

let seq = 0;
const salvo = (e: LancamentoEntrada): Lancamento => ({ ...e, id: String(++seq), criado_por: null, criado_em: "", atualizado_em: "" });

describe("datas de séries", () => {
  it("mantém o dia do mês e usa o último dia quando ele não existe", () => {
    expect(somarMesesData("2026-01-31", 1)).toBe("2026-02-28");
    expect(somarMesesData("2026-01-31", 2)).toBe("2026-03-31");
    expect(somarMesesData("2027-12-15", 3)).toBe("2028-03-15");
  });
});

describe("gerarSerie", () => {
  it("parcelado: N parcelas mensais numeradas", () => {
    const s = gerarSerie({ ...base, data: "2026-10-10" }, "parcelado", 3, "s1");
    expect(s.map((l) => [l.data, l.parcela, l.parcelas_total])).toEqual([
      ["2026-10-10", 1, 3],
      ["2026-11-10", 2, 3],
      ["2026-12-10", 3, 3],
    ]);
    expect(s.every((l) => l.serie_id === "s1" && l.recorrencia === "parcelado")).toBe(true);
  });

  it("fixo: sem total de parcelas; dia 31 volta a ser 31 depois de fevereiro", () => {
    const s = gerarSerie(base, "fixo", 3, "s2");
    expect(s.map((l) => l.data)).toEqual(["2026-01-31", "2026-02-28", "2026-03-31"]);
    expect(s[0].parcelas_total).toBeNull();
    expect(rotuloSerie(s[0])).toBe("Fixo mensal");
  });

  it("estender um fixo continua a numeração, as datas e o valor mais recente", () => {
    const serie = gerarSerie(base, "fixo", 3, "s3").map(salvo);
    serie[2].valor = 10500; // reajuste
    const [r] = resumoSeries(serie, "2026-01-01");
    const mais = extensaoFixo(r, 2);
    expect(mais.map((l) => [l.data, l.parcela, l.valor])).toEqual([
      ["2026-04-30", 4, 10500],
      ["2026-05-31", 5, 10500],
    ]);
  });
});

describe("agendaFutura", () => {
  it("lista só o que vem depois de hoje e projeta o caixa; aportes não mexem no caixa", () => {
    const ls = [
      salvo({ ...base, data: "2026-09-30", valor: 999 }), // hoje: fica de fora
      salvo({ ...base, data: "2026-10-05", valor: 1000 }),
      salvo({ ...base, tipo: "receita", categoria: "Outra Receita", origem_recurso: null, item_custo: null, data: "2026-10-10", valor: 5000 }),
      salvo({ ...base, data: "2026-10-12", valor: 700, origem_recurso: "Cris" }),
      salvo({ ...base, data: "2026-11-05", valor: 1000 }),
      salvo({ ...base, data: "2027-06-05", valor: 1000 }),
    ];
    const a = agendaFutura(ls, { saldo: 10000 }, "2026-09-30", "2026-12-31");
    expect(a.meses.map((m) => [m.mes, m.entradas, m.saidasCaixa, m.aportes, m.caixaFim])).toEqual([
      ["2026-10", 5000, 1000, 700, 14000],
      ["2026-11", 0, 1000, 0, 13000],
    ]);
    expect(a.meses[0].itens.map((i) => i.caixaApos)).toEqual([9000, 14000, null]);
    expect(a.caixaFinal).toBe(13000);
  });
});

describe("resumoSeries", () => {
  it("conta restantes, próxima ocorrência e avisa fixos perto do fim", () => {
    const p = gerarSerie({ ...base, data: "2026-08-10", item_custo: "Notebook" }, "parcelado", 4, "p").map(salvo);
    const f = gerarSerie({ ...base, data: "2026-09-05" }, "fixo", 2, "f").map(salvo);
    const [fixo, parcelado] = resumoSeries([...p, ...f], "2026-09-30");
    expect(parcelado).toMatchObject({ nome: "Notebook", restantes: 2, total: 4, acabando: false });
    expect(parcelado.proxima?.data).toBe("2026-10-10");
    expect(fixo).toMatchObject({ nome: "Aluguel", restantes: 1, total: 2, acabando: true });
  });
});
