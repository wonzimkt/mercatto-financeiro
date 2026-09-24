"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import {
  deslocarPeriodo,
  mesAtual,
  nomeMes,
  resolverPeriodo,
  somarMeses,
  validaChaveMes,
  type ParamsPeriodo,
  type Periodo,
  type TipoPeriodo,
} from "@/lib/financeiro/datas";

function useTrocarParams() {
  const router = useRouter();
  const caminho = usePathname();
  const params = useSearchParams();
  return (novos: Record<string, string | null | undefined>, limpar: string[] = []) => {
    const p = new URLSearchParams(params.toString());
    for (const k of limpar) p.delete(k);
    for (const [k, v] of Object.entries(novos)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    const qs = p.toString();
    router.replace(qs ? `${caminho}?${qs}` : caminho, { scroll: false });
  };
}

// ─── Mês único (Visão geral, Metas) ─────────────────────────────────────

export function useMesSelecionado(): string {
  const v = useSearchParams().get("mes");
  return validaChaveMes(v) ? v : mesAtual();
}

export function NavegadorMes() {
  const mes = useMesSelecionado();
  const trocar = useTrocarParams();
  const atual = mesAtual();
  return (
    <div className="filtro">
      <div className="navegador">
        <button className="btn btn--icone" onClick={() => trocar({ mes: somarMeses(mes, -1) })} aria-label="Mês anterior">
          ‹
        </button>
        <span className="navegador__rotulo" aria-live="polite">
          {nomeMes(mes)}
        </span>
        <button className="btn btn--icone" onClick={() => trocar({ mes: somarMeses(mes, 1) })} aria-label="Próximo mês">
          ›
        </button>
      </div>
      {mes !== atual && (
        <button className="btn btn--pequeno btn--fantasma" onClick={() => trocar({ mes: null })}>
          Voltar ao mês atual
        </button>
      )}
    </div>
  );
}

// ─── Período (Vendas, Despesas, Sócios, Lançamentos, Exportação) ───────

export function usePeriodo(): Periodo {
  const sp = useSearchParams();
  const chave = sp.toString();
  return useMemo(
    () => resolverPeriodo({ p: sp.get("p"), ref: sp.get("ref"), de: sp.get("de"), ate: sp.get("ate") }),
    [chave],
  );
}

const TIPOS: { tipo: TipoPeriodo; rotulo: string }[] = [
  { tipo: "mes", rotulo: "Mês" },
  { tipo: "trimestre", rotulo: "Trimestre" },
  { tipo: "ano", rotulo: "Ano" },
  { tipo: "personalizado", rotulo: "Personalizado" },
];

export function FiltroPeriodo() {
  const periodo = usePeriodo();
  const trocar = useTrocarParams();
  const aplicar = (p: ParamsPeriodo) => trocar({ p: p.p, ref: p.ref, de: p.de, ate: p.ate }, ["p", "ref", "de", "ate"]);

  return (
    <div className="filtro">
      <div className="segmentos" role="group" aria-label="Tipo de período">
        {TIPOS.map((t) => (
          <button
            key={t.tipo}
            type="button"
            aria-pressed={periodo.tipo === t.tipo}
            onClick={() =>
              t.tipo === "personalizado"
                ? aplicar({ p: "personalizado", de: periodo.inicio, ate: periodo.fim })
                : aplicar({ p: t.tipo })
            }
          >
            {t.rotulo}
          </button>
        ))}
      </div>

      {periodo.tipo === "personalizado" ? (
        <div className="navegador" style={{ gap: 10 }}>
          <label className="sr-only" htmlFor="periodo-de">
            De
          </label>
          <input
            id="periodo-de"
            type="date"
            value={periodo.inicio}
            onChange={(e) => e.target.value && aplicar({ p: "personalizado", de: e.target.value, ate: periodo.fim })}
          />
          <span className="muted">a</span>
          <label className="sr-only" htmlFor="periodo-ate">
            Até
          </label>
          <input
            id="periodo-ate"
            type="date"
            value={periodo.fim}
            onChange={(e) => e.target.value && aplicar({ p: "personalizado", de: periodo.inicio, ate: e.target.value })}
          />
        </div>
      ) : (
        <div className="navegador">
          <button className="btn btn--icone" onClick={() => aplicar(deslocarPeriodo(periodo, -1))} aria-label="Período anterior">
            ‹
          </button>
          <span className="navegador__rotulo" aria-live="polite">
            {periodo.rotulo}
          </span>
          <button className="btn btn--icone" onClick={() => aplicar(deslocarPeriodo(periodo, 1))} aria-label="Próximo período">
            ›
          </button>
        </div>
      )}
    </div>
  );
}
