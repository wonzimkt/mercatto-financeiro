// Edge Function: convidar-usuario
//
// Único ponto do sistema que usa a service role key — por isso ele roda no
// Supabase, e não no site estático. Quem chama precisa:
//   1. estar logado (JWT válido, conferido no próprio Auth);
//   2. ter passado pelo MFA nesta sessão (aal2);
//   3. estar na lista ADMIN_EMAILS (secret da função).
//
// Secrets (Supabase → Edge Functions → Secrets):
//   ADMIN_EMAILS   e-mails autorizados a convidar, separados por vírgula
//   SITE_URL       URL pública do painel, ex.: https://wonzimkt.github.io/mercatto-financeiro
// SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são injetados automaticamente.

import { createClient } from "npm:@supabase/supabase-js@2";

const siteUrl = (Deno.env.get("SITE_URL") ?? "").replace(/\/$/, "");
const origemPermitida = siteUrl ? new URL(siteUrl).origin : "*";

const cors = {
  "Access-Control-Allow-Origin": origemPermitida,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function resposta(status: number, corpo: Record<string, unknown>) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function lerClaims(jwt: string): Record<string, unknown> {
  const payload = jwt.split(".")[1] ?? "";
  const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
  return JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "=")));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return resposta(405, { erro: "Método não permitido." });

  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!token) return resposta(401, { erro: "Sessão ausente." });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  // getUser valida o token no servidor de Auth; só depois lemos as claims.
  const { data: quem, error: erroUsuario } = await admin.auth.getUser(token);
  if (erroUsuario || !quem.user) return resposta(401, { erro: "Sessão inválida." });

  if (lerClaims(token).aal !== "aal2") {
    return resposta(403, { erro: "Confirme o código do autenticador antes de convidar." });
  }

  const admins = (Deno.env.get("ADMIN_EMAILS") ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (!admins.includes((quem.user.email ?? "").toLowerCase())) {
    return resposta(403, { erro: "Seu usuário não tem permissão para convidar pessoas." });
  }

  let email = "";
  try {
    const corpo = await req.json();
    email = String(corpo?.email ?? "").trim().toLowerCase();
  } catch {
    return resposta(400, { erro: "Corpo da requisição inválido." });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return resposta(400, { erro: "Informe um e-mail válido." });
  }

  const { data: convite, error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: siteUrl ? `${siteUrl}/auth/definir-senha/` : undefined,
  });
  if (error) {
    const jaExiste = /already|registered|exists/i.test(error.message);
    return resposta(jaExiste ? 409 : 400, {
      erro: jaExiste ? "Esse e-mail já tem uma conta." : error.message,
    });
  }

  // Marca como membro: é isto que o RLS confere (além do MFA).
  const { error: erroMembro } = await admin.auth.admin.updateUserById(convite.user.id, {
    app_metadata: { mercatto_membro: true },
  });
  if (erroMembro) return resposta(500, { erro: `Convite enviado, mas falhou ao autorizar: ${erroMembro.message}` });

  return resposta(200, { ok: true, email });
});
