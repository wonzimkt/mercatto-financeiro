import type { ReactNode } from "react";

export function Acesso({ titulo, texto, children }: { titulo: string; texto?: ReactNode; children: ReactNode }) {
  return (
    <main className="acesso">
      <div className="acesso__folha">
        <div className="acesso__marca">Mercatto</div>
        <h1 className="acesso__titulo">{titulo}</h1>
        {texto && <p className="acesso__texto">{texto}</p>}
        {children}
      </div>
    </main>
  );
}
