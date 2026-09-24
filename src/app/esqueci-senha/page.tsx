import type { Metadata } from "next";
import { Suspense } from "react";
import { EsqueciSenha } from "@/components/acesso/Senha";

export const metadata: Metadata = { title: "Redefinir senha" };

export default function Pagina() {
  return (
    <Suspense>
      <EsqueciSenha />
    </Suspense>
  );
}
