import type { Metadata } from "next";
import { Suspense } from "react";
import { DefinirSenha } from "@/components/acesso/Senha";

export const metadata: Metadata = { title: "Definir senha" };

export default function Pagina() {
  return (
    <Suspense>
      <DefinirSenha />
    </Suspense>
  );
}
