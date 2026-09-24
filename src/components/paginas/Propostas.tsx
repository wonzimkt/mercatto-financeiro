"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Icone } from "@/components/Icones";
import { useDados } from "@/components/Painel";
import { Barras, CabecalhoPagina, Figura, Figuras, Secao } from "@/components/ui";
import { hojeISO } from "@/lib/financeiro/datas";
import { dataBR, moeda, moedaCompacta } from "@/lib/financeiro/formato";
import {
  DIAS_ALERTA,
  diasEmNegociacao,
  liquidoPotencial,
  negociacaoPorCorretor,
  resumoPropostas,
} from "@/lib/financeiro/propostas";
import { ROTULO_STATUS, type StatusProposta } from "@/lib/financeiro/tipos";

type Filtro = StatusProposta | "todas";

const pct = (v: number) => String(v).replace(".", ",");

export function Propostas() {
  const { propostas, config } = useDados();
  const hoje = hojeISO();
  const [filtro, setFiltro] = useState<Filtro>("negociacao");
  const [busca, setBusca] = useState("");

  const resumo = useMemo(() => resumoPropostas(propostas, config, hoje), [propostas, config, hoje]);
  const porCorretor = useMemo(() => negociacaoPorCorretor(propostas), [propostas]);
  const contagem = (s: StatusProposta) => propostas.filter((p) => p.status === s).length;

  const lista = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    return propostas
      .filter((p) => filtro === "todas" || p.status === filtro)
      .filter(
        (p) =>
          !termo ||
          [p.produto, p.corretor, p.cliente, p.cidade, p.observacao]
            .filter(Boolean)
            .some((t) => t!.toLocaleLowerCase("pt-BR").includes(termo)),
      )
      .sort((a, b) =>
        // Em negociação: as mais antigas primeiro (pedem atenção). Encerradas: as mais recentes.
        filtro === "negociacao" ? a.data.localeCompare(b.data) : b.data.localeCompare(a.data),
      );
  }, [propostas, filtro, busca]);

  const vgvLista = lista.reduce((s, p) => s + p.vgv, 0);

  return (
    <main className="pagina">
      <CabecalhoPagina
        titulo="Propostas"
        descricao="Negociações em andamento. Não entram no financeiro: a receita só aparece quando a venda é registrada."
      >
        <Link href="/propostas/nova/" className="btn btn--primario">
          <Icone nome="mais" tamanho={16} />
          Nova proposta
        </Link>
      </CabecalhoPagina>

      <Figuras>
        <Figura
          rotulo="Em negociação"
          valor={resumo.emNegociacao}
          formato="numero"
          rodape={
            resumo.paradas ? (
              <span className="delta neg">
                {resumo.paradas} há mais de {DIAS_ALERTA} dias
              </span>
            ) : (
              <span>{resumo.diasMedios === null ? "nenhuma aberta" : `em média há ${resumo.diasMedios} dias`}</span>
            )
          }
        />
        <Figura rotulo="VGV em negociação" valor={resumo.vgvEmNegociacao} formato="compacto" />
        <Figura
          rotulo="Líquido potencial"
          valor={resumo.liquidoPotencial}
          formato="compacto"
          rodape={<span>para a Mercatto, se todas fecharem</span>}
        />
        <Figura
          rotulo="Conversão (12 meses)"
          valor={resumo.conversao}
          formato="pct"
          rodape={
            <span>
              {resumo.fechadas12m} {resumo.fechadas12m === 1 ? "fechada" : "fechadas"} · {resumo.perdidas12m}{" "}
              {resumo.perdidas12m === 1 ? "perdida" : "perdidas"}
            </span>
          }
        />
      </Figuras>

      <Secao
        titulo="Negociações"
        nota={lista.length ? `${lista.length} · VGV ${moedaCompacta(vgvLista)}` : undefined}
      >
        <div className="filtro" style={{ marginBottom: 16 }}>
          <div className="segmentos" role="group" aria-label="Situação">
            {(["negociacao", "fechada", "perdida", "todas"] as const).map((f) => (
              <button key={f} type="button" aria-pressed={filtro === f} onClick={() => setFiltro(f)}>
                {{ negociacao: "Em negociação", fechada: "Fechadas", perdida: "Perdidas", todas: "Todas" }[f]}
                <span className="muted">{f === "todas" ? propostas.length : contagem(f)}</span>
              </button>
            ))}
          </div>
          <div className="campo" style={{ flex: "1 1 220px", maxWidth: 320 }}>
            <label htmlFor="busca-propostas" className="sr-only">
              Buscar
            </label>
            <input
              id="busca-propostas"
              type="search"
              placeholder="Buscar produto, corretor, cliente…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
        </div>

        {lista.length ? (
          <div className="tabela-wrap">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Enviada</th>
                  <th>Produto</th>
                  <th>Corretor</th>
                  <th className="num">VGV</th>
                  <th>Situação</th>
                  <th className="acoes">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {lista.map((p) => {
                  const dias = diasEmNegociacao(p, hoje);
                  const parada = p.status === "negociacao" && dias > DIAS_ALERTA;
                  return (
                    <tr key={p.id}>
                      <td className="num">
                        {dataBR(p.data)}
                        <span className={`secundario ${parada ? "neg" : ""}`}>
                          {p.status === "negociacao" ? `há ${dias} ${dias === 1 ? "dia" : "dias"}` : `${dias} dias até encerrar`}
                        </span>
                      </td>
                      <td>
                        {p.produto}
                        {(p.cliente || p.cidade || p.observacao) && (
                          <span className="secundario">
                            {[p.cliente, p.cidade, p.observacao].filter(Boolean).join(" · ")}
                          </span>
                        )}
                      </td>
                      <td>{p.corretor}</td>
                      <td className="num">
                        {moeda(p.vgv)}
                        {p.status === "negociacao" && (
                          <span className="secundario">líquido ≈ {moedaCompacta(liquidoPotencial(p.vgv, config))}</span>
                        )}
                      </td>
                      <td>
                        <span className={`selo selo--${p.status}`}>{ROTULO_STATUS[p.status]}</span>
                        {p.status === "perdida" && p.motivo_perda && <span className="secundario">{p.motivo_perda}</span>}
                        {p.status !== "negociacao" && p.encerrada_em && (
                          <span className="secundario">em {dataBR(p.encerrada_em)}</span>
                        )}
                      </td>
                      <td className="acoes">
                        {p.status === "negociacao" && (
                          <Link className="btn btn--pequeno" href={`/lancamentos/novo/?proposta=${p.id}`}>
                            Registrar venda
                          </Link>
                        )}
                        {p.status === "fechada" && p.lancamento_id && (
                          <Link className="btn btn--pequeno btn--fantasma" href={`/lancamentos/editar/?id=${p.lancamento_id}`}>
                            Ver venda
                          </Link>
                        )}{" "}
                        <Link className="btn btn--pequeno btn--fantasma" href={`/propostas/editar/?id=${p.id}`}>
                          Editar
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="vazio">
            {propostas.length === 0 ? (
              <>
                Nenhuma proposta ainda.{" "}
                <Link className="link" href="/propostas/nova/">
                  Registrar a primeira
                </Link>
              </>
            ) : (
              "Nenhuma proposta com esse filtro."
            )}
          </p>
        )}
        <p className="campo__ajuda" style={{ margin: "12px 0 0" }}>
          Líquido estimado com os percentuais padrão: comissão de {pct(config.comissao_percent)}%,{" "}
          {pct(config.split_empresa_percent)}% dela para a Mercatto e {pct(config.imposto_nf_percent)}% de imposto sobre a NF.
        </p>
      </Secao>

      <Secao titulo="Em negociação por corretor" nota="VGV">
        <Barras
          itens={porCorretor.map((c) => ({
            nome: c.nome,
            valor: c.vgv,
            detalhe: `${c.qtd} ${c.qtd === 1 ? "proposta" : "propostas"}`,
          }))}
          formatar={moedaCompacta}
          vazio="Nenhuma proposta em negociação."
        />
      </Secao>
    </main>
  );
}
