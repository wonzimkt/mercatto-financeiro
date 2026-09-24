import type { Metadata } from "next";
import { Suspense } from "react";
import { Login } from "@/components/acesso/Login";

export const metadata: Metadata = { title: "Entrar" };

export default function Pagina() {
  return (
    <Suspense>
      <Login />
    </Suspense>
  );
}
