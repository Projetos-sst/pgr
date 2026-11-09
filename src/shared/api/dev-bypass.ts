/**
 * Predicado único do bypass dev da REST API (`/api/v1` sem sessão Clerk), usado pelo
 * `proxy.ts` (rota pública) e pelo `restHandler` (contexto vindo dos headers `x-dev-*`).
 *
 * Falha fechada: só liga com `APP_ENV` **definido** (não vazio) e diferente de
 * `production` (sem diferenciar maiúsculas), e com `DEV_API_AUTH_BYPASS === "true"`.
 * `APP_ENV` ausente ou vazio → desligado, para um deploy que esqueceu a variável não
 * abrir a API. Sem `server-only`: o `proxy.ts` também importa.
 */
export function isDevAuthBypassEnabledFor(env: {
  APP_ENV?: string;
  DEV_API_AUTH_BYPASS?: string;
}): boolean {
  const appEnv = env.APP_ENV?.trim().toLowerCase() ?? "";
  if (appEnv === "" || appEnv === "production") return false;
  return env.DEV_API_AUTH_BYPASS === "true";
}

/** O mesmo predicado sobre o `process.env` atual. */
export function isDevAuthBypassEnabled(): boolean {
  return isDevAuthBypassEnabledFor({
    APP_ENV: process.env.APP_ENV,
    DEV_API_AUTH_BYPASS: process.env.DEV_API_AUTH_BYPASS,
  });
}
