/**
 * URL pública canônica do site, para `metadataBase`, `robots.txt` e `sitemap.xml`.
 *
 * Vem de `NEXT_PUBLIC_APP_URL` — a mesma variável que o link de assinatura
 * pública e o Stripe já usam, para não existir uma segunda noção de "endereço do
 * site". Sem a variável definida, devolve `null`: a aplicação continua
 * funcionando com URLs relativas e o sitemap sai vazio, em vez de publicar um
 * domínio inventado. A dependência está registrada em `PORTAL-AUDIT.md`.
 */
export function getSiteUrl(): URL | null {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!raw) return null;
  try {
    return new URL(raw.replace(/\/$/, ""));
  } catch {
    return null;
  }
}

/** Ambiente em que o site pode ser indexado por buscadores. */
export function isIndexable(): boolean {
  return process.env.APP_ENV === "production";
}
