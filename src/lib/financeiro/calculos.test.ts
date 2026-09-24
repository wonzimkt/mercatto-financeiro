import { describe, expect, it } from "vitest";
import {
  agruparPor,
  comissaoMedia,
  custoOperacionalDoMes,
  pontoEquilibrio,
  projecao,
  reserva,
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
    origem_recurso: "Caixa",
    corretor: null,
    cliente: null,
    produto: null,
    cidade: null,
    socio: null,
    comissao_bruta: null,
    split_empresa_percent: null,
    criado_por: null,
    criado_em: "",
    atualizado_em: "",
    ...p,
  };
}

const venda = (data: string, valor: number, extra: Partial<Lancamento> = {}) =>
  l({ tipo: "receita", categoria: "Comissão de Venda", valor, data, corretor: "Ana", ...extra });
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

describe("serieMensal / resumoMes", () => {
  it("acumula saldos iniciais e separa por origem", () => {
    const ls = [
      venda("2026-01-10", 10000),
      custo("2026-01-05", 3000, { origem_recurso: "Cris" }),
      venda("2026-02-10", 8000, { origem_recurso: "Cris" }),
      retirada("2026-02-20", 2000),
    ];
    const [jan, fev] = serieMensal(ls, cfg({ saldo_inicial_caixa: 1000, saldo_inicial_cris: 500 }), [
      "2026-01",
      "2026-02",
    ]);
    expect(jan.resultado).toBe(7000);
    expect(jan.acumulado).toBe(8500);
    expect(jan.acumuladoOrigem).toEqual({ Caixa: 11000, Cris: -2500 });
    expect(fev.acumulado).toBe(14500);
    expect(fev.acumuladoOrigem).toEqual({ Caixa: 9000, Cris: 5500 });
    expect(fev.retiradas).toBe(2000);
    expect(fev.operacional).toBe(0);
  });

  it("compara com o mês anterior", () => {
    const ls = [venda("2026-01-10", 10000), venda("2026-02-10", 15000)];
    const r = resumoMes(ls, cfg(), "2026-02");
    expect(r.variacao.receita).toBeCloseTo(0.5);
    expect(r.anterior.mes).toBe("2026-01");
  });

  it("não é afetado por lançamentos de meses posteriores", () => {
    const ls = [venda("2026-01-10", 1000), venda("2026-05-10", 9000)];
    expect(serieMensal(ls, cfg(), ["2026-03"])[0].acumulado).toBe(1000);
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

describe("reserva", () => {
  it("compara caixa acumulado com custo médio × meses-alvo", () => {
    const ls = [custo("2026-07-05", 10000), custo("2026-08-05", 10000), venda("2026-08-20", 50000)];
    const r = reserva(ls, cfg({ reserva_meses_alvo: 6, saldo_inicial_caixa: 20000 }), "2026-09");
    expect(r.caixa).toBe(50000);
    expect(r.meta).toBe(60000);
    expect(r.progresso).toBeCloseTo(50000 / 60000);
    expect(r.mesesCobertos).toBe(5);
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
    expect(p.pontos.map((x) => x.acumulado)).toEqual([60000, 78000, 96000]);
  });

  it("sem histórico, projeta só o custo estimado", () => {
    const p = projecao([], cfg({ custo_fixo_estimado: 5000, saldo_inicial_caixa: 20000 }), "2026-09");
    expect(p.base.fonte).toBe("estimado");
    expect(p.pontos[2].acumulado).toBe(5000);
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
