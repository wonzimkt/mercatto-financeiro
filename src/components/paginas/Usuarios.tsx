"use client";

import { useState, type FormEvent } from "react";
import { CabecalhoPagina, Secao } from "@/components/ui";
import { supabase } from "@/lib/supabase/cliente";

export function Usuarios() {
  const [email, setEmail] = useState("");
  const [estado, setEstado] = useState<{ tipo: "ok" | "erro"; msg: string } | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function convidar(ev: FormEvent) {
    ev.preventDefault();
    setEstado(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setEstado({ tipo: "erro", msg: "Informe um e-mail válido." });
      return;
    }
    setEnviando(true);
    try {
      const { data, error } = await supabase().functions.invoke("convidar-usuario", { body: { email: email.trim() } });
      if (error) {
        // FunctionsHttpError traz a resposta; tenta ler a mensagem da função.
        let msg = error.message;
        const ctx = (error as { context?: Response }).context;
        if (ctx && typeof ctx.json === "function") {
          msg = (await ctx.json().catch(() => null))?.erro ?? msg;
        }
        if (/Failed to send a request|not found|404/i.test(msg))
          msg = "A função de convite não está publicada no Supabase. Veja o README ou convide pelo painel do Supabase.";
        throw new Error(msg);
      }
      setEstado({ tipo: "ok", msg: `Convite enviado para ${data?.email ?? email}.` });
      setEmail("");
    } catch (err) {
      setEstado({ tipo: "erro", msg: err instanceof Error ? err.message : String(err) });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="pagina">
      <CabecalhoPagina
        titulo="Usuários & convites"
        descricao="Não existe cadastro público. Quem entra no sistema é convidado por aqui ou pelo painel do Supabase."
      />
      <div className="colunas">
        <Secao titulo="Convidar por e-mail">
          <form className="form form--estreito" onSubmit={convidar} noValidate>
            <div className="campo">
              <label htmlFor="email-convite">E-mail</label>
              <input
                id="email-convite"
                type="email"
                autoComplete="off"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nome@mercatto.com.br"
              />
            </div>
            <div className="form__rodape">
              <button className="btn btn--primario" type="submit" disabled={enviando}>
                {enviando ? "Enviando…" : "Enviar convite"}
              </button>
            </div>
            {estado && (
              <p className={`aviso ${estado.tipo === "ok" ? "aviso--ok" : "aviso--erro"}`} role="status" style={{ margin: 0 }}>
                {estado.msg}
              </p>
            )}
          </form>
        </Secao>
        <Secao titulo="Como funciona">
          <ol className="campo__ajuda" style={{ fontSize: 14, lineHeight: 1.7, paddingLeft: 18, margin: 0 }}>
            <li>A pessoa recebe um e-mail e define a própria senha.</li>
            <li>No primeiro acesso, o sistema exige cadastrar um app autenticador (Google Authenticator, 1Password, Authy…).</li>
            <li>A partir daí, todo login pede senha + código de 6 dígitos.</li>
            <li>
              Só e-mails listados em <code>ADMIN_EMAILS</code> (secret da função no Supabase) podem enviar convites.
            </li>
            <li>
              Para remover alguém: Supabase → Authentication → Users → excluir o usuário. Os lançamentos que ele criou
              continuam registrados.
            </li>
          </ol>
        </Secao>
      </div>
    </main>
  );
}
