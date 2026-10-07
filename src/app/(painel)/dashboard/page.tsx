import type { Metadata } from "next";
import { Dashboard } from "@/components/paginas/Dashboard";

export const metadata: Metadata = { title: "Dashboard" };

export default function Pagina() {
  return <Dashboard />;
}
