"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useRef } from "react";
import { TemaToggle } from "@/components/TemaToggle";
import { supabase } from "@/lib/supabase/cliente";

const ABAS = [
  { href: "/", numeral: "i", rotulo: "Visão geral" },
  { href: "/vendas/", numeral: "ii", rotulo: "Vendas & corretores" },
  { href: "/despesas/", numeral: "iii", rotulo: "Despesas" },
  { href: "/metas/", numeral: "iv", rotulo: "Metas & projeções" },
  { href: "/socios/", numeral: "v", rotulo: "Sócios & retiradas" },
  { href: "/lancamentos/", numeral: "vi", rotulo: "Lançamentos" },
  { href: "/exportar/", numeral: "vii", rotulo: "Exportação" },
];

const normalizar = (p: string) => (p.endsWith("/") ? p : `${p}/`);

export function Cabecalho({ email }: { email: string }) {
  const caminho = normalizar(usePathname());
  const router = useRouter();
  const menu = useRef<HTMLDetailsElement>(null);
  const fechar = () => menu.current?.removeAttribute("open");

  const ativa = (href: string) => (href === "/" ? caminho === "/" : caminho.startsWith(href));

  return (
    <header className="masthead">
      <div className="masthead__topo">
        <Link href="/" className="marca" aria-label="Mercatto — visão geral">
          <span className="marca__nome">Mercatto</span>
          <span className="marca__sub">Livro-razão · Balneário Camboriú &amp; Praia Brava</span>
        </Link>

        <div className="masthead__acoes">
          <Link href="/lancamentos/novo/" className="btn btn--primario">
            <span aria-hidden>+</span>
            <span className="ocultar-mobile">Novo lançamento</span>
            <span className="sr-only">Novo lançamento</span>
          </Link>
          <TemaToggle />
          <details className="menu" ref={menu}>
            <summary className="btn btn--icone" aria-label="Menu da conta">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
                <circle cx="12" cy="8" r="4" />
                <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
              </svg>
            </summary>
            <div className="menu__painel">
              <div className="menu__email">{email}</div>
              <Link href="/configuracoes/" onClick={fechar}>
                Configurações
              </Link>
              <Link href="/usuarios/" onClick={fechar}>
                Usuários e convites
              </Link>
              <button
                onClick={async () => {
                  fechar();
                  await supabase().auth.signOut();
                  router.replace("/login/");
                }}
              >
                Sair
              </button>
            </div>
          </details>
        </div>
      </div>

      <nav className="abas" aria-label="Seções">
        {ABAS.map((a) => (
          <Link key={a.href} href={a.href} className="aba" aria-current={ativa(a.href) ? "page" : undefined}>
            <span className="aba__numeral" aria-hidden>
              {a.numeral}.
            </span>
            {a.rotulo}
          </Link>
        ))}
      </nav>
    </header>
  );
}
