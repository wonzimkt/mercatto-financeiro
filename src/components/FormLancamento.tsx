"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { useDados } from "@/components/Painel";
import {
  atualizarLancamento,
  atualizarProposta,
  atualizarSerieDesde,
  criarLancamento,
  criarLancamentos,
  excluirLancamento,
  excluirSerieDesde,
} from "@/lib/dados";
import { gerarSerie, rotuloSerie } from "@/lib/financeiro/futuros";
import { calcularComissao, valoresUsados } from "@/lib/financeiro/calculos";
import { hojeISO, nomeMes, somarMesesData, validaData } from "@/lib/financeiro/datas";
import { lerValor, moeda, paraCampo } from "@/lib/financeiro/formato";
import {
  CAIXA,
  CATEGORIAS,
  COMISSAO,
  MESES_FIXO,
  RETIRADA,
  type Categoria,
  type Lancamento,
  type LancamentoEntrada,
  type Origem,
  type Proposta,
  type Recorrencia,
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
  const { lancamentos, config, pagadores, recarregar } = useDados();

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

  // Repetição (só em lançamentos novos que não são comissão)
  const [repeticao, setRepeticao] = useState<"unica" | Recorrencia>("unica");
  const [parcelas, setParcelas] = useState("2");
  // Edição de uma ocorrência de série: aplicar também às seguintes
  const [aplicarSeguintes, setAplicarSeguintes] = useState(false);

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
  const podeRepetir = !inicial && !proposta && categoria !== COMISSAO;
  const repete = podeRepetir && repeticao !== "unica";
  const nParcelas = Number(parcelas);
  const qtdOcorrencias = repeticao === "fixo" ? MESES_FIXO : nParcelas;
  const naSerie = !!inicial?.serie_id;
  const seguintes = naSerie
    ? lancamentos.filter((l) => l.serie_id === inicial!.serie_id && l.data > inicial!.data).length
    : 0;
  // Caixa primeiro, depois os aportadores ativos; mantém um inativo se já estiver neste lançamento.
  const opcoesPagador = [
    CAIXA,
    ...pagadores.filter((p) => p.nome !== CAIXA && (p.ativo || p.nome === inicial?.origem_recurso)).map((p) => p.nome),
  ];
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
    if (ehDespesa && !origem) e.origem = "Escolha quem pagou.";
    if (ehComissao) {
      if (!corretor.trim()) e.corretor = "Obrigatório em comissões.";
      if (!cliente.trim()) e.cliente = "Obrigatório em comissões.";
      if (!produto.trim()) e.produto = "Obrigatório em comissões.";
      if (!cidade.trim()) e.cidade = "Obrigatório em comissões.";
    }
    if (ehRetirada && !socio.trim()) e.socio = "Informe o sócio.";
    if (repete && repeticao === "parcelado" && !(Number.isInteger(nParcelas) && nParcelas >= 2 && nParcelas <= 120))
      e.parcelas = "Entre 2 e 120 parcelas.";
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
      // Na edição, a ocorrência continua na sua série; lançamentos novos são avulsos (a série é gerada ao salvar).
      serie_id: inicial?.serie_id ?? null,
      recorrencia: inicial?.recorrencia ?? null,
      parcela: inicial?.parcela ?? null,
      parcelas_total: inicial?.parcelas_total ?? null,
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
      let destino = l.data > hojeISO() ? "/futuros/" : "/lancamentos/";
      let resumo = `Lançamento de ${moeda(l.valor)} (${l.categoria}) registrado.`;
      if (inicial) {
        await atualizarLancamento(inicial.id, l);
        if (naSerie && aplicarSeguintes && seguintes > 0) {
          const { tipo: tp, categoria: ct, valor: vl, descricao: ds, origem_recurso: og, item_custo: it, socio: sc } = l;
          await atualizarSerieDesde(inicial.serie_id!, inicial.data, {
            tipo: tp, categoria: ct, valor: vl, descricao: ds, origem_recurso: og, item_custo: it, socio: sc,
          });
        }
      } else if (repete) {
        const serie = gerarSerie(l, repeticao as Recorrencia, qtdOcorrencias, crypto.randomUUID());
        await criarLancamentos(serie);
        destino = "/futuros/";
        resumo =
          repeticao === "fixo"
            ? `${l.item_custo || l.categoria}: ${moeda(l.valor)} por mês agendado até ${nomeMes(serie[serie.length - 1].data.slice(0, 7))}.`
            : `${serie.length} parcelas de ${moeda(l.valor)} registradas.`;
      } else {
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
        setSalvoAgora(resumo);
      } else {
        router.push(destino);
      }
    } catch (err) {
      setFalha(err instanceof Error ? err.message : String(err));
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(comSeguintes = false) {
    if (!inicial) return;
    const pergunta = comSeguintes
      ? `Excluir esta ocorrência e as ${seguintes} seguintes da série? Não dá para desfazer.`
      : `Excluir definitivamente este lançamento de ${moeda(inicial.valor)}? Não dá para desfazer.`;
    if (!confirm(pergunta)) return;
    setSalvando(true);
    try {
      if (comSeguintes) await excluirSerieDesde(inicial.serie_id!, inicial.data);
      else await excluirLancamento(inicial.id);
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
        <fieldset className="campo campo--largo">
          <legend>Quem pagou</legend>
          <div className="segmentos segmentos--quebra">
            {opcoesPagador.map((o) => (
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
            <span className="campo__ajuda">
              {origem && origem !== CAIXA
                ? `Aporte de ${origem}: conta como despesa, mas não sai do caixa da empresa.`
                : "Só o Caixa sai do caixa da empresa. Os demais contam como aporte."}
            </span>
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
          <label htmlFor="valor">{repete && repeticao === "parcelado" ? "Valor de cada parcela (R$)" : repete ? "Valor mensal (R$)" : "Valor (R$)"}</label>
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

      {podeRepetir && (
        <fieldset className="campo campo--largo">
          <legend>Repetição</legend>
          <div className="segmentos segmentos--quebra">
            {(
              [
                ["unica", "Única"],
                ["fixo", "Fixo mensal"],
                ["parcelado", "Parcelado"],
              ] as const
            ).map(([v, r]) => (
              <label key={v}>
                <input type="radio" name="repeticao" checked={repeticao === v} onChange={() => setRepeticao(v)} />
                {r}
              </label>
            ))}
          </div>
          {repeticao === "parcelado" && (
            <div className="form-linha" style={{ marginTop: 10 }}>
              <div className="campo" style={{ maxWidth: 180 }}>
                <label htmlFor="parcelas">Número de parcelas</label>
                <input
                  id="parcelas"
                  className="num"
                  inputMode="numeric"
                  value={parcelas}
                  onChange={(e) => setParcelas(e.target.value.replace(/\D/g, ""))}
                  aria-invalid={erros.parcelas ? true : undefined}
                />
              </div>
            </div>
          )}
          {erros.parcelas && <span className="campo__erro">{erros.parcelas}</span>}
          {repete && validaData(data) && (
            <span className="campo__ajuda">
              {repeticao === "fixo"
                ? `Todo mês no dia ${Number(data.slice(8, 10))}, de ${nomeMes(data.slice(0, 7), "curto")} a ${nomeMes(
                    somarMesesData(data, MESES_FIXO - 1).slice(0, 7),
                    "curto",
                  )} (${MESES_FIXO} meses). Na aba Futuros dá para estender ou encerrar.`
                : Number.isInteger(nParcelas) && nParcelas >= 2
                  ? `${nParcelas} parcelas mensais de ${nomeMes(data.slice(0, 7), "curto")} a ${nomeMes(
                      somarMesesData(data, nParcelas - 1).slice(0, 7),
                      "curto",
                    )}${lerValor(valor) > 0 ? ` · total ${moeda(lerValor(valor) * nParcelas)}` : ""}.`
                  : ""}
            </span>
          )}
        </fieldset>
      )}

      {naSerie && (
        <div className="aviso campo--largo">
          <strong>{rotuloSerie(inicial!)}</strong> · esta ocorrência faz parte de uma série.
          {seguintes > 0 && (
            <label className="caixa-selecao" style={{ display: "flex", marginTop: 8 }}>
              <input type="checkbox" checked={aplicarSeguintes} onChange={(e) => setAplicarSeguintes(e.target.checked)} />
              Aplicar as alterações também às {seguintes} {seguintes === 1 ? "ocorrência seguinte" : "ocorrências seguintes"}{" "}
              (valor, categoria, quem pagou, custo e observação; as datas não mudam)
            </label>
          )}
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
          <span style={{ marginLeft: "auto", display: "inline-flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn btn--perigo" type="button" onClick={() => excluir()} disabled={salvando}>
              {naSerie ? "Excluir esta" : "Excluir"}
            </button>
            {naSerie && seguintes > 0 && (
              <button className="btn btn--perigo" type="button" onClick={() => excluir(true)} disabled={salvando}>
                Excluir esta e as próximas
              </button>
            )}
          </span>
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
