import type { Metadata } from "next";
import { Suspense } from "react";
import { ConfirmarLink } from "@/components/acesso/Senha";

export const metadata: Metadata = { title: "Validando link" };

export default function Pagina() {
  return (
    <Suspense>
      <ConfirmarLink />
    </Suspense>
  );
}
