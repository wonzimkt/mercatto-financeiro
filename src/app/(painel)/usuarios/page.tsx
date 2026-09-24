import type { Metadata } from "next";
import { Usuarios } from "@/components/paginas/Usuarios";

export const metadata: Metadata = { title: "Usuários" };

export default function Pagina() {
  return <Usuarios />;
}
