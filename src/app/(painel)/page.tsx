import type { Metadata } from "next";
import { VisaoGeral } from "@/components/paginas/VisaoGeral";

export const metadata: Metadata = { title: "Visão geral" };

export default function Pagina() {
  return <VisaoGeral />;
}
