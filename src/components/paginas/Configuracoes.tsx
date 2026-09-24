"use client";

import { useState, type FormEvent } from "react";
import { CabecalhoPagina, Secao } from "@/components/ui";
import { useDados } from "@/components/Painel";
import { salvarConfiguracoes } from "@/lib/dados";
import { lerValor, paraCampo } from "@/lib/financeiro/formato";
import type { Configuracoes as Cfg } from "@/lib/financeiro/tipos";

type Campo = keyof Omit<Cfg, "atualizado_em">;

const CAMPOS: { id: Campo; rotulo: string; ajuda: string; tipo: "moeda" | "pct"; negativo?: boolean }[] = [
  {
    id: "comissao_percent",
    rotulo: "Comissão total (% do VGV)",
    ajuda: "Padrão da calculadora de comissão. Ex.: 5.",
    tipo: "pct",
  },
  {
    id: "split_empresa_percent",
    rotulo: "Parte da Mercatto (% da comissão)",
    ajuda: "Ex.: 50 = split Mercatto de 2,5% do VGV quando a comissão é 5%. O restante vai para o corretor.",
    tipo: "pct",
  },
  {
    id: "imposto_nf_percent",
    rotulo: "Imposto sobre a NF (% do split Mercatto)",
    ajuda: "Descontado só do split da Mercatto. Ex.: 6.",
    tipo: "pct",
  },
  {
    id: "saldo_inicial_caixa",
    rotulo: "Saldo inicial do caixa (R$)",
    ajuda: "Quanto havia no caixa da empresa antes do primeiro lançamento.",
    tipo: "moeda",
    negativo: true,
  },
  {
    id: "custo_fixo_estimado",
    rotulo: "Custo fixo estimado por mês (R$)",
    ajuda: "Usado no ponto de equilíbrio e na projeção enquanto não houver 2 meses de histórico.",
    tipo: "moeda",
  },
  {
    id: "comissao_media_esperada",
    rotulo: "Comissão líquida esperada por venda (R$)",
    ajuda: "O que fica com a Mercatto por venda. Usado até existirem 3 vendas nos últimos 12 meses.",
    tipo: "moeda",
  },
];

export function Configuracoes() {
  const { config, recarregar } = useDados();
  const [valores, setValores] = useState<Record<Campo, string>>(
    () =>
      Object.fromEntries(
        CAMPOS.map((c) => [c.id, c.tipo === "moeda" ? paraCampo(config[c.id]) : String(config[c.id]).replace(".", ",")]),
      ) as Record<Campo, string>,
  );
  const [erros, setErros] = useState<Partial<Record<Campo, string>>>({});
  const [estado, setEstado] = useState<{ tipo: "ok" | "erro"; msg: string } | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    setEstado(null);
    const e: Partial<Record<Campo, string>> = {};
    const saida = {} as Record<Campo, number>;
    for (const c of CAMPOS) {
      const v = lerValor(valores[c.id]);
      if (!Number.isFinite(v)) e[c.id] = "Número inválido.";
      else if (!c.negativo && v < 0) e[c.id] = "Não pode ser negativo.";
      else if (c.tipo === "pct" && v > 100) e[c.id] = "Máximo 100%.";
      saida[c.id] = v;
    }
    setErros(e);
    if (Object.keys(e).length) return;
    setSalvando(true);
    try {
      await salvarConfiguracoes(saida);
      await recarregar();
      setEstado({ tipo: "ok", msg: "Configurações salvas. Os painéis já usam os novos valores." });
    } catch (err) {
      setEstado({ tipo: "erro", msg: err instanceof Error ? err.message : String(err) });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <main className="pagina">
      <CabecalhoPagina
        titulo="Configurações"
        descricao={
          config.atualizado_em
            ? `Última alteração em ${new Date(config.atualizado_em).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}.`
            : undefined
        }
      />
      <Secao titulo="Parâmetros do painel">
        <form className="form" onSubmit={salvar} noValidate>
          {CAMPOS.map((c) => (
            <div className="campo" key={c.id}>
              <label htmlFor={c.id}>{c.rotulo}</label>
              <input
                id={c.id}
                className="num"
                inputMode="decimal"
                value={valores[c.id]}
                onChange={(ev) => setValores((v) => ({ ...v, [c.id]: ev.target.value }))}
                aria-invalid={erros[c.id] ? true : undefined}
              />
              <span className="campo__ajuda">{c.ajuda}</span>
              {erros[c.id] && <span className="campo__erro">{erros[c.id]}</span>}
            </div>
          ))}
          <div className="form__rodape">
            <button className="btn btn--primario" type="submit" disabled={salvando}>
              {salvando ? "Salvando…" : "Salvar configurações"}
            </button>
            {estado && (
              <span className={estado.tipo === "ok" ? "pos" : "neg"} role="status" style={{ fontSize: 14 }}>
                {estado.msg}
              </span>
            )}
          </div>
        </form>
      </Secao>
    </main>
  );
}
