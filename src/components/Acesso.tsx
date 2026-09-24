import type { ReactNode } from "react";

export function MarcaAcesso() {
  return (
    <div className="marca" style={{ padding: 0 }}>
      <span className="marca__simbolo" aria-hidden>
        M
      </span>
      <span>
        <span className="marca__nome">Mercatto</span>
        <span className="marca__sub">Financeiro</span>
      </span>
    </div>
  );
}

export function Acesso({ titulo, texto, children }: { titulo: string; texto?: ReactNode; children: ReactNode }) {
  return (
    <main className="acesso">
      <div className="acesso__folha">
        <MarcaAcesso />
        <h1 className="acesso__titulo">{titulo}</h1>
        {texto && <p className="acesso__texto">{texto}</p>}
        {children}
      </div>
    </main>
  );
}
