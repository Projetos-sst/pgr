import type { MetadataRoute } from "next";

import { getSiteUrl, isIndexable } from "@/shared/site-url";

/**
 * `robots.txt` por ambiente.
 *
 * Fora de produção o site é fechado para buscadores — sandbox e preview não
 * podem ser indexados. Em produção, só o portal público é rastreável: toda a
 * área autenticada, a API e as rotas por token ficam bloqueadas (elas já exigem
 * credencial, mas não há motivo para aparecerem em índice).
 */
export default function robots(): MetadataRoute.Robots {
  const site = getSiteUrl();

  if (!isIndexable()) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/dashboard",
          "/orcamento",
          "/sign/",
          "/signature-requests/",
          "/psychosocial-response/",
        ],
      },
    ],
    ...(site ? { sitemap: `${site.origin}/sitemap.xml`, host: site.origin } : {}),
  };
}
