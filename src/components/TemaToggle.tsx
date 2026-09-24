"use client";

import { useEffect, useState } from "react";

type Tema = "dark" | "light";

export function TemaToggle() {
  const [tema, setTema] = useState<Tema>("dark");

  useEffect(() => {
    setTema(document.documentElement.dataset.theme === "light" ? "light" : "dark");
  }, []);

  function alternar() {
    const novo: Tema = tema === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = novo;
    try {
      localStorage.setItem("mercatto-tema", novo);
    } catch {
      /* navegação privada: vale só para esta visita */
    }
    setTema(novo);
  }

  const rotulo = tema === "dark" ? "Usar tema claro (papel)" : "Usar tema escuro (marinho)";
  return (
    <button type="button" className="btn btn--icone" onClick={alternar} aria-label={rotulo} title={rotulo}>
      {tema === "dark" ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
          <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" />
        </svg>
      )}
    </button>
  );
}
