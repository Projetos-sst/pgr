import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E (Fase 06). Dois projetos: **public** (rota pública de assinatura, sem Clerk) e
 * **protected** (fluxos office-staff, autenticado via `@clerk/testing` + storageState do projeto
 * `setup`). O servidor Next é reutilizado se já estiver de pé (`reuseExistingServer`) apontado ao
 * **Postgres efêmero** com o bypass DEV desligado para UI (só a API usa bypass). Credenciais só por
 * env (`E2E_CLERK_*`); storageState nunca versionado (`.auth/` no .gitignore).
 */
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

/**
 * O projeto **protected** exige um ambiente com Clerk **e** o store de associações
 * (`org_memberships`/`orgs`) que o app resolve via cliente Supabase service-role
 * (`SUPABASE_SECRET_KEY`) — separado do Postgres efêmero de dados. Fora desse ambiente ele fica
 * **desabilitado** (`E2E_PROTECTED=1` para habilitar), mantendo o run padrão (público) verde e
 * sem depender de credenciais. Nunca aponta ao banco real por padrão.
 */
const protectedEnabled = process.env.E2E_PROTECTED === "1";

const protectedProjects = [
  { name: "setup", testMatch: /auth\.setup\.ts/ },
  {
    name: "protected",
    testMatch: /safety-protected\.spec\.ts/,
    dependencies: ["setup"],
    use: {
      ...devices["Desktop Chrome"],
      storageState: ".auth/user.json",
    },
  },
];

export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: protectedEnabled ? "./tests/e2e/support/global.setup.ts" : undefined,
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  reporter: [["list"]],
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "public", testMatch: /public-.*\.spec\.ts/ },
    ...(protectedEnabled ? protectedProjects : []),
  ],
  webServer: {
    command: "npm run dev",
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
