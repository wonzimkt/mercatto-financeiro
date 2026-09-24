"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Acesso } from "@/components/Acesso";
import { caminhoDeVolta, destinoDaSessao, supabase } from "@/lib/supabase/cliente";

export function Login() {
  const router = useRouter();
  const volta = caminhoDeVolta(useSearchParams().get("volta"));
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [entrando, setEntrando] = useState(false);

  async function seguir() {
    const destino = await destinoDaSessao();
    if (destino === null) router.replace(volta);
    else if (destino !== "/login/") router.replace(`${destino}?volta=${encodeURIComponent(volta)}`);
  }

  useEffect(() => {
    // Já logado? Segue direto.
    seguir().catch(() => {});
  }, []);

  async function entrar(ev: FormEvent) {
    ev.preventDefault();
    setErro("");
    setEntrando(true);
    try {
      const { error } = await supabase().auth.signInWithPassword({ email: email.trim(), password: senha });
      if (error) {
        setErro(
          /invalid login credentials/i.test(error.message)
            ? "E-mail ou senha incorretos."
            : /rate limit|too many/i.test(error.message)
              ? "Muitas tentativas. Aguarde alguns minutos."
              : error.message,
        );
        return;
      }
      await seguir();
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setEntrando(false);
    }
  }

  return (
    <Acesso titulo="Entrar" texto="Acesso restrito à equipe Mercatto.">
      <form className="form form--estreito" onSubmit={entrar}>
        <div className="campo">
          <label htmlFor="email">E-mail</label>
          <input id="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="campo">
          <label htmlFor="senha">Senha</label>
          <input
            id="senha"
            type="password"
            autoComplete="current-password"
            required
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
          />
        </div>
        {erro && (
          <p className="aviso aviso--erro" role="alert" style={{ margin: 0 }}>
            {erro}
          </p>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <button className="btn btn--primario" type="submit" disabled={entrando}>
            {entrando ? "Entrando…" : "Entrar"}
          </button>
          <Link className="link" href="/esqueci-senha/" style={{ fontSize: 14 }}>
            Esqueci a senha
          </Link>
        </div>
      </form>
    </Acesso>
  );
}
