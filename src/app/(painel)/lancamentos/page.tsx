import type { Metadata } from "next";
import { Lancamentos } from "@/components/paginas/Lancamentos";

export const metadata: Metadata = { title: "Lançamentos" };

export default function Pagina() {
  return <Lancamentos />;
}
