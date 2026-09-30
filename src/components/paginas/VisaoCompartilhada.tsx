"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { Acesso } from "@/components/Acesso";
import { ProvedorDados } from "@/components/Painel";
import { VisaoGeral } from "@/components/paginas/VisaoGeral";
import { buscarVisaoCompartilhada, type VisaoCompartilhada } from "@/lib/dados";
import { CONFIG_DEMO, lancamentosDemo, METAS_DEMO, MODO_DEMO, propostasDemo } from "@/lib/demo";
import { PAGADORES_PADRAO } from "@/lib/financeiro/tipos";

const CHAVE = "mercatto-visao";

/**
 * Página aberta por um link de visualização (sem login). O código vem no
 * #fragmento da URL — que o navegador não envia a nenhum servidor — e fica
 * guardado na aba para sobreviver à navegação entre meses e a recarregamentos.
 */
export function VisaoCompartilhadaPagina() {
  const [estado, setEstado] = useState<"carregando" | "invalido" | "erro" | "pronto">("carregando");
  const [dados, setDados] = useState<VisaoCompartilhada | null>(null);
  const [erro, setErro] = useState("");
  const [token, setToken] = useState("");
  const [atualizadoEm, setAtualizadoEm] = useState<Date | null>(null);

  const carregar = useCallback(async (t: string) => {
    const d =
      MODO_DEMO && t === "demo"
        ? {
            nome: "demonstração",
            expira_em: null,
            config: CONFIG_DEMO,
            metas: METAS_DEMO,
            // Mesmos cortes do banco: sem cliente, corretor, produto, descrição, sócio ou item de custo.
            lancamentos: lancamentosDemo().map((l) => ({
              ...l,
              descricao: null,
              cliente: null,
              corretor: null,
              produto: null,
              cidade: null,
              socio: null,
              item_custo: null,
            })),
            propostas: propostasDemo().filter((p) => p.status === "negociacao"),
          }
        : await buscarVisaoCompartilhada(t);
    if (!d) {
      setEstado("invalido");
      return;
    }
    setDados(d);
    setAtualizadoEm(new Date());
    setEstado("pronto");
  }, []);

  useEffect(() => {
    let t = new URLSearchParams(window.location.hash.slice(1)).get("t") ?? "";
    try {
      if (t) sessionStorage.setItem(CHAVE, t);
      else t = sessionStorage.getItem(CHAVE) ?? "";
    } catch {
      /* navegação privada: vale só enquanto a página estiver aberta */
    }
    if (!t) {
      setEstado("invalido");
      return;
    }
    setToken(t);
    carregar(t).catch((e) => {
      setErro(e instanceof Error ? e.message : String(e));
      setEstado("erro");
    });
  }, [carregar]);

  if (estado === "carregando") {
    return (
      <div className="carregando" role="status">
        Carregando…
      </div>
    );
  }

  if (estado === "invalido" || estado === "erro" || !dados) {
    return (
      <Acesso
        titulo={estado === "erro" ? "Não foi possível abrir" : "Link inválido ou expirado"}
        texto={
          estado === "erro"
            ? erro
            : "Este link de visualização não existe mais, expirou ou foi revogado. Peça um novo link a quem compartilhou."
        }
      >
        <span />
      </Acesso>
    );
  }

  return (
    <ProvedorDados
      value={{
        lancamentos: dados.lancamentos,
        config: dados.config,
        metas: dados.metas,
        propostas: dados.propostas,
        pagadores: PAGADORES_PADRAO,
        email: "",
        atualizadoEm,
        recarregar: () => carregar(token),
        somenteLeitura: true,
      }}
    >
      <div className="app__main">
        <header className="barra-compartilhada">
          <div className="marca">
            <span className="marca__simbolo" aria-hidden>
              M
            </span>
            <span>
              <span className="marca__nome">Mercatto</span>
              <span className="marca__sub">Financeiro</span>
            </span>
          </div>
          <span className="selo selo--negociacao">Somente leitura</span>
          <span className="barra-compartilhada__info">
            Compartilhado com {dados.nome}
            {dados.expira_em && ` · válido até ${new Date(dados.expira_em).toLocaleDateString("pt-BR")}`}
          </span>
        </header>
        <Suspense fallback={<div className="carregando">Carregando…</div>}>
          <VisaoGeral />
        </Suspense>
        <footer className="rodape-pagina">
          <span>Mercatto Imóveis · Balneário Camboriú &amp; Praia Brava</span>
          <span>
            {atualizadoEm &&
              `Dados de ${atualizadoEm.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}`}{" "}
            ·{" "}
            <button className="link" onClick={() => carregar(token).catch(() => setEstado("erro"))}>
              Atualizar
            </button>
          </span>
        </footer>
      </div>
    </ProvedorDados>
  );
}
