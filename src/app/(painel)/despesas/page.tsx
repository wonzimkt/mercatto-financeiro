import type { Metadata } from "next";
import { Despesas } from "@/components/paginas/Despesas";

export const metadata: Metadata = { title: "Despesas" };

export default function Pagina() {
  return <Despesas />;
}
