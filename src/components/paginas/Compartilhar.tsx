"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { CabecalhoPagina, Secao } from "@/components/ui";
import { buscarLinks, criarLink, excluirLink, revogarLink, type LinkCompartilhado } from "@/lib/dados";
import { urlDoSite } from "@/lib/supabase/cliente";

const VALIDADES = [
  { dias: 7, rotulo: "7 dias" },
  { dias: 30, rotulo: "30 dias" },
  { dias: 90, rotulo: "90 dias" },
  { dias: 0, rotulo: "Sem validade" },
];

const dataHora = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
const data = (iso: string) => new Date(iso).toLocaleDateString("pt-BR");

function situacao(l: LinkCompartilhado): { rotulo: string; classe: string; ativo: boolean } {
  if (l.revogado_em) return { rotulo: "Revogado", classe: "selo", ativo: false };
  if (l.expira_em && new Date(l.expira_em) <= new Date()) return { rotulo: "Expirado", classe: "selo", ativo: false };
  return { rotulo: "Ativo", classe: "selo selo--fechada", ativo: true };
}

export function Compartilhar() {
  const [links, setLinks] = useState<LinkCompartilhado[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [nome, setNome] = useState("");
  const [dias, setDias] = useState(30);
  const [novoLink, setNovoLink] = useState<{ nome: string; url: string } | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const carregar = useCallback(async () => {
    try {
      setLinks(await buscarLinks());
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function criar(ev: FormEvent) {
    ev.preventDefault();
    if (!nome.trim()) return setErro("Diga para quem é o link (só para você identificar).");
    setOcupado(true);
    setErro("");
    setCopiado(false);
    try {
      const expira = dias ? new Date(Date.now() + dias * 86_400_000).toISOString() : null;
      const token = await criarLink(nome, expira);
      setNovoLink({ nome: nome.trim(), url: `${urlDoSite("/compartilhado/")}#t=${token}` });
      setNome("");
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setOcupado(false);
    }
  }

  async function copiar() {
    if (!novoLink) return;
    try {
      await navigator.clipboard.writeText(novoLink.url);
      setCopiado(true);
    } catch {
      document.querySelector<HTMLInputElement>("#link-novo")?.select();
    }
  }

  async function acao(fn: () => Promise<void>) {
    setOcupado(true);
    setErro("");
    try {
      await fn();
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <main className="pagina">
      <CabecalhoPagina
        titulo="Links de visualização"
        descricao="Quem tiver o link vê a Visão geral do financeiro, somente leitura e sem login. Nomes de clientes, corretores e produtos não aparecem."
      />

      <div className="colunas">
        <Secao titulo="Criar link">
          <form className="form form--estreito" onSubmit={criar} noValidate>
            <div className="campo">
              <label htmlFor="link-nome">Para quem é</label>
              <input
                id="link-nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex.: Geyson, reunião de sócios"
                autoComplete="off"
              />
              <span className="campo__ajuda">Só para você identificar o link depois.</span>
            </div>
            <fieldset className="campo">
              <legend>Validade</legend>
              <div className="segmentos segmentos--quebra">
                {VALIDADES.map((v) => (
                  <label key={v.dias}>
                    <input type="radio" name="validade" checked={dias === v.dias} onChange={() => setDias(v.dias)} />
                    {v.rotulo}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="form__rodape">
              <button className="btn btn--primario" type="submit" disabled={ocupado}>
                {ocupado ? "Criando…" : "Criar link"}
              </button>
            </div>
          </form>
        </Secao>

        <Secao titulo="Como funciona">
          <div className="ajuda-bloco">
            <p>
              O link tem um código secreto longo e aleatório. O sistema guarda só uma “impressão digital” dele, por isso o
              link completo aparece <strong>uma única vez</strong>, logo depois de criado. Se perder, crie outro.
            </p>
            <p>
              Qualquer pessoa com o link consegue ver os números. Envie só para quem deve ver e prefira links com validade.
            </p>
            <p>
              <strong>Revogar</strong> desliga o link na hora. A lista mostra o último acesso e quantas vezes cada link foi
              aberto.
            </p>
          </div>
        </Secao>
      </div>

      {novoLink && (
        <Secao titulo={`Link criado para ${novoLink.nome}`}>
          <p className="aviso aviso--ok" style={{ marginBottom: 12 }}>
            Copie e guarde agora: por segurança, este link não aparece de novo.
          </p>
          <div className="form-linha">
            <div className="campo" style={{ flex: "1 1 360px", maxWidth: "none" }}>
              <label htmlFor="link-novo" className="sr-only">
                Link
              </label>
              <input id="link-novo" readOnly value={novoLink.url} onFocus={(e) => e.target.select()} />
            </div>
            <button className="btn btn--primario" type="button" onClick={copiar}>
              {copiado ? "✓ Copiado" : "Copiar link"}
            </button>
          </div>
        </Secao>
      )}

      {erro && (
        <p className="aviso aviso--erro" role="alert">
          {erro}
        </p>
      )}

      <Secao titulo="Links criados" nota={links.length ? `${links.filter((l) => situacao(l).ativo).length} ativos` : undefined}>
        {carregando ? (
          <p className="vazio">Carregando…</p>
        ) : links.length ? (
          <div className="tabela-wrap">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Para quem</th>
                  <th>Validade</th>
                  <th>Último acesso</th>
                  <th>Situação</th>
                  <th className="acoes">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {links.map((l) => {
                  const s = situacao(l);
                  return (
                    <tr key={l.id}>
                      <td>
                        {l.nome}
                        <span className="secundario">criado em {data(l.criado_em)}</span>
                      </td>
                      <td>{l.expira_em ? `até ${data(l.expira_em)}` : "sem validade"}</td>
                      <td>
                        {l.ultimo_acesso_em ? dataHora(l.ultimo_acesso_em) : <span className="muted">nunca aberto</span>}
                        {l.acessos > 0 && (
                          <span className="secundario">
                            {l.acessos} {l.acessos === 1 ? "acesso" : "acessos"}
                          </span>
                        )}
                      </td>
                      <td>
                        <span className={s.classe}>{s.rotulo}</span>
                      </td>
                      <td className="acoes">
                        {s.ativo ? (
                          <button
                            className="btn btn--pequeno btn--perigo"
                            disabled={ocupado}
                            onClick={() => {
                              if (confirm(`Revogar o link de ${l.nome}? Quem tiver o link perde o acesso na hora.`))
                                acao(() => revogarLink(l.id));
                            }}
                          >
                            Revogar
                          </button>
                        ) : (
                          <button
                            className="btn btn--pequeno btn--fantasma"
                            disabled={ocupado}
                            onClick={() => {
                              if (confirm(`Remover o link de ${l.nome} da lista?`)) acao(() => excluirLink(l.id));
                            }}
                          >
                            Remover
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="vazio">Nenhum link criado ainda.</p>
        )}
      </Secao>
    </main>
  );
}
