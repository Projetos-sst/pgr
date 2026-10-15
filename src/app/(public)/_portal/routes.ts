/**
 * Mapa das rotas do portal público.
 *
 * O HTML aprovado aponta para arquivos (`Main.dc.html`, `Seguranca.dc.html`…)
 * porque é um export de pranchas. Aqui eles viram as rotas reais do Next. Este
 * módulo existe para a tradução ficar num lugar só — e para `Login.dc.html`
 * apontar para o `/sign-in` do Clerk, e não para uma tela de login desenhada.
 */
export const PORTAL_ROUTES = {
  home: "/",
  seguranca: "/seguranca-do-trabalho",
  medicina: "/medicina-do-trabalho",
  orcamento: "/orcamento",
  login: "/sign-in",
} as const;

export type PortalRouteKey = keyof typeof PORTAL_ROUTES;

/** Itens da navegação principal, na ordem do design. */
export const PORTAL_NAV = [
  { href: PORTAL_ROUTES.home, label: "Início", key: "home" },
  { href: PORTAL_ROUTES.seguranca, label: "Segurança do Trabalho", key: "seguranca" },
  { href: PORTAL_ROUTES.medicina, label: "Medicina do Trabalho", key: "medicina" },
  { href: "/#funcionalidades", label: "Funcionalidades", key: "funcionalidades" },
] as const;

/** Nome da marca, como o design aprovado o escreve. */
export const BRAND_NAME = "PGR-e";
