import type { Metadata } from "next";
import { EditarProposta } from "@/components/paginas/Proposta";

export const metadata: Metadata = { title: "Editar proposta" };

export default function Pagina() {
  return <EditarProposta />;
}
