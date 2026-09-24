import type { Metadata } from "next";
import { Exportar } from "@/components/paginas/Exportar";

export const metadata: Metadata = { title: "Exportação" };

export default function Pagina() {
  return <Exportar />;
}
