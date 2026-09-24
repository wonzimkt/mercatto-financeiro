import Link from "next/link";

export default function NaoEncontrado() {
  return (
    <main className="acesso">
      <div className="acesso__folha">
        <div className="acesso__marca">Mercatto</div>
        <h1 className="acesso__titulo">Página não encontrada</h1>
        <p className="acesso__texto">O endereço não existe neste livro-razão.</p>
        <Link className="btn" href="/">
          Voltar à visão geral
        </Link>
      </div>
    </main>
  );
}
