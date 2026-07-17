import { createClerkClient } from "@clerk/backend";
import { clerk, setupClerkTestingToken } from "@clerk/testing/playwright";
import { test as setup, expect } from "@playwright/test";

/**
 * Autenticação do projeto **protected**. Usa **apenas credenciais de env** (`CLERK_SECRET_KEY` +
 * `E2E_CLERK_USER_EMAIL`) para, via Backend API: (1) criar o usuário de teste se necessário e
 * (2) emitir um **sign-in token** (ticket). O login por ticket em `@clerk/testing` estabelece a
 * sessão **sem senha e sem segundo fator** (a instância exige MFA), o padrão recomendado para E2E.
 * No 1º login o app auto-provisiona o tenant pessoal (owner) no Postgres efêmero. O `storageState`
 * vai para `.auth/user.json` (gitignored) — nada de credencial/estado versionado, nenhum bypass no produto.
 */
const AUTH_FILE = ".auth/user.json";
// Credenciais **somente** por env — nada de senha/segredo versionado.
const email = process.env.E2E_CLERK_USER_EMAIL ?? "e2e+clerk_test@casaperio.com.br";
const password = process.env.E2E_CLERK_USER_PASSWORD ?? "";

setup("authenticate", async ({ page }) => {
  const secretKey = process.env.CLERK_SECRET_KEY;
  expect(secretKey, "CLERK_SECRET_KEY é obrigatória para o login de teste.").toBeTruthy();
  expect(
    password,
    "E2E_CLERK_USER_PASSWORD é obrigatória (credencial só por env; nada versionado).",
  ).not.toBe("");

  const cc = createClerkClient({ secretKey: secretKey! });
  const existing = await cc.users.getUserList({ emailAddress: [email] });
  const user =
    existing.totalCount > 0
      ? existing.data[0]
      : await cc.users.createUser({
          emailAddress: [email],
          password,
          skipPasswordChecks: true,
        });

  // A instância exige uma organização ativa (task "choose-organization"). Cria uma org de teste
  // (idempotente) com o usuário como admin → o app mapeia a org Clerk para o tenant (owner).
  const memberships = await cc.users.getOrganizationMembershipList({ userId: user.id });
  if (memberships.totalCount === 0) {
    await cc.organizations.createOrganization({
      name: "E2E SST (teste)",
      createdBy: user.id,
    });
  }

  const { token } = await cc.signInTokens.createSignInToken({
    userId: user.id,
    expiresInSeconds: 600,
  });

  await setupClerkTestingToken({ page });
  await page.goto("/sign-in");
  await clerk.loaded({ page });
  await clerk.signIn({ page, signInParams: { strategy: "ticket", ticket: token } });
  await page.waitForFunction(
    () => Boolean((window as Window & { Clerk?: { user?: unknown } }).Clerk?.user),
    null,
    {
      timeout: 20_000,
    },
  );

  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/dashboard/);
  await page.context().storageState({ path: AUTH_FILE });
});
