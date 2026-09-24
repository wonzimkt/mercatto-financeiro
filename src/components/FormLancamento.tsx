"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { useDados } from "@/components/Painel";
import { atualizarLancamento, criarLancamento, excluirLancamento } from "@/lib/dados";
import { valoresUsados } from "@/lib/financeiro/calculos";
import { hojeISO, validaData } from "@/lib/financeiro/datas";
import { lerValor, moeda, paraCampo } from "@/lib/financeiro/formato";
import {
  CATEGORIAS,
  COMISSAO,
  ORIGENS,
  RETIRADA,
  type Categoria,
  type Lancamento,
  type LancamentoEntrada,
  type Origem,
  type Tipo,
} from "@/lib/financeiro/tipos";

type Erros = Partial<Record<string, string>>;

export function FormLancamento({ inicial }: { inicial?: Lancamento }) {
  const router = useRouter();
  const { lancamentos, config, recarregar } = useDados();

  const [tipo, setTipo] = useState<Tipo>(inicial?.tipo ?? "receita");
  const [categoria, setCategoria] = useState<Categoria>(inicial?.categoria ?? COMISSAO);
  const [valor, setValor] = useState(paraCampo(inicial?.valor));
  const [data, setData] = useState(inicial?.data ?? hojeISO());
  const [origem, setOrigem] = useState<Origem | "">(inicial?.origem_recurso ?? "");
  const [descricao, setDescricao] = useState(inicial?.descricao ?? "");
  const [corretor, setCorretor] = useState(inicial?.corretor ?? "");
  const [cliente, setCliente] = useState(inicial?.cliente ?? "");
  const [produto, setProduto] = useState(inicial?.produto ?? "");
  const [cidade, setCidade] = useState(inicial?.cidade ?? "");
  const [socio, setSocio] = useState(inicial?.socio ?? "");

  // Calculadora de comissão
  const [usarCalculadora, setUsarCalculadora] = useState(inicial ? inicial.comissao_bruta !== null : true);
  const [comissaoTotal, setComissaoTotal] = useState(paraCampo(inicial?.comissao_bruta));
  const [split, setSplit] = useState(
    paraCampo(inicial?.split_empresa_percent ?? config.split_empresa_percent).replace(/,00$/, ""),
  );

  const [erros, setErros] = useState<Erros>({});
  const [falha, setFalha] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [salvoAgora, setSalvoAgora] = useState("");

  const sugestoes = useMemo(
    () => ({
      corretor: valoresUsados(lancamentos, "corretor"),
      cliente: valoresUsados(lancamentos, "cliente"),
      produto: valoresUsados(lancamentos, "produto"),
      cidade: valoresUsados(lancamentos, "cidade"),
      socio: valoresUsados(lancamentos, "socio"),
    }),
    [lancamentos],
  );

  const ehComissao = categoria === COMISSAO;
  const ehRetirada = categoria === RETIRADA;
  const calculando = ehComissao && usarCalculadora;

  const totalNum = lerValor(comissaoTotal);
  const splitNum = lerValor(split);
  const liquidoCalculado =
    Number.isFinite(totalNum) && Number.isFinite(splitNum) ? Math.round(totalNum * splitNum) / 100 : Number.NaN;
  const valorFinal = calculando ? liquidoCalculado : lerValor(valor);

  function trocarTipo(t: Tipo) {
    setTipo(t);
    setCategoria(CATEGORIAS[t][0]);
    setErros({});
  }

  function validar(): Erros {
    const e: Erros = {};
    if (!CATEGORIAS[tipo].includes(categoria)) e.categoria = "Escolha uma categoria.";
    if (calculando) {
      if (!(totalNum > 0)) e.comissaoTotal = "Informe a comissão total recebida.";
      if (!(splitNum > 0 && splitNum <= 100)) e.split = "Entre 0 e 100.";
    }
    if (!(valorFinal > 0)) e.valor = "Informe um valor maior que zero.";
    if (!validaData(data)) e.data = "Data inválida.";
    if (!origem) e.origem = "Escolha de onde o dinheiro entrou ou saiu.";
    if (ehComissao) {
      if (!corretor.trim()) e.corretor = "Obrigatório em comissões.";
      if (!cliente.trim()) e.cliente = "Obrigatório em comissões.";
      if (!produto.trim()) e.produto = "Obrigatório em comissões.";
      if (!cidade.trim()) e.cidade = "Obrigatório em comissões.";
    }
    if (ehRetirada && !socio.trim()) e.socio = "Informe o sócio.";
    return e;
  }

  function montar(): LancamentoEntrada {
    const t = (s: string) => s.trim() || null;
    return {
      tipo,
      categoria,
      valor: Math.round(valorFinal * 100) / 100,
      data,
      descricao: t(descricao),
      origem_recurso: origem as Origem,
      corretor: ehComissao ? t(corretor) : null,
      cliente: ehComissao ? t(cliente) : null,
      produto: ehComissao ? t(produto) : null,
      cidade: ehComissao ? t(cidade) : null,
      socio: ehRetirada ? t(socio) : null,
      comissao_bruta: calculando ? totalNum : null,
      split_empresa_percent: calculando ? splitNum : null,
    };
  }

  async function salvar(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const continuar = (ev.nativeEvent as SubmitEvent).submitter?.getAttribute("value") === "continuar";
    setFalha("");
    setSalvoAgora("");
    const e = validar();
    setErros(e);
    if (Object.keys(e).length) {
      document.querySelector<HTMLElement>("[aria-invalid='true']")?.focus();
      return;
    }
    setSalvando(true);
    try {
      const l = montar();
      if (inicial) await atualizarLancamento(inicial.id, l);
      else await criarLancamento(l);
      await recarregar();
      if (continuar) {
        // Mantém tipo, categoria, data e origem para lançar em sequência.
        setValor("");
        setComissaoTotal("");
        setDescricao("");
        setCliente("");
        setProduto("");
        setSalvoAgora(`Lançamento de ${moeda(l.valor)} (${l.categoria}) registrado.`);
      } else {
        router.push("/lancamentos/");
      }
    } catch (err) {
      setFalha(err instanceof Error ? err.message : String(err));
    } finally {
      setSalvando(false);
    }
  }

  async function excluir() {
    if (!inicial) return;
    if (!confirm(`Excluir definitivamente este lançamento de ${moeda(inicial.valor)}? Não dá para desfazer.`)) return;
    setSalvando(true);
    try {
      await excluirLancamento(inicial.id);
      await recarregar();
      router.push("/lancamentos/");
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
        aria-describedby={erros[id] ? `${id}-erro` : undefined}
      />
      <datalist id={`lista-${id}`}>
        {sugestoes[id].map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      {erros[id] && (
        <span className="campo__erro" id={`${id}-erro`}>
          {erros[id]}
        </span>
      )}
    </div>
  );

  return (
    <form className="form" onSubmit={salvar} noValidate>
      <fieldset className="campo campo--largo">
        <legend className="sr-only">Tipo</legend>
        <div className="segmentos segmentos--grande">
          {(["receita", "despesa"] as const).map((t) => (
            <label key={t}>
              <input type="radio" name="tipo" value={t} checked={tipo === t} onChange={() => trocarTipo(t)} />
              {t === "receita" ? "Receita" : "Despesa"}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="campo">
        <label htmlFor="categoria">Categoria</label>
        <select
          id="categoria"
          value={categoria}
          onChange={(e) => setCategoria(e.target.value as Categoria)}
          aria-invalid={erros.categoria ? true : undefined}
        >
          {CATEGORIAS[tipo].map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        {erros.categoria && <span className="campo__erro">{erros.categoria}</span>}
      </div>

      <div className="campo">
        <label htmlFor="data">Data</label>
        <input
          id="data"
          type="date"
          value={data}
          onChange={(e) => setData(e.target.value)}
          aria-invalid={erros.data ? true : undefined}
        />
        {erros.data && <span className="campo__erro">{erros.data}</span>}
      </div>

      <fieldset className="campo">
        <legend>Origem do recurso</legend>
        <div className="segmentos" style={{ marginTop: 6 }}>
          {ORIGENS.map((o) => (
            <label key={o}>
              <input
                type="radio"
                name="origem"
                value={o}
                checked={origem === o}
                onChange={() => setOrigem(o)}
                aria-invalid={erros.origem ? true : undefined}
              />
              {o}
            </label>
          ))}
        </div>
        {erros.origem && <span className="campo__erro">{erros.origem}</span>}
      </fieldset>

      {ehComissao && (
        <div className="calculadora">
          <div className="calculadora__titulo" style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "baseline" }}>
            Calculadora de comissão
            <label className="campo__ajuda" style={{ display: "inline-flex", gap: 6, alignItems: "center", fontFamily: "var(--sans)" }}>
              <input type="checkbox" checked={usarCalculadora} onChange={(e) => setUsarCalculadora(e.target.checked)} />
              calcular o líquido a partir da comissão total
            </label>
          </div>
          {usarCalculadora ? (
            <>
              <div className="campo">
                <label htmlFor="comissaoTotal">Comissão total recebida (R$)</label>
                <input
                  id="comissaoTotal"
                  className="num"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={comissaoTotal}
                  onChange={(e) => setComissaoTotal(e.target.value)}
                  aria-invalid={erros.comissaoTotal ? true : undefined}
                />
                {erros.comissaoTotal && <span className="campo__erro">{erros.comissaoTotal}</span>}
              </div>
              <div className="campo">
                <label htmlFor="split">% da empresa</label>
                <input
                  id="split"
                  className="num"
                  inputMode="decimal"
                  value={split}
                  onChange={(e) => setSplit(e.target.value)}
                  aria-invalid={erros.split ? true : undefined}
                />
                <span className="campo__ajuda">Padrão: {String(config.split_empresa_percent).replace(".", ",")}%</span>
                {erros.split && <span className="campo__erro">{erros.split}</span>}
              </div>
              <div className="calculadora__resultado" aria-live="polite">
                <span className="versal">Líquido da empresa</span>
                <strong className={Number.isFinite(liquidoCalculado) ? "pos" : "muted"}>
                  {Number.isFinite(liquidoCalculado) ? moeda(liquidoCalculado) : "—"}
                </strong>
                <span className="campo__ajuda">
                  Repasse ao corretor:{" "}
                  {Number.isFinite(liquidoCalculado) ? moeda(totalNum - liquidoCalculado) : "—"}
                </span>
                {erros.valor && <span className="campo__erro">{erros.valor}</span>}
              </div>
            </>
          ) : (
            <p className="campo__ajuda" style={{ gridColumn: "1 / -1", margin: 0 }}>
              Informe abaixo direto o valor líquido que ficou com a empresa.
            </p>
          )}
        </div>
      )}

      {!calculando && (
        <div className="campo">
          <label htmlFor="valor">{ehComissao ? "Valor líquido da empresa (R$)" : "Valor (R$)"}</label>
          <input
            id="valor"
            className="num"
            inputMode="decimal"
            placeholder="0,00"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            aria-invalid={erros.valor ? true : undefined}
          />
          {erros.valor && <span className="campo__erro">{erros.valor}</span>}
        </div>
      )}

      {ehComissao && (
        <>
          {campoTexto("corretor", "Corretor", corretor, setCorretor)}
          {campoTexto("cliente", "Cliente", cliente, setCliente)}
          {campoTexto("produto", "Imóvel / empreendimento", produto, setProduto)}
          {campoTexto("cidade", "Cidade", cidade, setCidade, "Balneário Camboriú, Itajaí…")}
        </>
      )}

      {ehRetirada && campoTexto("socio", "Sócio", socio, setSocio)}

      <div className="campo campo--largo">
        <label htmlFor="descricao">Descrição (opcional)</label>
        <textarea id="descricao" rows={2} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
      </div>

      <div className="form__rodape">
        <button className="btn btn--primario" type="submit" value="salvar" disabled={salvando}>
          {salvando ? "Salvando…" : inicial ? "Salvar alterações" : "Registrar lançamento"}
        </button>
        {!inicial && (
          <button className="btn" type="submit" value="continuar" disabled={salvando}>
            Registrar e lançar outro
          </button>
        )}
        <button className="btn btn--fantasma" type="button" onClick={() => router.back()} disabled={salvando}>
          Cancelar
        </button>
        {inicial && (
          <button className="btn btn--perigo" type="button" onClick={excluir} disabled={salvando} style={{ marginLeft: "auto" }}>
            Excluir
          </button>
        )}
        {salvoAgora && (
          <span className="pos" role="status" style={{ fontSize: 14 }}>
            ✓ {salvoAgora}
          </span>
        )}
      </div>

      {falha && (
        <p className="aviso aviso--erro campo--largo" role="alert" style={{ margin: 0 }}>
          {falha}
        </p>
      )}
    </form>
  );
}
