"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { useDados } from "@/components/Painel";
import { CabecalhoPagina, Secao } from "@/components/ui";
import { atualizarProposta, criarProposta, excluirProposta } from "@/lib/dados";
import { valoresUsados } from "@/lib/financeiro/calculos";
import { hojeISO, validaData } from "@/lib/financeiro/datas";
import { dataBR, lerValor, moeda, moedaCompacta, paraCampo } from "@/lib/financeiro/formato";
import { liquidoPotencial } from "@/lib/financeiro/propostas";
import type { Proposta, PropostaEntrada } from "@/lib/financeiro/tipos";

type Erros = Partial<Record<string, string>>;

function unir(...listas: string[][]): string[] {
  const vistos = new Map<string, string>();
  for (const v of listas.flat()) {
    const k = v.trim().toLocaleLowerCase("pt-BR");
    if (k && !vistos.has(k)) vistos.set(k, v.trim());
  }
  return [...vistos.values()].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function FormProposta({ inicial, marcarPerdida = false }: { inicial?: Proposta; marcarPerdida?: boolean }) {
  const router = useRouter();
  const { lancamentos, propostas, config, recarregar } = useDados();

  const [data, setData] = useState(inicial?.data ?? hojeISO());
  const [vgv, setVgv] = useState(paraCampo(inicial?.vgv));
  const [corretor, setCorretor] = useState(inicial?.corretor ?? "");
  const [produto, setProduto] = useState(inicial?.produto ?? "");
  const [cliente, setCliente] = useState(inicial?.cliente ?? "");
  const [cidade, setCidade] = useState(inicial?.cidade ?? "");
  const [observacao, setObservacao] = useState(inicial?.observacao ?? "");
  const [perdida, setPerdida] = useState(inicial?.status === "perdida" || marcarPerdida);
  const [encerradaEm, setEncerradaEm] = useState(inicial?.encerrada_em ?? hojeISO());
  const [motivo, setMotivo] = useState(inicial?.motivo_perda ?? "");

  const [erros, setErros] = useState<Erros>({});
  const [falha, setFalha] = useState("");
  const [salvando, setSalvando] = useState(false);

  const fechada = inicial?.status === "fechada";

  // Sugestões: o que já foi usado em propostas e em vendas
  const sugestoes = useMemo(() => {
    const dasPropostas = (campo: "corretor" | "produto" | "cliente" | "cidade") =>
      propostas.map((p) => p[campo] ?? "").filter(Boolean);
    return {
      corretor: unir(dasPropostas("corretor"), valoresUsados(lancamentos, "corretor")),
      produto: unir(dasPropostas("produto"), valoresUsados(lancamentos, "produto")),
      cliente: unir(dasPropostas("cliente"), valoresUsados(lancamentos, "cliente")),
      cidade: unir(dasPropostas("cidade"), valoresUsados(lancamentos, "cidade")),
    };
  }, [propostas, lancamentos]);

  const vgvNum = lerValor(vgv);

  function validar(): Erros {
    const e: Erros = {};
    if (!validaData(data)) e.data = "Data inválida.";
    if (!(vgvNum > 0)) e.vgv = "Informe o VGV.";
    if (!corretor.trim()) e.corretor = "Informe o corretor.";
    if (!produto.trim()) e.produto = "Informe o imóvel / empreendimento.";
    if (perdida && !validaData(encerradaEm)) e.encerradaEm = "Data inválida.";
    return e;
  }

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    setFalha("");
    const e = validar();
    setErros(e);
    if (Object.keys(e).length) {
      document.querySelector<HTMLElement>("[aria-invalid='true']")?.focus();
      return;
    }
    const t = (s: string) => s.trim() || null;
    const base = {
      data,
      vgv: Math.round(vgvNum * 100) / 100,
      corretor: corretor.trim(),
      produto: produto.trim(),
      cliente: t(cliente),
      cidade: t(cidade),
      observacao: t(observacao),
    };
    // Proposta já fechada (virou venda) mantém a situação; as demais alternam entre negociação e perdida.
    const situacao: Pick<PropostaEntrada, "status" | "encerrada_em" | "motivo_perda"> = fechada
      ? { status: "fechada", encerrada_em: inicial!.encerrada_em, motivo_perda: null }
      : perdida
        ? { status: "perdida", encerrada_em: encerradaEm, motivo_perda: t(motivo) }
        : { status: "negociacao", encerrada_em: null, motivo_perda: null };

    setSalvando(true);
    try {
      if (inicial) await atualizarProposta(inicial.id, { ...base, ...situacao });
      else await criarProposta({ ...base, ...situacao, lancamento_id: null });
      await recarregar();
      router.push("/propostas/");
    } catch (err) {
      setFalha(err instanceof Error ? err.message : String(err));
      setSalvando(false);
    }
  }

  async function excluir() {
    if (!inicial) return;
    if (!confirm(`Excluir definitivamente a proposta de ${inicial.produto}? Não dá para desfazer.`)) return;
    setSalvando(true);
    try {
      await excluirProposta(inicial.id);
      await recarregar();
      router.push("/propostas/");
    } catch (err) {
      setFalha(err instanceof Error ? err.message : String(err));
      setSalvando(false);
    }
  }

  const campoTexto = (
    id: keyof typeof sugestoes,
    rotulo: string,
    v: string,
    set: (s: string) => void,
    placeholder?: string,
  ) => (
    <div className="campo">
      <label htmlFor={id}>{rotulo}</label>
      <input
        id={id}
        list={`lista-${id}`}
        value={v}
        onChange={(e) => set(e.target.value)}
        autoComplete="off"
        placeholder={placeholder}
        aria-invalid={erros[id] ? true : undefined}
      />
      <datalist id={`lista-${id}`}>
        {sugestoes[id].map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      {erros[id] && <span className="campo__erro">{erros[id]}</span>}
    </div>
  );

  return (
    <form className="form" onSubmit={salvar} noValidate>
      <div className="campo">
        <label htmlFor="vgv">VGV da proposta (R$)</label>
        <input
          id="vgv"
          className="num"
          inputMode="decimal"
          placeholder="0,00"
          value={vgv}
          onChange={(e) => setVgv(e.target.value)}
          aria-invalid={erros.vgv ? true : undefined}
        />
        {erros.vgv ? (
          <span className="campo__erro">{erros.vgv}</span>
        ) : (
          vgvNum > 0 && (
            <span className="campo__ajuda">
              Se fechar, o líquido da Mercatto fica em torno de {moeda(liquidoPotencial(vgvNum, config))}.
            </span>
          )
        )}
      </div>

      <div className="campo">
        <label htmlFor="data">Enviada para negociação em</label>
        <input id="data" type="date" value={data} onChange={(e) => setData(e.target.value)} aria-invalid={erros.data ? true : undefined} />
        {erros.data && <span className="campo__erro">{erros.data}</span>}
      </div>

      {campoTexto("corretor", "Corretor", corretor, setCorretor)}
      {campoTexto("produto", "Imóvel / empreendimento", produto, setProduto)}
      {campoTexto("cliente", "Cliente (opcional)", cliente, setCliente)}
      {campoTexto("cidade", "Cidade (opcional)", cidade, setCidade, "Balneário Camboriú, Itajaí…")}

      <div className="campo campo--largo">
        <label htmlFor="observacao">Observação (opcional)</label>
        <textarea
          id="observacao"
          rows={2}
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
          placeholder="Ex.: contraproposta enviada, aguardando financiamento…"
        />
      </div>

      {inicial && !fechada && (
        <fieldset className="campo campo--largo">
          <legend>Situação</legend>
          <div className="segmentos">
            <label>
              <input type="radio" name="situacao" checked={!perdida} onChange={() => setPerdida(false)} />
              Em negociação
            </label>
            <label>
              <input type="radio" name="situacao" checked={perdida} onChange={() => setPerdida(true)} />
              Perdida
            </label>
          </div>
          <span className="campo__ajuda">
            Para fechar a proposta, use <strong>Registrar venda</strong>: assim a comissão entra no financeiro.
          </span>
        </fieldset>
      )}

      {perdida && !fechada && (
        <>
          <div className="campo">
            <label htmlFor="encerrada">Perdida em</label>
            <input
              id="encerrada"
              type="date"
              value={encerradaEm}
              onChange={(e) => setEncerradaEm(e.target.value)}
              aria-invalid={erros.encerradaEm ? true : undefined}
            />
            {erros.encerradaEm && <span className="campo__erro">{erros.encerradaEm}</span>}
          </div>
          <div className="campo">
            <label htmlFor="motivo">Motivo (opcional)</label>
            <input id="motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: cliente desistiu, preço" />
          </div>
        </>
      )}

      {fechada && (
        <p className="aviso aviso--ok campo--largo">
          Esta proposta virou venda em {inicial?.encerrada_em ? dataBR(inicial.encerrada_em) : "—"}.{" "}
          {inicial?.lancamento_id ? (
            <Link className="link" href={`/lancamentos/editar/?id=${inicial.lancamento_id}`}>
              Ver o lançamento da venda
            </Link>
          ) : (
            "O lançamento da venda foi excluído."
          )}
        </p>
      )}

      <div className="form__rodape">
        <button className="btn btn--primario" type="submit" disabled={salvando}>
          {salvando ? "Salvando…" : inicial ? "Salvar alterações" : "Salvar proposta"}
        </button>
        {inicial?.status === "negociacao" && (
          <Link className="btn" href={`/lancamentos/novo/?proposta=${inicial.id}`}>
            Registrar venda
          </Link>
        )}
        <button className="btn btn--fantasma" type="button" onClick={() => router.back()} disabled={salvando}>
          Cancelar
        </button>
        {inicial && (
          <button className="btn btn--perigo" type="button" onClick={excluir} disabled={salvando} style={{ marginLeft: "auto" }}>
            Excluir
          </button>
        )}
      </div>

      {falha && (
        <p className="aviso aviso--erro campo--largo" role="alert">
          {falha}
        </p>
      )}
    </form>
  );
}

export function NovaProposta() {
  return (
    <main className="pagina">
      <CabecalhoPagina
        titulo="Nova proposta"
        descricao="Registre a proposta enviada para negociação. Ela não entra no financeiro."
      />
      <Secao titulo="Dados da proposta">
        <FormProposta />
      </Secao>
    </main>
  );
}

export function EditarProposta() {
  const params = useSearchParams();
  const id = params.get("id");
  const { propostas } = useDados();
  const p = propostas.find((x) => x.id === id);

  if (!p) {
    return (
      <main className="pagina">
        <CabecalhoPagina titulo="Proposta não encontrada" />
        <p className="vazio">
          Ela pode ter sido excluída.{" "}
          <Link className="link" href="/propostas/">
            Voltar às propostas
          </Link>
        </p>
      </main>
    );
  }

  return (
    <main className="pagina">
      <CabecalhoPagina titulo="Editar proposta" descricao={`${p.produto} · ${p.corretor} · VGV ${moedaCompacta(p.vgv)}`} />
      <Secao titulo="Dados da proposta">
        <FormProposta key={p.id} inicial={p} marcarPerdida={params.get("perdida") === "1"} />
      </Secao>
    </main>
  );
}
