"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Icone, type NomeIcone } from "@/components/Icones";
import { TemaToggle } from "@/components/TemaToggle";
import { supabase } from "@/lib/supabase/cliente";

const GRUPOS: { titulo: string; itens: { href: string; rotulo: string; icone: NomeIcone }[] }[] = [
  {
    titulo: "Análises",
    itens: [
      { href: "/", rotulo: "Visão geral", icone: "painel" },
      { href: "/vendas/", rotulo: "Vendas & corretores", icone: "vendas" },
      { href: "/despesas/", rotulo: "Despesas", icone: "despesas" },
      { href: "/metas/", rotulo: "Metas & projeções", icone: "metas" },
      { href: "/socios/", rotulo: "Sócios & retiradas", icone: "socios" },
    ],
  },
  {
    titulo: "Registros",
    itens: [
      { href: "/lancamentos/", rotulo: "Lançamentos", icone: "lancamentos" },
      { href: "/exportar/", rotulo: "Exportação", icone: "exportar" },
    ],
  },
  {
    titulo: "Administração",
    itens: [
      { href: "/configuracoes/", rotulo: "Configurações", icone: "configuracoes" },
      { href: "/usuarios/", rotulo: "Usuários", icone: "usuarios" },
    ],
  },
];

const normalizar = (p: string) => (p.endsWith("/") ? p : `${p}/`);

function Marca() {
  return (
    <Link href="/" className="marca" aria-label="Mercatto — visão geral">
      <span className="marca__simbolo" aria-hidden>
        M
      </span>
      <span>
        <span className="marca__nome">Mercatto</span>
        <span className="marca__sub">Financeiro</span>
      </span>
    </Link>
  );
}

/** Menu lateral fixo no desktop; no celular, barra superior + gaveta. */
export function Navegacao({ email }: { email: string }) {
  const caminho = normalizar(usePathname());
  const router = useRouter();
  const [aberta, setAberta] = useState(false);

  // Fecha a gaveta ao trocar de página e com Esc.
  useEffect(() => setAberta(false), [caminho]);
  useEffect(() => {
    if (!aberta) return;
    const aoTeclar = (e: KeyboardEvent) => e.key === "Escape" && setAberta(false);
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [aberta]);

  const ativa = (href: string) =>
    href === "/" ? caminho === "/" : href === "/lancamentos/" ? caminho.startsWith(href) : caminho === href;

  async function sair() {
    await supabase().auth.signOut();
    router.replace("/login/");
  }

  return (
    <>
      <header className="topbar">
        <button className="btn btn--fantasma btn--icone" onClick={() => setAberta(true)} aria-label="Abrir menu">
          <Icone nome="menu" tamanho={20} />
        </button>
        <Marca />
        <div className="topbar__acoes">
          <Link href="/lancamentos/novo/" className="btn btn--primario btn--icone" aria-label="Novo lançamento">
            <Icone nome="mais" />
          </Link>
        </div>
      </header>

      <div className="fundo-gaveta" data-aberta={aberta} onClick={() => setAberta(false)} aria-hidden />

      <aside className="sidebar" data-aberta={aberta} aria-label="Menu principal">
        <div className="sidebar__topo">
          <Marca />
          <button className="btn btn--fantasma btn--icone sidebar__fechar" onClick={() => setAberta(false)} aria-label="Fechar menu">
            <Icone nome="fechar" />
          </button>
        </div>

        <Link href="/lancamentos/novo/" className="btn btn--primario btn--bloco">
          <Icone nome="mais" tamanho={16} />
          Novo lançamento
        </Link>

        <nav className="nav">
          {GRUPOS.map((g) => (
            <div key={g.titulo} className="nav__secao">
              <p className="nav__grupo">{g.titulo}</p>
              {g.itens.map((i) => (
                <Link key={i.href} href={i.href} className="nav__item" aria-current={ativa(i.href) ? "page" : undefined}>
                  <Icone nome={i.icone} />
                  {i.rotulo}
                </Link>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar__rodape">
          <div className="usuario" title={email}>
            <span className="usuario__avatar" aria-hidden>
              {email.slice(0, 1) || "?"}
            </span>
            <span className="usuario__email">{email}</span>
          </div>
          <TemaToggle />
          <button className="btn btn--menu btn--bloco" onClick={sair}>
            <Icone nome="sair" />
            Sair
          </button>
        </div>
      </aside>
    </>
  );
}
