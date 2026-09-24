import type { Metadata } from "next";
import { Suspense } from "react";
import { ConfigurarMfa } from "@/components/acesso/Mfa";

export const metadata: Metadata = { title: "Configurar autenticador" };

export default function Pagina() {
  return (
    <Suspense>
      <ConfigurarMfa />
    </Suspense>
  );
}
