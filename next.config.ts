import type { NextConfig } from "next";

/**
 * O sistema é publicado no GitHub Pages, que serve apenas arquivos estáticos.
 * Por isso todo o app roda no navegador: autenticação e dados vão direto ao
 * Supabase, e a segurança está no banco (RLS exigindo sessão com MFA).
 *
 * O build de publicação roda com STATIC_EXPORT=true e liga:
 *
 * - `output: "export"`      gera HTML estático em /out
 * - `basePath`              o site vive em /<repo>, não na raiz do domínio
 *
 * `trailingSlash` e `images.unoptimized` ficam ligados sempre, para o
 * ambiente local se comportar igual ao publicado.
 */
const isStaticExport = process.env.STATIC_EXPORT === "true";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  trailingSlash: true,
  images: { unoptimized: true },
  ...(basePath ? { basePath } : {}),
  ...(isStaticExport ? { output: "export" as const } : {}),
};

export default nextConfig;
