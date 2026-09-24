"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { FiltroPeriodo, usePeriodo } from "@/components/Filtros";
import { CabecalhoPagina, Secao, Valor } from "@/components/Livro";
import { useDados } from "@/components/Painel";
import { comSinal, noPeriodo } from "@/lib/financeiro/calculos";
import { dataBR, moeda } from "@/lib/financeiro/formato";
import { CATEGORIAS_DESPESA, CATEGORIAS_RECEITA, ORIGENS, type Lancamento } from "@/lib/financeiro/tipos";

function detalhes(l: Lancamento): string {
  if (l.cliente || l.produto) return [l.cliente, l.produto, l.cidade, l.corretor && `corretor: ${l.corretor}`].filter(Boolean).join(" · ");
  if (l.socio) return `Sócio: ${l.socio}`;
  return "";
}

export function Lancamentos() {
  const { lancamentos: ls } = useDados();
  const periodo = usePeriodo();
  const [tipo, setTipo] = useState<"" | "receita" | "despesa">("");
  const [categoria, setCategoria] = useState("");
  const [origem, setOrigem] = useState("");
  const [busca, setBusca] = useState("");

  const lista = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    return noPeriodo(ls, periodo.inicio, periodo.fim)
      .filter((l) => !tipo || l.tipo === tipo)
      .filter((l) => !categoria || l.categoria === categoria)
      .filter((l) => !origem || l.origem_recurso === origem)
      .filter(
        (l) =>
          !termo ||
          [l.descricao, l.cliente, l.produto, l.cidade, l.corretor, l.socio, l.categoria]
            .filter(Boolean)
            .some((t) => t!.toLocaleLowerCase("pt-BR").includes(termo)),
      )
      .sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : b.criado_em.localeCompare(a.criado_em)));
  }, [ls, periodo, tipo, categoria, origem, busca]);

  const entradas = lista.filter((l) => l.tipo === "receita").reduce((s, l) => s + l.valor, 0);
  const saidas = lista.filter((l) => l.tipo === "despesa").reduce((s, l) => s + l.valor, 0);

  return (
    <main className="pagina">
      <CabecalhoPagina titulo="Lançamentos" descricao={periodo.rotulo}>
        <FiltroPeriodo />
      </CabecalhoPagina>

      <Secao
        folio="1"
        titulo="Livro-razão"
        nota={`${lista.length} ${lista.length === 1 ? "lançamento" : "lançamentos"}`}
        acoes={
          <Link className="btn btn--primario btn--pequeno" href="/lancamentos/novo/">
            + Novo
          </Link>
        }
      >
        <div className="form" style={{ marginBottom: 18, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))" }}>
          <div className="campo">
            <label htmlFor="f-busca">Buscar</label>
            <input id="f-busca" type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="cliente, empreendimento…" />
          </div>
          <div className="campo">
            <label htmlFor="f-tipo">Tipo</label>
            <select
              id="f-tipo"
              value={tipo}
              onChange={(e) => {
                setTipo(e.target.value as typeof tipo);
                setCategoria("");
              }}
            >
              <option value="">Todos</option>
              <option value="receita">Receitas</option>
              <option value="despesa">Despesas</option>
            </select>
          </div>
          <div className="campo">
            <label htmlFor="f-categoria">Categoria</label>
            <select id="f-categoria" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
              <option value="">Todas</option>
              {(tipo === "despesa" ? [] : CATEGORIAS_RECEITA).map((c) => (
                <option key={c}>{c}</option>
              ))}
              {(tipo === "receita" ? [] : CATEGORIAS_DESPESA).map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="f-origem">Origem</label>
            <select id="f-origem" value={origem} onChange={(e) => setOrigem(e.target.value)}>
              <option value="">Todas</option>
              {ORIGENS.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </div>
        </div>

        {lista.length ? (
          <div className="tabela-wrap">
            <table className="razao">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Histórico</th>
                  <th>Categoria</th>
                  <th>Origem</th>
                  <th className="num">Valor</th>
                  <th className="acoes">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {lista.map((l) => (
                  <tr key={l.id}>
                    <td className="num">{dataBR(l.data)}</td>
                    <td>
                      {l.descricao || detalhes(l) || <span className="muted">—</span>}
                      {l.descricao && detalhes(l) && <span className="secundario">{detalhes(l)}</span>}
                    </td>
                    <td>{l.categoria}</td>
                    <td>{l.origem_recurso}</td>
                    <td className="num">
                      <Valor v={comSinal(l)} tom="auto" sinal />
                    </td>
                    <td className="acoes">
                      <Link className="btn btn--pequeno btn--fantasma" href={`/lancamentos/editar/?id=${l.id}`}>
                        Editar
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4}>
                    Entradas {moeda(entradas)} · Saídas {moeda(saidas)}
                  </td>
                  <td className="num">
                    <Valor v={entradas - saidas} tom="auto" />
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <p className="vazio">Nenhum lançamento com esses filtros.</p>
        )}
      </Secao>
    </main>
  );
}
