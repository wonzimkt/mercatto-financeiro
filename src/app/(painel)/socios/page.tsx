import type { Metadata } from "next";
import { Socios } from "@/components/paginas/Socios";

export const metadata: Metadata = { title: "Sócios & retiradas" };

export default function Pagina() {
  return <Socios />;
}
