import { describe, expect, it } from "vitest";
import { diasEmNegociacao, liquidoPotencial, negociacaoPorCorretor, resumoPropostas } from "./propostas";
import { CONFIG_PADRAO, type Proposta } from "./tipos";

let seq = 0;
function p(x: Partial<Proposta> & Pick<Proposta, "data" | "vgv">): Proposta {
  seq += 1;
  return {
    id: String(seq),
    corretor: "Ana",
    produto: "Torre Farol",
    cliente: null,
    cidade: null,
    observacao: null,
    status: "negociacao",
    encerrada_em: null,
    motivo_perda: null,
    lancamento_id: null,
    criado_em: "",
    atualizado_em: "",
    ...x,
  };
}

describe("propostas", () => {
  it("conta os dias em negociação até hoje ou até o encerramento", () => {
    expect(diasEmNegociacao(p({ data: "2026-09-01", vgv: 1 }), "2026-09-24")).toBe(23);
    expect(diasEmNegociacao(p({ data: "2026-09-01", vgv: 1, status: "fechada", encerrada_em: "2026-09-11" }), "2026-09-24")).toBe(10);
  });

  it("estima o líquido da Mercatto pelos percentuais padrão", () => {
    expect(liquidoPotencial(1_000_000, CONFIG_PADRAO)).toBe(23_500);
  });

  it("resume o funil: só as abertas somam VGV; conversão dos últimos 12 meses", () => {
    const ps = [
      p({ data: "2026-09-20", vgv: 1_000_000 }),
      p({ data: "2026-07-01", vgv: 2_000_000, corretor: "Bruno" }),
      p({ data: "2026-06-01", vgv: 5_000_000, status: "fechada", encerrada_em: "2026-07-01" }),
      p({ data: "2026-05-01", vgv: 3_000_000, status: "perdida", encerrada_em: "2026-06-01" }),
      p({ data: "2026-05-01", vgv: 3_000_000, status: "perdida", encerrada_em: "2026-06-15" }),
      p({ data: "2024-01-01", vgv: 9_000_000, status: "fechada", encerrada_em: "2024-02-01" }),
    ];
    const r = resumoPropostas(ps, CONFIG_PADRAO, "2026-09-24");
    expect(r.emNegociacao).toBe(2);
    expect(r.vgvEmNegociacao).toBe(3_000_000);
    expect(r.liquidoPotencial).toBe(70_500);
    expect(r.diasMedios).toBe(45); // (4 + 85) / 2 = 44,5 → 45
    expect(r.paradas).toBe(1);
    expect(r.fechadas12m).toBe(1);
    expect(r.perdidas12m).toBe(2);
    expect(r.conversao).toBeCloseTo(1 / 3);
  });

  it("agrupa o VGV em negociação por corretor sem diferenciar maiúsculas", () => {
    const ps = [
      p({ data: "2026-09-01", vgv: 1_000_000, corretor: "Ana" }),
      p({ data: "2026-09-02", vgv: 500_000, corretor: " ana " }),
      p({ data: "2026-09-03", vgv: 2_000_000, corretor: "Bruno" }),
      p({ data: "2026-09-03", vgv: 9_000_000, corretor: "Bruno", status: "perdida", encerrada_em: "2026-09-10" }),
    ];
    expect(negociacaoPorCorretor(ps)).toEqual([
      { nome: "Bruno", vgv: 2_000_000, qtd: 1 },
      { nome: "Ana", vgv: 1_500_000, qtd: 2 },
    ]);
  });
});
