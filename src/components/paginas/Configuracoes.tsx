"use client";

import { useState, type FormEvent } from "react";
import { CabecalhoPagina, Secao } from "@/components/ui";
import { useDados } from "@/components/Painel";
import { atualizarPagador, criarPagador, salvarConfiguracoes } from "@/lib/dados";
import { lerValor, paraCampo } from "@/lib/financeiro/formato";
import { CAIXA, type Configuracoes as Cfg } from "@/lib/financeiro/tipos";

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
      <Pagadores />
    </main>
  );
}

/** Quem pode pagar despesas. Só o Caixa mexe no caixa; os demais são aportes. */
function Pagadores() {
  const { pagadores, lancamentos, recarregar } = useDados();
  const [novo, setNovo] = useState("");
  const [editando, setEditando] = useState<string | null>(null);
  const [nomeEditado, setNomeEditado] = useState("");
  const [estado, setEstado] = useState<{ tipo: "ok" | "erro"; msg: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const usos = (nome: string) => lancamentos.filter((l) => l.origem_recurso === nome).length;

  async function executar(acao: () => Promise<void>, msg: string) {
    setOcupado(true);
    setEstado(null);
    try {
      await acao();
      await recarregar();
      setEstado({ tipo: "ok", msg });
      return true;
    } catch (e) {
      setEstado({ tipo: "erro", msg: e instanceof Error ? e.message : String(e) });
      return false;
    } finally {
      setOcupado(false);
    }
  }

  async function adicionar(ev: FormEvent) {
    ev.preventDefault();
    const nome = novo.trim();
    if (!nome) return;
    if (pagadores.some((p) => p.nome.toLocaleLowerCase("pt-BR") === nome.toLocaleLowerCase("pt-BR"))) {
      setEstado({ tipo: "erro", msg: "Já existe alguém com esse nome." });
      return;
    }
    const ordem = Math.max(0, ...pagadores.map((p) => p.ordem)) + 1;
    if (await executar(() => criarPagador(nome, ordem), `${nome} adicionado.`)) setNovo("");
  }

  async function renomear(nome: string) {
    const novoNome = nomeEditado.trim();
    if (!novoNome || novoNome === nome) return setEditando(null);
    if (await executar(() => atualizarPagador(nome, { nome: novoNome }), `Renomeado para ${novoNome}. Os lançamentos acompanham.`))
      setEditando(null);
  }

  return (
    <Secao titulo="Quem pode pagar despesas" nota="aparece em “Quem pagou”">
      <p className="campo__ajuda" style={{ margin: "0 0 12px" }}>
        Só o <strong>Caixa</strong> sai do caixa da empresa. Despesas pagas pelos demais contam no resultado, mas entram
        como <strong>aporte</strong> e não mexem no caixa. Quem já tem despesas não pode ser excluído: desative para sumir
        do formulário, mantendo o histórico.
      </p>
      <table className="tabela">
        <tbody>
          {pagadores.map((p) => (
            <tr key={p.nome}>
              <td>
                {editando === p.nome ? (
                  <form
                    className="form-linha"
                    onSubmit={(ev) => {
                      ev.preventDefault();
                      renomear(p.nome);
                    }}
                  >
                    <div className="campo">
                      <label htmlFor={`renomear-${p.nome}`} className="sr-only">
                        Novo nome
                      </label>
                      <input id={`renomear-${p.nome}`} value={nomeEditado} onChange={(e) => setNomeEditado(e.target.value)} autoFocus />
                    </div>
                    <button className="btn btn--pequeno btn--primario" type="submit" disabled={ocupado}>
                      Salvar
                    </button>
                    <button className="btn btn--pequeno btn--fantasma" type="button" onClick={() => setEditando(null)}>
                      Cancelar
                    </button>
                  </form>
                ) : (
                  <>
                    {p.nome}{" "}
                    {p.nome === CAIXA ? (
                      <span className="selo selo--negociacao">empresa · sai do caixa</span>
                    ) : (
                      !p.ativo && <span className="selo">inativo</span>
                    )}
                    <span className="secundario">
                      {usos(p.nome)} {usos(p.nome) === 1 ? "despesa lançada" : "despesas lançadas"}
                    </span>
                  </>
                )}
              </td>
              <td className="acoes">
                {p.nome !== CAIXA && editando !== p.nome && (
                  <>
                    <button
                      className="btn btn--pequeno btn--fantasma"
                      onClick={() => {
                        setEditando(p.nome);
                        setNomeEditado(p.nome);
                      }}
                    >
                      Renomear
                    </button>{" "}
                    <button
                      className="btn btn--pequeno"
                      disabled={ocupado}
                      onClick={() =>
                        executar(
                          () => atualizarPagador(p.nome, { ativo: !p.ativo }),
                          p.ativo ? `${p.nome} desativado.` : `${p.nome} reativado.`,
                        )
                      }
                    >
                      {p.ativo ? "Desativar" : "Reativar"}
                    </button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <form className="form-linha" onSubmit={adicionar} style={{ marginTop: 16 }}>
        <div className="campo">
          <label htmlFor="novo-pagador">Adicionar pessoa ou empresa</label>
          <input id="novo-pagador" value={novo} onChange={(e) => setNovo(e.target.value)} placeholder="Ex.: Ana, Empresa X" />
        </div>
        <button className="btn" type="submit" disabled={ocupado || !novo.trim()}>
          Adicionar
        </button>
      </form>
      {estado && (
        <p className={estado.tipo === "ok" ? "pos" : "neg"} role="status" style={{ fontSize: 14, margin: "10px 0 0" }}>
          {estado.msg}
        </p>
      )}
    </Secao>
  );
}
