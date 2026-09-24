import type { Metadata } from "next";
import { Vendas } from "@/components/paginas/Vendas";

export const metadata: Metadata = { title: "Vendas & corretores" };

export default function Pagina() {
  return <Vendas />;
}
