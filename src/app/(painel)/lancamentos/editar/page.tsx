import type { Metadata } from "next";
import { EditarLancamento } from "@/components/paginas/EditarLancamento";

export const metadata: Metadata = { title: "Editar lançamento" };

export default function Pagina() {
  return <EditarLancamento />;
}
