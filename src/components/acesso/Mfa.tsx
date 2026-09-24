"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Acesso } from "@/components/Acesso";
import { caminhoDeVolta, supabase } from "@/lib/supabase/cliente";

function CampoCodigo({ valor, onChange }: { valor: string; onChange: (v: string) => void }) {
  return (
    <div className="campo">
      <label htmlFor="codigo">Código de 6 dígitos</label>
      <input
        id="codigo"
        className="codigo-otp"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]{6}"
        maxLength={6}
        autoFocus
        value={valor}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
      />
    </div>
  );
}

function BotaoSair() {
  const router = useRouter();
  return (
    <button
      type="button"
      className="btn btn--fantasma"
      onClick={async () => {
        await supabase().auth.signOut();
        router.replace("/login/");
      }}
    >
      Sair
    </button>
  );
}

// ─── Verificar (já tem autenticador) ────────────────────────────────────

export function VerificarMfa() {
  const router = useRouter();
  const volta = caminhoDeVolta(useSearchParams().get("volta"));
  const [fatorId, setFatorId] = useState("");
  const [codigo, setCodigo] = useState("");
  const [erro, setErro] = useState("");
  const [verificando, setVerificando] = useState(false);

  useEffect(() => {
    (async () => {
      const sb = supabase();
      const { data: s } = await sb.auth.getSession();
      if (!s.session) return router.replace("/login/");
      const { data: aal } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal?.currentLevel === "aal2") return router.replace(volta);
      const { data, error } = await sb.auth.mfa.listFactors();
      if (error) return setErro(error.message);
      const totp = data.totp[0];
      if (!totp) return router.replace(`/mfa/configurar/?volta=${encodeURIComponent(volta)}`);
      setFatorId(totp.id);
    })().catch((e) => setErro(String(e)));
  }, [router, volta]);

  async function verificar(ev: FormEvent) {
    ev.preventDefault();
    if (codigo.length !== 6 || !fatorId) return;
    setErro("");
    setVerificando(true);
    const { error } = await supabase().auth.mfa.challengeAndVerify({ factorId: fatorId, code: codigo });
    setVerificando(false);
    if (error) {
      setErro(/invalid|expired/i.test(error.message) ? "Código inválido ou expirado. Tente o próximo." : error.message);
      setCodigo("");
      return;
    }
    router.replace(volta);
  }

  return (
    <Acesso titulo="Código do autenticador" texto="Abra o app autenticador e digite o código de 6 dígitos da Mercatto.">
      <form className="form form--estreito" onSubmit={verificar}>
        <CampoCodigo valor={codigo} onChange={setCodigo} />
        {erro && (
          <p className="aviso aviso--erro" role="alert" style={{ margin: 0 }}>
            {erro}
          </p>
        )}
        <div style={{ display: "flex", gap: 12 }}>
          <button className="btn btn--primario" type="submit" disabled={verificando || codigo.length !== 6 || !fatorId}>
            {verificando ? "Verificando…" : "Confirmar"}
          </button>
          <BotaoSair />
        </div>
        <p className="campo__ajuda" style={{ margin: 0 }}>
          Perdeu o acesso ao autenticador? Peça a um administrador para remover seu fator em Supabase → Authentication →
          Users, e cadastre um novo no próximo login.
        </p>
      </form>
    </Acesso>
  );
}

// ─── Configurar (primeiro acesso) ───────────────────────────────────────

export function ConfigurarMfa() {
  const router = useRouter();
  const volta = caminhoDeVolta(useSearchParams().get("volta"));
  const [fator, setFator] = useState<{ id: string; qr: string; segredo: string } | null>(null);
  const [codigo, setCodigo] = useState("");
  const [erro, setErro] = useState("");
  const [verificando, setVerificando] = useState(false);
  const iniciado = useRef(false);

  useEffect(() => {
    if (iniciado.current) return; // evita cadastrar dois fatores no modo estrito do React
    iniciado.current = true;
    (async () => {
      const sb = supabase();
      const { data: s } = await sb.auth.getSession();
      if (!s.session) return router.replace("/login/");
      const { data: aal } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal?.currentLevel === "aal2") return router.replace(volta);
      if (aal?.nextLevel === "aal2") return router.replace(`/mfa/?volta=${encodeURIComponent(volta)}`);

      // Limpa tentativas anteriores não concluídas.
      const { data: fatores } = await sb.auth.mfa.listFactors();
      for (const f of fatores?.all ?? []) {
        if (f.factor_type === "totp" && f.status === "unverified") await sb.auth.mfa.unenroll({ factorId: f.id });
      }

      const { data, error } = await sb.auth.mfa.enroll({
        factorType: "totp",
        issuer: "Mercatto",
        friendlyName: `Autenticador ${new Date().toISOString().slice(0, 16)}`,
      });
      if (error) return setErro(error.message);
      setFator({ id: data.id, qr: data.totp.qr_code, segredo: data.totp.secret });
    })().catch((e) => setErro(String(e)));
  }, [router, volta]);

  async function confirmar(ev: FormEvent) {
    ev.preventDefault();
    if (!fator || codigo.length !== 6) return;
    setErro("");
    setVerificando(true);
    const { error } = await supabase().auth.mfa.challengeAndVerify({ factorId: fator.id, code: codigo });
    setVerificando(false);
    if (error) {
      setErro(/invalid|expired/i.test(error.message) ? "Código inválido. Confira o horário do celular e tente de novo." : error.message);
      setCodigo("");
      return;
    }
    router.replace(volta);
  }

  return (
    <Acesso
      titulo="Proteja sua conta"
      texto="A autenticação em dois fatores é obrigatória. Escaneie o QR code com um app autenticador (Google Authenticator, 1Password, Authy…)."
    >
      {fator ? (
        <form className="form form--estreito" onSubmit={confirmar}>
          <div>
            <div className="qr">
              <img src={fator.qr} alt="QR code para cadastrar a Mercatto no app autenticador" />
            </div>
            <p className="campo__ajuda" style={{ margin: "0 0 4px" }}>
              Sem câmera? Digite esta chave no app:
            </p>
            <p className="segredo" style={{ margin: 0 }}>
              {fator.segredo}
            </p>
          </div>
          <CampoCodigo valor={codigo} onChange={setCodigo} />
          {erro && (
            <p className="aviso aviso--erro" role="alert" style={{ margin: 0 }}>
              {erro}
            </p>
          )}
          <div style={{ display: "flex", gap: 12 }}>
            <button className="btn btn--primario" type="submit" disabled={verificando || codigo.length !== 6}>
              {verificando ? "Verificando…" : "Ativar e entrar"}
            </button>
            <BotaoSair />
          </div>
        </form>
      ) : erro ? (
        <p className="aviso aviso--erro" role="alert">
          {erro}
        </p>
      ) : (
        <p className="muted">Gerando o QR code…</p>
      )}
    </Acesso>
  );
}
