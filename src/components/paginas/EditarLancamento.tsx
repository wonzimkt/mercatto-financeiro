"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormLancamento } from "@/components/FormLancamento";
import { CabecalhoPagina, Secao } from "@/components/ui";
import { useDados } from "@/components/Painel";
import { dataBR } from "@/lib/financeiro/formato";

export function NovoLancamento() {
  const idProposta = useSearchParams().get("proposta");
  const { propostas } = useDados();
  const proposta = propostas.find((p) => p.id === idProposta && p.status === "negociacao");

  return (
    <main className="pagina">
      <CabecalhoPagina
        titulo={proposta ? "Registrar venda" : "Novo lançamento"}
        descricao={proposta ? "A comissão entra no financeiro e a proposta fica como fechada." : "Registre uma receita ou despesa."}
      />
      {proposta && (
        <p className="aviso">
          Venda da proposta <strong>{proposta.produto}</strong> · {proposta.corretor} · enviada em {dataBR(proposta.data)}. Confira o
          VGV final e a data da nota fiscal.
        </p>
      )}
      <Secao titulo="Registro">
        <FormLancamento key={proposta?.id ?? "novo"} proposta={proposta} />
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
        titulo="Editar lançamento"
        descricao={`Registrado em ${dataBR(l.criado_em)}${l.atualizado_em !== l.criado_em ? ` · alterado em ${dataBR(l.atualizado_em)}` : ""}`}
      />
      <Secao titulo={l.categoria}>
        <FormLancamento key={l.id} inicial={l} />
      </Secao>
    </main>
  );
}
