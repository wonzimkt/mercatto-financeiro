"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cliente: SupabaseClient | null = null;

/**
 * Cliente único do Supabase no navegador. Usa só a chave pública (anon /
 * publishable): quem decide o que cada sessão pode ver é o RLS no banco.
 */
export function supabase(): SupabaseClient {
  if (cliente) return cliente;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !chave) {
    throw new Error(
      "Faltam NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY. Veja o .env.example.",
    );
  }
  cliente = createClient(url, chave, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  return cliente;
}

export type Destino = "/login/" | "/mfa/" | "/mfa/configurar/" | null;

/**
 * Para onde a sessão atual precisa ir antes de ver o painel.
 * null = sessão com senha + TOTP verificados (aal2), pode entrar.
 */
export async function destinoDaSessao(): Promise<Destino> {
  const sb = supabase();
  const { data: sessao } = await sb.auth.getSession();
  if (!sessao.session) return "/login/";

  const { data, error } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error || !data) return "/login/";
  if (data.currentLevel === "aal2") return null;
  // Já tem autenticador cadastrado: só falta o código. Senão, cadastrar.
  return data.nextLevel === "aal2" ? "/mfa/" : "/mfa/configurar/";
}

/** URL absoluta do site publicado (considera o basePath do GitHub Pages). */
export function urlDoSite(caminho: string): string {
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  return `${window.location.origin}${base}${caminho}`;
}

/** Só aceita caminhos internos em ?volta= (evita redirecionamento aberto). */
export function caminhoDeVolta(v: string | null | undefined, padrao = "/"): string {
  return v && v.startsWith("/") && !v.startsWith("//") && !v.includes("\\") ? v : padrao;
}
