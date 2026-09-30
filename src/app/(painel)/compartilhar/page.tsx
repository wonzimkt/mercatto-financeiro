import type { Metadata } from "next";
import { Compartilhar } from "@/components/paginas/Compartilhar";

export const metadata: Metadata = { title: "Links de visualização" };

export default function Pagina() {
  return <Compartilhar />;
}
