import type { MetadataRoute } from "next";

import { getSiteUrl } from "@/shared/site-url";

/**
 * Sitemap do portal público. Só as três páginas de apresentação: `/orcamento` é
 * formulário (marcado `noindex` na própria página) e o resto do sistema exige
 * credencial.
 *
 * Sem `NEXT_PUBLIC_APP_URL` definido o sitemap sai **vazio** de propósito — um
 * sitemap com domínio errado é pior do que nenhum.
 */
const PATHS: { path: string; priority: number }[] = [
  { path: "/", priority: 1 },
  { path: "/seguranca-do-trabalho", priority: 0.8 },
  { path: "/medicina-do-trabalho", priority: 0.8 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const site = getSiteUrl();
  if (!site) return [];

  const lastModified = new Date();
  return PATHS.map(({ path, priority }) => ({
    url: `${site.origin}${path}`,
    lastModified,
    changeFrequency: "monthly" as const,
    priority,
  }));
}
