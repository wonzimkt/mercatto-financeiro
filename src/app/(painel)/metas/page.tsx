import type { Metadata } from "next";
import { Metas } from "@/components/paginas/Metas";

export const metadata: Metadata = { title: "Metas & projeções" };

export default function Pagina() {
  return <Metas />;
}
