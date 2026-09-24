import { describe, expect, it } from "vitest";
import { deslocarPeriodo, listaMeses, mesesDeEvolucao, nomeMes, resolverPeriodo, somarMeses, ultimoDia } from "./datas";

const agora = new Date(2026, 8, 23); // 23/09/2026

describe("datas", () => {
  it("soma meses atravessando o ano", () => {
    expect(somarMeses("2026-11", 3)).toBe("2027-02");
    expect(somarMeses("2026-01", -1)).toBe("2025-12");
    expect(listaMeses("2025-11", "2026-02")).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
  });

  it("sabe o último dia do mês, inclusive fevereiro bissexto", () => {
    expect(ultimoDia("2028-02")).toBe("2028-02-29");
    expect(ultimoDia("2026-09")).toBe("2026-09-30");
  });

  it("nomeia meses em português", () => {
    expect(nomeMes("2026-03")).toBe("março de 2026");
    expect(nomeMes("2026-03", "curto")).toBe("mar/26");
  });

  it("resolve períodos a partir da URL", () => {
    expect(resolverPeriodo({}, agora)).toMatchObject({ tipo: "mes", inicio: "2026-09-01", fim: "2026-09-30" });
    expect(resolverPeriodo({ p: "trimestre" }, agora)).toMatchObject({ ref: "2026-T3", inicio: "2026-07-01", fim: "2026-09-30" });
    expect(resolverPeriodo({ p: "ano", ref: "2025" }, agora).meses).toHaveLength(12);
    expect(resolverPeriodo({ p: "personalizado", de: "2026-05-10", ate: "2026-03-01" }, agora)).toMatchObject({
      inicio: "2026-03-01",
      fim: "2026-05-10",
    });
    expect(resolverPeriodo({ p: "mes", ref: "lixo" }, agora).ref).toBe("2026-09");
  });

  it("navega para o período vizinho", () => {
    expect(deslocarPeriodo(resolverPeriodo({ p: "trimestre", ref: "2026-T1" }, agora), -1)).toEqual({
      p: "trimestre",
      ref: "2025-T4",
    });
    expect(deslocarPeriodo(resolverPeriodo({ p: "mes", ref: "2026-12" }, agora), 1)).toEqual({ p: "mes", ref: "2027-01" });
  });

  it("gráficos de evolução não incluem meses futuros", () => {
    const ano = resolverPeriodo({ p: "ano", ref: "2026" }, agora);
    expect(mesesDeEvolucao(ano, "2026-09")).toEqual(listaMeses("2026-01", "2026-09"));
    const mes = resolverPeriodo({ p: "mes", ref: "2026-09" }, agora);
    expect(mesesDeEvolucao(mes, "2026-09")).toEqual(listaMeses("2025-10", "2026-09"));
    const futuro = resolverPeriodo({ p: "trimestre", ref: "2026-T4" }, agora);
    expect(mesesDeEvolucao(futuro, "2026-09").at(-1)).toBe("2026-09");
  });
});
