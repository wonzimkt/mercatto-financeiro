import type { Metadata } from "next";
import { Configuracoes } from "@/components/paginas/Configuracoes";

export const metadata: Metadata = { title: "Configurações" };

export default function Pagina() {
  return <Configuracoes />;
}
