import type { Metadata } from "next";
import { Futuros } from "@/components/paginas/Futuros";

export const metadata: Metadata = { title: "Lançamentos futuros" };

export default function Pagina() {
  return <Futuros />;
}
