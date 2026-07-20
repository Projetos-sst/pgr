/**
 * Customização visual dos componentes embutidos do Clerk (SignIn/SignUp/
 * CreateOrganization/OrganizationList) via a prop `appearance`. Consome os tokens
 * de `globals.css` por `var(--…)` — nenhum hex cru aqui (C-TOK-1). Não
 * reimplementa autenticação: só ajusta cor/fonte/raio da superfície do Clerk.
 */
export const clerkAppearance = {
  variables: {
    colorPrimary: "var(--color-primary)",
    colorText: "var(--color-text)",
    colorTextSecondary: "var(--color-text-muted)",
    colorBackground: "var(--color-surface)",
    borderRadius: "12px",
    fontFamily: "var(--font-sans)",
  },
  elements: {
    rootBox: "w-full",
    cardBox: "shadow-none border-0",
    card: "bg-transparent shadow-none",
    formButtonPrimary: "btn-primary rounded-pill normal-case",
    footerActionLink: "text-primary-strong",
  },
};
