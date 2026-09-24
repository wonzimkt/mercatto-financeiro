import type { Metadata } from "next";
import { NovoLancamento } from "@/components/paginas/EditarLancamento";

export const metadata: Metadata = { title: "Novo lançamento" };

export default function Pagina() {
  return <NovoLancamento />;
}
