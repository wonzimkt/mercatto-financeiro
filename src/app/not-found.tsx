import Link from "next/link";
import { Acesso } from "@/components/Acesso";

export default function NaoEncontrado() {
  return (
    <Acesso titulo="Página não encontrada" texto="Esse endereço não existe.">
      <Link className="btn" href="/">
        Voltar à visão geral
      </Link>
    </Acesso>
  );
}
