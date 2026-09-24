import type { Metadata } from "next";
import { Suspense } from "react";
import { VerificarMfa } from "@/components/acesso/Mfa";

export const metadata: Metadata = { title: "Código do autenticador" };

export default function Pagina() {
  return (
    <Suspense>
      <VerificarMfa />
    </Suspense>
  );
}
