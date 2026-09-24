"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { EmailOtpType } from "@supabase/supabase-js";
import { Acesso } from "@/components/Acesso";
import { destinoDaSessao, supabase, urlDoSite } from "@/lib/supabase/cliente";

// ─── Esqueci a senha ────────────────────────────────────────────────────

export function EsqueciSenha() {
  const [email, setEmail] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function enviar(ev: FormEvent) {
    ev.preventDefault();
    setErro("");
    setEnviando(true);
    const { error } = await supabase().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: urlDoSite("/auth/definir-senha/"),
    });
    setEnviando(false);
    // Não revela se o e-mail existe; só mostra erro de limite/rede.
    if (error && /rate limit|fetch/i.test(error.message)) return setErro("Não foi possível enviar agora. Tente em alguns minutos.");
    setEnviado(true);
  }

  return (
    <Acesso titulo="Redefinir senha" texto="Enviaremos um link para o e-mail cadastrado.">
      {enviado ? (
        <>
          <p className="aviso aviso--ok">Se esse e-mail tiver acesso, o link chega em instantes. Confira também o spam.</p>
          <p>
            <Link className="link" href="/login/">
              Voltar ao login
            </Link>
          </p>
        </>
      ) : (
        <form className="form form--estreito" onSubmit={enviar}>
          <div className="campo">
            <label htmlFor="email">E-mail</label>
            <input id="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          {erro && (
            <p className="aviso aviso--erro" role="alert" style={{ margin: 0 }}>
              {erro}
            </p>
          )}
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <button className="btn btn--primario" type="submit" disabled={enviando}>
              {enviando ? "Enviando…" : "Enviar link"}
            </button>
            <Link className="link" href="/login/" style={{ fontSize: 14 }}>
              Voltar
            </Link>
          </div>
        </form>
      )}
    </Acesso>
  );
}

// ─── Link do e-mail (convite / recuperação) ─────────────────────────────

const TIPOS_OTP: EmailOtpType[] = ["invite", "recovery", "email", "signup", "magiclink", "email_change"];

export function ConfirmarLink() {
  const router = useRouter();
  const params = useSearchParams();
  const [erro, setErro] = useState("");
  const feito = useRef(false);

  useEffect(() => {
    if (feito.current) return; // o token só pode ser usado uma vez
    feito.current = true;
    const tokenHash = params.get("token_hash");
    const tipo = params.get("type") as EmailOtpType | null;
    if (!tokenHash || !tipo || !TIPOS_OTP.includes(tipo)) {
      setErro("Link incompleto. Abra o link direto do e-mail.");
      return;
    }
    (async () => {
      const { error } = await supabase().auth.verifyOtp({ token_hash: tokenHash, type: tipo });
      if (error) {
        setErro(/expired|invalid/i.test(error.message) ? "Este link expirou ou já foi usado." : error.message);
        return;
      }
      router.replace(tipo === "invite" || tipo === "recovery" ? "/auth/definir-senha/" : "/");
    })();
  }, [params, router]);

  return (
    <Acesso titulo={erro ? "Link inválido" : "Validando o link…"}>
      {erro ? (
        <>
          <p className="aviso aviso--erro">{erro}</p>
          <p style={{ display: "flex", gap: 16 }}>
            <Link className="link" href="/esqueci-senha/">
              Pedir um novo link
            </Link>
            <Link className="link" href="/login/">
              Ir ao login
            </Link>
          </p>
        </>
      ) : (
        <p className="muted">Um instante.</p>
      )}
    </Acesso>
  );
}

// ─── Definir senha ──────────────────────────────────────────────────────

export const SENHA_MINIMA = 10;

export function DefinirSenha() {
  const router = useRouter();
  const [pronto, setPronto] = useState(false);
  const [semSessao, setSemSessao] = useState(false);
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [repetir, setRepetir] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    (async () => {
      const sb = supabase();
      const { data } = await sb.auth.getSession();
      if (!data.session) return setSemSessao(true);
      setEmail(data.session.user.email ?? "");
      // Quem já tem autenticador (recuperação de senha) precisa do código antes.
      const { data: aal } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
        return router.replace(`/mfa/?volta=${encodeURIComponent("/auth/definir-senha/")}`);
      }
      setPronto(true);
    })().catch((e) => setErro(String(e)));
  }, [router]);

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    setErro("");
    if (senha.length < SENHA_MINIMA) return setErro(`Use pelo menos ${SENHA_MINIMA} caracteres.`);
    if (senha !== repetir) return setErro("As senhas não conferem.");
    setSalvando(true);
    const { error } = await supabase().auth.updateUser({ password: senha });
    setSalvando(false);
    if (error) {
      return setErro(
        /same|different/i.test(error.message)
          ? "A nova senha precisa ser diferente da anterior."
          : /weak|pwned|leaked/i.test(error.message)
            ? "Senha fraca ou conhecida em vazamentos. Escolha outra."
            : error.message,
      );
    }
    const destino = await destinoDaSessao();
    router.replace(destino ?? "/");
  }

  if (semSessao) {
    return (
      <Acesso titulo="Link expirado" texto="Não encontramos uma sessão válida. Peça um novo link.">
        <Link className="link" href="/esqueci-senha/">
          Pedir novo link
        </Link>
      </Acesso>
    );
  }

  return (
    <Acesso titulo="Defina sua senha" texto={email ? `Conta: ${email}` : undefined}>
      {pronto ? (
        <form className="form form--estreito" onSubmit={salvar}>
          <input type="email" autoComplete="username" value={email} readOnly hidden />
          <div className="campo">
            <label htmlFor="nova">Nova senha</label>
            <input id="nova" type="password" autoComplete="new-password" value={senha} onChange={(e) => setSenha(e.target.value)} />
            <span className="campo__ajuda">Mínimo de {SENHA_MINIMA} caracteres. Uma frase longa é ótima.</span>
          </div>
          <div className="campo">
            <label htmlFor="repetir">Repita a senha</label>
            <input id="repetir" type="password" autoComplete="new-password" value={repetir} onChange={(e) => setRepetir(e.target.value)} />
          </div>
          {erro && (
            <p className="aviso aviso--erro" role="alert" style={{ margin: 0 }}>
              {erro}
            </p>
          )}
          <button className="btn btn--primario" type="submit" disabled={salvando}>
            {salvando ? "Salvando…" : "Salvar e continuar"}
          </button>
        </form>
      ) : erro ? (
        <p className="aviso aviso--erro">{erro}</p>
      ) : (
        <p className="muted">Um instante.</p>
      )}
    </Acesso>
  );
}
