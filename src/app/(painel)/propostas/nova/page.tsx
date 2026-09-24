import type { Metadata } from "next";
import { NovaProposta } from "@/components/paginas/Proposta";

export const metadata: Metadata = { title: "Nova proposta" };

export default function Pagina() {
  return <NovaProposta />;
}
