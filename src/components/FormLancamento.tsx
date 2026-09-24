"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { useDados } from "@/components/Painel";
import { atualizarLancamento, atualizarProposta, criarLancamento, excluirLancamento } from "@/lib/dados";
import { calcularComissao, valoresUsados } from "@/lib/financeiro/calculos";
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
  type Proposta,
  type Tipo,
} from "@/lib/financeiro/tipos";

type Erros = Partial<Record<string, string>>;

/** "5" / "2,5" — percentuais sem casas desnecessárias. */
const pct = (v: number) => (Number.isFinite(v) ? String(Math.round(v * 100) / 100).replace(".", ",") : "—");

/**
 * `proposta`: ao registrar a venda de uma proposta, o formulário já vem
 * preenchido e, ao salvar, a proposta passa a "fechada" apontando para o
 * lançamento criado.
 */
export function FormLancamento({ inicial, proposta }: { inicial?: Lancamento; proposta?: Proposta }) {
  const router = useRouter();
  const { lancamentos, config, recarregar } = useDados();

  const [tipo, setTipo] = useState<Tipo>(inicial?.tipo ?? "receita");
  const [categoria, setCategoria] = useState<Categoria>(inicial?.categoria ?? COMISSAO);
  const [valor, setValor] = useState(paraCampo(inicial?.valor));
  const [data, setData] = useState(inicial?.data ?? hojeISO());
  const [origem, setOrigem] = useState<Origem | "">(inicial?.origem_recurso ?? "");
  const [itemCusto, setItemCusto] = useState(inicial?.item_custo ?? "");
  const [descricao, setDescricao] = useState(inicial?.descricao ?? "");
  const [corretor, setCorretor] = useState(inicial?.corretor ?? proposta?.corretor ?? "");
  const [cliente, setCliente] = useState(inicial?.cliente ?? proposta?.cliente ?? "");
  const [produto, setProduto] = useState(inicial?.produto ?? proposta?.produto ?? "");
  const [cidade, setCidade] = useState(inicial?.cidade ?? proposta?.cidade ?? "");
  const [socio, setSocio] = useState(inicial?.socio ?? "");

  // Calculadora de comissão: VGV + percentuais (padrão das configurações)
  const [vgv, setVgv] = useState(paraCampo(inicial?.vgv ?? proposta?.vgv));
  const [comissaoPct, setComissaoPct] = useState(pct(inicial?.comissao_percent ?? config.comissao_percent));
  const [splitPct, setSplitPct] = useState(pct(inicial?.split_empresa_percent ?? config.split_empresa_percent));
  const [impostoPct, setImpostoPct] = useState(pct(inicial?.imposto_nf_percent ?? config.imposto_nf_percent));

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
      item_custo: valoresUsados(lancamentos, "item_custo"),
    }),
    [lancamentos],
  );

  const ehDespesa = tipo === "despesa";
  const ehComissao = categoria === COMISSAO;
  const ehRetirada = categoria === RETIRADA;

  const vgvNum = lerValor(vgv);
  const comissaoNum = lerValor(comissaoPct);
  const splitNum = lerValor(splitPct);
  const impostoNum = lerValor(impostoPct);
  const calculo =
    [vgvNum, comissaoNum, splitNum, impostoNum].every(Number.isFinite) && vgvNum > 0
      ? calcularComissao({ vgv: vgvNum, comissaoPercent: comissaoNum, splitPercent: splitNum, impostoPercent: impostoNum })
      : null;
  const valorFinal = ehComissao ? (calculo?.liquidoMercatto ?? Number.NaN) : lerValor(valor);

  // Percentual do split sobre o VGV, para os rótulos (ex.: 2,5%)
  const splitSobreVgv = (comissaoNum * splitNum) / 100;
  const percentuaisAlterados =
    comissaoNum !== config.comissao_percent ||
    splitNum !== config.split_empresa_percent ||
    impostoNum !== config.imposto_nf_percent;

  function trocarTipo(t: Tipo) {
    setTipo(t);
    setCategoria(CATEGORIAS[t][0]);
    setErros({});
  }

  function validar(): Erros {
    const e: Erros = {};
    if (!CATEGORIAS[tipo].includes(categoria)) e.categoria = "Escolha uma categoria.";
    if (ehComissao) {
      if (!(vgvNum > 0)) e.vgv = "Informe o VGV da venda.";
      if (!(comissaoNum > 0 && comissaoNum <= 100)) e.percentuais = "A comissão deve estar entre 0 e 100%.";
      else if (!(splitNum >= 0 && splitNum <= 100)) e.percentuais = "A parte da Mercatto deve estar entre 0 e 100%.";
      else if (!(impostoNum >= 0 && impostoNum < 100)) e.percentuais = "O imposto deve estar entre 0 e 100%.";
      else if (calculo && !(calculo.liquidoMercatto > 0)) e.vgv = "O líquido da Mercatto ficou zerado.";
    } else if (!(valorFinal > 0)) {
      e.valor = "Informe um valor maior que zero.";
    }
    if (!validaData(data)) e.data = "Data inválida.";
    if (ehDespesa && !origem) e.origem = "Escolha quem pagou: Caixa ou Cris.";
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
      origem_recurso: ehDespesa ? (origem as Origem) : null,
      item_custo: ehDespesa && !ehRetirada ? t(itemCusto) : null,
      corretor: ehComissao ? t(corretor) : null,
      cliente: ehComissao ? t(cliente) : null,
      produto: ehComissao ? t(produto) : null,
      cidade: ehComissao ? t(cidade) : null,
      socio: ehRetirada ? t(socio) : null,
      vgv: ehComissao ? vgvNum : null,
      comissao_percent: ehComissao ? comissaoNum : null,
      comissao_bruta: ehComissao && calculo ? calculo.comissaoTotal : null,
      split_empresa_percent: ehComissao ? splitNum : null,
      imposto_nf_percent: ehComissao ? impostoNum : null,
      imposto_nf: ehComissao && calculo ? calculo.impostoNf : null,
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
      else {
        const id = await criarLancamento(l);
        if (proposta && l.categoria === COMISSAO) {
          await atualizarProposta(proposta.id, { status: "fechada", encerrada_em: l.data, lancamento_id: id, motivo_perda: null });
        }
      }
      await recarregar();
      if (proposta) {
        router.push("/propostas/");
      } else if (continuar) {
        // Mantém tipo, categoria, data e origem para lançar em sequência.
        setValor("");
        setVgv("");
        setDescricao("");
        setCliente("");
        setProduto("");
        setItemCusto("");
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
    opcoes: { placeholder?: string; ajuda?: string } = {},
  ) => (
    <div className="campo">
      <label htmlFor={id}>{rotulo}</label>
      <input
        id={id}
        list={`lista-${id}`}
        value={v}
        onChange={(e) => set(e.target.value)}
        autoComplete="off"
        placeholder={opcoes.placeholder}
        aria-invalid={erros[id] ? true : undefined}
        aria-describedby={erros[id] ? `${id}-erro` : undefined}
      />
      <datalist id={`lista-${id}`}>
        {sugestoes[id].map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      {opcoes.ajuda && !erros[id] && <span className="campo__ajuda">{opcoes.ajuda}</span>}
      {erros[id] && (
        <span className="campo__erro" id={`${id}-erro`}>
          {erros[id]}
        </span>
      )}
    </div>
  );

  const linhaCalculo = (rotulo: string, v: number | undefined, estilo?: "desconto") => (
    <tr>
      <td>{rotulo}</td>
      <td className={`num ${estilo === "desconto" ? "neg" : ""}`}>
        {v === undefined ? "—" : estilo === "desconto" ? `−${moeda(v)}` : moeda(v)}
      </td>
    </tr>
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

      {ehDespesa && (
        <fieldset className="campo">
          <legend>Quem pagou</legend>
          <div className="segmentos">
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
          {erros.origem ? (
            <span className="campo__erro">{erros.origem}</span>
          ) : (
            origem === "Cris" && <span className="campo__ajuda">Pago pela Cris: não sai do caixa da empresa.</span>
          )}
        </fieldset>
      )}

      {ehDespesa &&
        !ehRetirada &&
        campoTexto("item_custo", "Qual custo", itemCusto, setItemCusto, {
          placeholder: "Ex.: aluguel, contador, energia",
          ajuda: "Detalha a categoria. Use sempre o mesmo nome para o mesmo custo.",
        })}

      {ehComissao && (
        <div className="calculadora">
          <div className="calculadora__titulo">Calculadora de comissão</div>

          <div className="campo">
            <label htmlFor="vgv">VGV da venda (R$)</label>
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
              <span className="campo__ajuda">Valor Geral de Venda do imóvel.</span>
            )}
          </div>

          <div className="calculo" aria-live="polite">
            <table className="tabela">
              <tbody>
                {linhaCalculo(`Comissão total (${pct(comissaoNum)}%)`, calculo?.comissaoTotal)}
                {linhaCalculo(`Split corretor (${pct(comissaoNum - splitSobreVgv)}%)`, calculo?.splitCorretor)}
                {linhaCalculo(`Split Mercatto (${pct(splitSobreVgv)}%)`, calculo?.splitMercatto)}
                {linhaCalculo(`Imposto sobre NF (${pct(impostoNum)}% do split Mercatto)`, calculo?.impostoNf, "desconto")}
              </tbody>
              <tfoot>{linhaCalculo("Líquido Mercatto", calculo?.liquidoMercatto)}</tfoot>
            </table>
            <p className="campo__ajuda" style={{ margin: "8px 0 0" }}>
              O líquido da Mercatto é o valor registrado como receita.
            </p>
          </div>

          <details className="campo--largo" open={percentuaisAlterados || !!erros.percentuais}>
            <summary className="link" style={{ fontSize: 14 }}>
              Ajustar percentuais desta venda
            </summary>
            <div className="form" style={{ marginTop: 12 }}>
              <div className="campo">
                <label htmlFor="comissaoPct">Comissão total (% do VGV)</label>
                <input id="comissaoPct" className="num" inputMode="decimal" value={comissaoPct} onChange={(e) => setComissaoPct(e.target.value)} />
              </div>
              <div className="campo">
                <label htmlFor="splitPct">Parte da Mercatto (% da comissão)</label>
                <input id="splitPct" className="num" inputMode="decimal" value={splitPct} onChange={(e) => setSplitPct(e.target.value)} />
              </div>
              <div className="campo">
                <label htmlFor="impostoPct">Imposto sobre NF (% do split)</label>
                <input id="impostoPct" className="num" inputMode="decimal" value={impostoPct} onChange={(e) => setImpostoPct(e.target.value)} />
              </div>
            </div>
            {erros.percentuais && <p className="campo__erro">{erros.percentuais}</p>}
            <p className="campo__ajuda" style={{ margin: "8px 0 0" }}>
              Padrão das configurações: comissão de {pct(config.comissao_percent)}% do VGV,{" "}
              {pct(config.split_empresa_percent)}% dela para a Mercatto e {pct(config.imposto_nf_percent)}% de imposto sobre a NF.
            </p>
          </details>
        </div>
      )}

      {!ehComissao && (
        <div className="campo">
          <label htmlFor="valor">Valor (R$)</label>
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
          {campoTexto("cidade", "Cidade", cidade, setCidade, { placeholder: "Balneário Camboriú, Itajaí…" })}
        </>
      )}

      {ehRetirada && campoTexto("socio", "Sócio", socio, setSocio)}

      <div className="campo campo--largo">
        <label htmlFor="descricao">Observação (opcional)</label>
        <textarea id="descricao" rows={2} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
      </div>

      <div className="form__rodape">
        <button className="btn btn--primario" type="submit" value="salvar" disabled={salvando}>
          {salvando ? "Salvando…" : inicial ? "Salvar alterações" : proposta ? "Salvar venda e fechar proposta" : "Salvar lançamento"}
        </button>
        {!inicial && !proposta && (
          <button className="btn" type="submit" value="continuar" disabled={salvando}>
            Salvar e lançar outro
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
        <p className="aviso aviso--erro campo--largo" role="alert">
          {falha}
        </p>
      )}
    </form>
  );
}
