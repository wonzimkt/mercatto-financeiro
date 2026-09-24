import type { Metadata } from "next";
import { Propostas } from "@/components/paginas/Propostas";

export const metadata: Metadata = { title: "Propostas" };

export default function Pagina() {
  return <Propostas />;
}
