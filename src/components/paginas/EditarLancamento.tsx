"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormLancamento } from "@/components/FormLancamento";
import { CabecalhoPagina, Secao } from "@/components/Livro";
import { useDados } from "@/components/Painel";
import { dataBR } from "@/lib/financeiro/formato";

export function NovoLancamento() {
  return (
    <main className="pagina">
      <CabecalhoPagina titulo="Novo" destaque="lançamento" />
      <Secao titulo="Registro">
        <FormLancamento />
      </Secao>
    </main>
  );
}

export function EditarLancamento() {
  const id = useSearchParams().get("id");
  const { lancamentos } = useDados();
  const l = lancamentos.find((x) => x.id === id);

  if (!l) {
    return (
      <main className="pagina">
        <CabecalhoPagina titulo="Lançamento não encontrado" />
        <p className="vazio">
          Ele pode ter sido excluído.{" "}
          <Link className="link" href="/lancamentos/">
            Voltar aos lançamentos
          </Link>
        </p>
      </main>
    );
  }

  return (
    <main className="pagina">
      <CabecalhoPagina
        titulo="Editar"
        destaque="lançamento"
        descricao={`Registrado em ${dataBR(l.criado_em)}${l.atualizado_em !== l.criado_em ? ` · alterado em ${dataBR(l.atualizado_em)}` : ""}`}
      />
      <Secao titulo={l.categoria}>
        <FormLancamento key={l.id} inicial={l} />
      </Secao>
    </main>
  );
}
