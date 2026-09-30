import type { Metadata } from "next";
import { VisaoCompartilhadaPagina } from "@/components/paginas/VisaoCompartilhada";

export const metadata: Metadata = {
  title: "Visão geral compartilhada",
  // O código do link vai no #fragmento; mesmo assim, nada de indexar nem vazar referência.
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

export default function Pagina() {
  return <VisaoCompartilhadaPagina />;
}
