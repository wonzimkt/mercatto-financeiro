"use client";

import { usePathname, useRouter } from "next/navigation";
import { createContext, Suspense, useCallback, useContext, useEffect, useState } from "react";
import { MarcaAcesso } from "@/components/Acesso";
import { Navegacao } from "@/components/Navegacao";
import { buscarConfiguracoes, buscarLancamentos, buscarMetas, buscarPropostas } from "@/lib/dados";
import { CONFIG_DEMO, lancamentosDemo, METAS_DEMO, MODO_DEMO, propostasDemo } from "@/lib/demo";
import { CONFIG_PADRAO, type Configuracoes, type Lancamento, type MetaAnual, type Proposta } from "@/lib/financeiro/tipos";
import { destinoDaSessao, supabase } from "@/lib/supabase/cliente";

interface DadosPainel {
  lancamentos: Lancamento[];
  config: Configuracoes;
  metas: MetaAnual[];
  propostas: Proposta[];
  email: string;
  atualizadoEm: Date | null;
  recarregar: () => Promise<void>;
}

const Contexto = createContext<DadosPainel | null>(null);

export function useDados(): DadosPainel {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error("useDados precisa estar dentro de <Painel>.");
  return ctx;
}

type Fase = "verificando" | "carregando" | "pronto" | "erro";

/**
 * Porteiro do painel. No GitHub Pages não há middleware de servidor, então
 * a checagem acontece aqui, no navegador: sem sessão → login; sem MFA →
 * código ou cadastro do autenticador. Isso é só a experiência de uso — a
 * proteção de verdade é o RLS, que recusa qualquer leitura sem aal2.
 */
export function Painel({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const caminho = usePathname();
  const [fase, setFase] = useState<Fase>("verificando");
  const [erro, setErro] = useState("");
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [config, setConfig] = useState<Configuracoes>(CONFIG_PADRAO);
  const [metas, setMetas] = useState<MetaAnual[]>([]);
  const [propostas, setPropostas] = useState<Proposta[]>([]);
  const [email, setEmail] = useState("");
  const [atualizadoEm, setAtualizadoEm] = useState<Date | null>(null);

  const recarregar = useCallback(async () => {
    if (MODO_DEMO) {
      setLancamentos(lancamentosDemo());
      setConfig(CONFIG_DEMO);
      setMetas(METAS_DEMO);
      setPropostas((atual) => (atual.length ? atual : propostasDemo()));
      setAtualizadoEm(new Date());
      return;
    }
    const [ls, cfg, mts, pps] = await Promise.all([
      buscarLancamentos(),
      buscarConfiguracoes(),
      buscarMetas(),
      buscarPropostas(),
    ]);
    setLancamentos(ls);
    setConfig(cfg);
    setMetas(mts);
    setPropostas(pps);
    setAtualizadoEm(new Date());
  }, []);

  useEffect(() => {
    let vivo = true;
    let cancelar = () => {};

    // Links de convite/recuperação com os modelos padrão do Supabase chegam
    // aqui com o token no #hash. Lido antes do cliente consumir o hash.
    const tipoLink = new URLSearchParams(window.location.hash.slice(1)).get("type");

    (async () => {
      try {
        if (tipoLink === "invite" || tipoLink === "recovery") {
          await supabase().auth.getSession(); // processa o token do link
          router.replace("/auth/definir-senha/");
          return;
        }
        if (MODO_DEMO) {
          setEmail("demonstração (dados fictícios)");
          await recarregar();
          setFase("pronto");
          return;
        }
        const sb = supabase();
        const { data: sub } = sb.auth.onAuthStateChange((evento) => {
          if (evento === "SIGNED_OUT") router.replace("/login/");
        });
        cancelar = () => sub.subscription.unsubscribe();

        const destino = await destinoDaSessao();
        if (!vivo) return;
        if (destino) {
          const volta = destino === "/login/" ? "" : `?volta=${encodeURIComponent(caminho)}`;
          router.replace(destino + volta);
          return;
        }
        // getUser confere o token no servidor de Auth (não só no navegador).
        const { data, error } = await sb.auth.getUser();
        if (error || !data.user) {
          router.replace("/login/");
          return;
        }
        setEmail(data.user.email ?? "");
        // O RLS devolveria listas vazias; melhor explicar o motivo.
        if (data.user.app_metadata?.mercatto_membro !== true) {
          setErro(
            `A conta ${data.user.email} ainda não foi liberada para acessar o sistema. ` +
              "Peça a um administrador para liberar o acesso e entre novamente.",
          );
          setFase("erro");
          return;
        }
        // Autorizado depois do login: renova o token para o RLS enxergar a marca.
        const { data: sessao } = await sb.auth.getSession();
        if (sessao.session?.user.app_metadata?.mercatto_membro !== true) await sb.auth.refreshSession();
        setFase("carregando");
        await recarregar();
        if (vivo) setFase("pronto");
      } catch (e) {
        if (!vivo) return;
        setErro(e instanceof Error ? e.message : String(e));
        setFase("erro");
      }
    })();

    return () => {
      vivo = false;
      cancelar();
    };
    // Só na montagem: navegar entre abas não refaz a checagem nem a carga.
  }, []);

  if (fase === "verificando" || fase === "carregando") {
    return (
      <div className="carregando" role="status">
        {fase === "verificando" ? "Conferindo credenciais…" : "Carregando dados…"}
      </div>
    );
  }

  if (fase === "erro") {
    return (
      <main className="acesso">
        <div className="acesso__folha">
          <MarcaAcesso />
          <h1 className="acesso__titulo">Não foi possível abrir</h1>
          <p className="aviso aviso--erro">{erro}</p>
          <p style={{ display: "flex", gap: 12, marginTop: 20 }}>
            <button className="btn" onClick={() => window.location.reload()}>
              Tentar de novo
            </button>
            <button
              className="btn btn--fantasma"
              onClick={async () => {
                await supabase().auth.signOut().catch(() => {});
                router.replace("/login/");
              }}
            >
              Sair
            </button>
          </p>
        </div>
      </main>
    );
  }

  return (
    <Contexto.Provider value={{ lancamentos, config, metas, propostas, email, atualizadoEm, recarregar }}>
      <div className="app">
        <Navegacao email={email} />
        <div className="app__main">
          <Suspense fallback={<div className="carregando">Carregando…</div>}>{children}</Suspense>
          <footer className="rodape-pagina">
            <span>Mercatto Imóveis · Balneário Camboriú &amp; Praia Brava</span>
            <span>
              {lancamentos.length} lançamentos
              {atualizadoEm &&
                ` · atualizado às ${atualizadoEm.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`}{" "}
              ·{" "}
              <button className="link" onClick={() => recarregar().catch((e) => alert(e.message))}>
                Atualizar dados
              </button>
            </span>
          </footer>
        </div>
      </div>
    </Contexto.Provider>
  );
}
