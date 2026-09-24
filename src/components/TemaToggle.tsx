"use client";

import { useEffect, useState } from "react";
import { Icone } from "@/components/Icones";

type Tema = "dark" | "light";

function temaAtual(): Tema {
  const escolhido = document.documentElement.dataset.theme;
  if (escolhido === "light" || escolhido === "dark") return escolhido;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function TemaToggle() {
  const [tema, setTema] = useState<Tema>("light");

  useEffect(() => setTema(temaAtual()), []);

  function alternar() {
    const novo: Tema = temaAtual() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = novo;
    try {
      localStorage.setItem("mercatto-tema", novo);
    } catch {
      /* navegação privada: vale só para esta visita */
    }
    setTema(novo);
  }

  return (
    <button type="button" className="btn btn--menu btn--bloco" onClick={alternar}>
      <Icone nome={tema === "dark" ? "sol" : "lua"} />
      {tema === "dark" ? "Tema claro" : "Tema escuro"}
    </button>
  );
}
