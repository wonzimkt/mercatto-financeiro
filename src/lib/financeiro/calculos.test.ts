import { describe, expect, it } from "vitest";
import {
  agruparPor,
  caixaAgora,
  calcularComissao,
  comissaoMedia,
  custoOperacionalDoMes,
  despesasPorItem,
  pontoEquilibrio,
  progressoMeta,
  projecao,
  resumoMes,
  serieMensal,
  ticketMedioPorMes,
  valoresUsados,
  variacao,
} from "./calculos";
import { CONFIG_PADRAO, type Configuracoes, type Lancamento } from "./tipos";

let seq = 0;
function l(p: Partial<Lancamento> & Pick<Lancamento, "tipo" | "categoria" | "valor" | "data">): Lancamento {
  seq += 1;
  return {
    id: String(seq),
    descricao: null,
    origem_recurso: p.tipo === "despesa" ? "Caixa" : null,
    item_custo: null,
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
    criado_por: null,
    criado_em: "",
    atualizado_em: "",
    ...p,
  };
}

const venda = (data: string, valor: number, extra: Partial<Lancamento> = {}) =>
  l({ tipo: "receita", categoria: "Comissão de Venda", valor, data, corretor: "Ana", vgv: valor * 50, ...extra });
const custo = (data: string, valor: number, extra: Partial<Lancamento> = {}) =>
  l({ tipo: "despesa", categoria: "Custo Fixo", valor, data, ...extra });
const retirada = (data: string, valor: number, extra: Partial<Lancamento> = {}) =>
  l({ tipo: "despesa", categoria: "Retirada de Sócios", valor, data, socio: "Cris", ...extra });

const cfg = (c: Partial<Configuracoes> = {}): Configuracoes => ({ ...CONFIG_PADRAO, ...c });

describe("variacao", () => {
  it("calcula a variação relativa e devolve null sem base", () => {
    expect(variacao(150, 100)).toBeCloseTo(0.5);
    expect(variacao(50, -100)).toBeCloseTo(1.5);
    expect(variacao(10, 0)).toBeNull();
  });
});

describe("calcularComissao", () => {
  it("VGV → comissão 5% → split 50/50 → imposto 6% só sobre o split da Mercatto", () => {
    const c = calcularComissao({ vgv: 1_000_000, comissaoPercent: 5, splitPercent: 50, impostoPercent: 6 });
    expect(c).toEqual({
      comissaoTotal: 50_000,
      splitMercatto: 25_000,
      splitCorretor: 25_000,
      impostoNf: 1_500,
      liquidoMercatto: 23_500,
    });
  });

  it("arredonda ao centavo e as partes sempre somam a comissão", () => {
    const c = calcularComissao({ vgv: 1_234_567.89, comissaoPercent: 5, splitPercent: 50, impostoPercent: 6 });
    expect(c.comissaoTotal).toBe(61_728.39);
    expect(c.splitMercatto + c.splitCorretor).toBeCloseTo(c.comissaoTotal, 2);
    expect(c.impostoNf).toBe(1_851.85);
    expect(c.liquidoMercatto).toBe(29_012.35);
  });
});

describe("caixa", () => {
  it("receitas entram no caixa; despesas da Cris não saem dele", () => {
    const ls = [
      venda("2026-01-10", 10000),
      custo("2026-01-05", 3000, { origem_recurso: "Cris" }),
      custo("2026-01-06", 1000),
      venda("2026-02-10", 8000),
      retirada("2026-02-20", 2000),
    ];
    const [jan, fev] = serieMensal(ls, cfg({ saldo_inicial_caixa: 1000 }), ["2026-01", "2026-02"]);
    expect(jan.resultado).toBe(6000); // no resultado, a despesa da Cris conta
    expect(jan.fluxoCaixa).toBe(9000); // no caixa, não
    expect(jan.caixa).toBe(10000);
    expect(jan.bancadoCris).toBe(3000);
    expect(fev.caixa).toBe(16000);
    expect(fev.retiradas).toBe(2000);
  });

  it("caixa agora considera só o que já aconteceu", () => {
    const ls = [
      venda("2026-09-10", 10000),
      custo("2026-09-15", 2000),
      custo("2026-09-16", 700, { origem_recurso: "Cris" }),
      custo("2026-09-30", 4000),
    ];
    expect(caixaAgora(ls, cfg({ saldo_inicial_caixa: 500 }), "2026-09-23")).toEqual({
      saldo: 8500,
      aVencer: -4000,
      bancadoCris: 700,
    });
  });

  it("compara com o mês anterior", () => {
    const ls = [venda("2026-01-10", 10000), venda("2026-02-10", 15000)];
    const r = resumoMes(ls, cfg(), "2026-02");
    expect(r.variacao.receita).toBeCloseTo(0.5);
    expect(r.anterior.mes).toBe("2026-01");
  });

  it("não é afetado por lançamentos de meses posteriores", () => {
    const ls = [venda("2026-01-10", 1000), venda("2026-05-10", 9000)];
    expect(serieMensal(ls, cfg(), ["2026-03"])[0].caixa).toBe(1000);
  });
});

describe("ponto de equilíbrio", () => {
  it("usa as estimativas quando não há histórico", () => {
    const pe = pontoEquilibrio([], cfg({ custo_fixo_estimado: 20000, comissao_media_esperada: 7000 }), "2026-09", "2026-09");
    expect(pe.custo.fonte).toBe("estimado");
    expect(pe.comissaoMedia.fonte).toBe("estimado");
    expect(pe.vendasNecessarias).toBe(3); // 20000 / 7000 = 2,86 → 3
    expect(pe.faltam).toBe(3);
  });

  it("nunca conta retirada de sócios como custo", () => {
    const ls = [
      custo("2026-06-05", 10000),
      custo("2026-07-05", 10000),
      custo("2026-08-05", 10000),
      retirada("2026-06-30", 50000),
      retirada("2026-07-30", 50000),
      retirada("2026-08-30", 50000),
      retirada("2026-09-10", 50000),
      venda("2026-06-10", 5000),
      venda("2026-07-10", 5000),
      venda("2026-08-10", 5000),
      venda("2026-09-10", 5000),
    ];
    const pe = pontoEquilibrio(ls, cfg({ custo_fixo_estimado: 99999 }), "2026-09", "2026-09");
    expect(pe.custo.fonte).toBe("historico");
    expect(pe.custo.valor).toBe(10000);
    expect(pe.comissaoMedia.valor).toBe(5000);
    expect(pe.vendasNecessarias).toBe(2);
    expect(pe.vendasFechadas).toBe(1);
    expect(pe.faltam).toBe(1);
  });

  it("em mês encerrado usa o custo realizado", () => {
    const ls = [custo("2026-06-05", 8000), custo("2026-07-05", 8000), custo("2026-08-05", 12000)];
    const c = custoOperacionalDoMes(ls, cfg(), "2026-08", "2026-09");
    expect(c.fonte).toBe("realizado");
    expect(c.valor).toBe(12000);
  });

  it("no mês corrente usa o maior entre realizado e média", () => {
    const ls = [custo("2026-07-05", 10000), custo("2026-08-05", 10000), custo("2026-09-02", 4000)];
    const c = custoOperacionalDoMes(ls, cfg(), "2026-09", "2026-09");
    expect(c.valor).toBe(10000);
    expect(c.realizado).toBe(4000);
  });

  it("precisa de 3 vendas em 12 meses para confiar na média", () => {
    const ls = [venda("2026-08-10", 4000), venda("2026-09-10", 6000)];
    expect(comissaoMedia(ls, cfg({ comissao_media_esperada: 7000 }), "2026-09").fonte).toBe("estimado");
    expect(comissaoMedia([...ls, venda("2025-11-01", 5000)], cfg(), "2026-09").valor).toBe(5000);
    // Venda de 13 meses atrás fica de fora da janela
    expect(comissaoMedia([...ls, venda("2025-09-01", 5000)], cfg({ comissao_media_esperada: 7000 }), "2026-09").fonte).toBe(
      "estimado",
    );
  });
});

describe("meta anual de VGV", () => {
  it("soma o VGV das vendas do ano e compara com a meta e o ritmo", () => {
    const ls = [
      venda("2026-02-10", 1, { vgv: 2_000_000 }),
      venda("2026-08-10", 1, { vgv: 3_000_000 }),
      venda("2025-12-10", 1, { vgv: 9_000_000 }),
    ];
    const p = progressoMeta(ls, 2026, 12_000_000, "2026-06-30");
    expect(p.alcancado).toBe(5_000_000);
    expect(p.vendas).toBe(2);
    expect(p.progresso).toBeCloseTo(5 / 12);
    expect(p.falta).toBe(7_000_000);
    expect(p.esperadoAteHoje).toBeCloseTo((12_000_000 * 181) / 365, -1);
    expect(p.serie[1]).toEqual({ mes: "2026-02", alcancado: 2_000_000, meta: 2_000_000 });
    expect(p.serie[6].alcancado).toBeNull(); // julho ainda não chegou
  });

  it("sem meta, não há progresso", () => {
    expect(progressoMeta([], 2026, 0, "2026-06-30").progresso).toBeNull();
  });
});

describe("projecao", () => {
  it("projeta a média móvel dos meses encerrados a partir do caixa atual", () => {
    const ls = [
      venda("2026-06-10", 30000),
      custo("2026-06-05", 12000),
      venda("2026-07-10", 30000),
      custo("2026-07-05", 12000),
      venda("2026-08-10", 30000),
      custo("2026-08-05", 12000),
      custo("2026-09-05", 12000),
    ];
    const p = projecao(ls, cfg(), "2026-09");
    expect(p.base.meses).toEqual(["2026-06", "2026-07", "2026-08"]);
    expect(p.saldoPartida).toBe(42000);
    expect(p.pontos.map((x) => x.mes)).toEqual(["2026-10", "2026-11", "2026-12"]);
    expect(p.pontos.map((x) => x.caixa)).toEqual([60000, 78000, 96000]);
  });

  it("sem histórico, projeta só o custo estimado", () => {
    const p = projecao([], cfg({ custo_fixo_estimado: 5000, saldo_inicial_caixa: 20000 }), "2026-09");
    expect(p.base.fonte).toBe("estimado");
    expect(p.pontos[2].caixa).toBe(5000);
  });
});

describe("vendas", () => {
  it("agrupa corretores com ticket e participação", () => {
    const ls = [
      venda("2026-09-01", 6000, { corretor: "Bia" }),
      venda("2026-09-02", 4000, { corretor: "Ana" }),
      venda("2026-09-03", 8000, { corretor: "Ana" }),
      venda("2026-09-04", 2000, { corretor: "  " }),
    ];
    const r = agruparPor(ls, "corretor");
    expect(r.map((g) => g.nome)).toEqual(["Ana", "Bia", "Não informado"]);
    expect(r[0]).toMatchObject({ total: 12000, qtd: 2, ticket: 6000 });
    expect(r[0].participacao).toBeCloseTo(0.6);
  });

  it("calcula ticket médio mês a mês, null sem vendas", () => {
    const t = ticketMedioPorMes([venda("2026-08-01", 3000), venda("2026-08-15", 5000)], ["2026-07", "2026-08"]);
    expect(t[0].ticket).toBeNull();
    expect(t[1].ticket).toBe(4000);
  });

  it("sugestões de autocomplete sem duplicar maiúsculas/espaços", () => {
    const ls = [
      venda("2026-09-01", 1, { cidade: "Balneário Camboriú" }),
      venda("2026-09-01", 1, { cidade: " balneário camboriú " }),
      venda("2026-09-01", 1, { cidade: "Itajaí" }),
    ];
    expect(valoresUsados(ls, "cidade")).toEqual(["Balneário Camboriú", "Itajaí"]);
  });
});

describe("itens de custo", () => {
  it("agrupa despesas por item, sem retiradas, e lista as categorias", () => {
    const ls = [
      custo("2026-09-01", 3000, { item_custo: "Aluguel" }),
      custo("2026-09-02", 500, { item_custo: " aluguel " }),
      l({ tipo: "despesa", categoria: "Marketing", valor: 900, data: "2026-09-03", item_custo: "Portais" }),
      custo("2026-09-04", 200),
      retirada("2026-09-05", 10000),
    ];
    const r = despesasPorItem(ls, "2026-09-01", "2026-09-30");
    expect(r.map((g) => [g.nome, g.total])).toEqual([
      ["Aluguel", 3500],
      ["Portais", 900],
      ["Não informado", 200],
    ]);
    expect(r[1].categorias).toEqual(["Marketing"]);
  });
});
