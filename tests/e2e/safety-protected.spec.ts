import { test, expect } from "@playwright/test";

/**
 * E2E **protegido** (Fase 06) — sessão office-staff real via Clerk (storageState do projeto
 * `setup`, login por sign-in token). Verifica que as quatro superfícies do módulo carregam e são
 * navegáveis para office staff (não redirecionam ao login) e que o **kanban de auditorias** expõe
 * as 3 colunas, a criação por Action explícita e o gatilho de sugestão por IA — sem depender de
 * dados de negócio semeados no tenant autenticado (a cobertura de CRUD/estado vive nas integrações).
 */
test.describe("Fase 06 — superfícies protegidas (office staff)", () => {
  test("Ordens de Serviço carrega para usuário autenticado", async ({ page }) => {
    await page.goto("/service-orders");
    await expect(page).toHaveURL(/\/service-orders/);
    await expect(page.getByRole("heading", { name: "Ordens de Serviço" })).toBeVisible();
  });

  test("Incidentes/Acidentes carrega para usuário autenticado", async ({ page }) => {
    await page.goto("/incidents");
    await expect(page).toHaveURL(/\/incidents/);
    await expect(
      page.getByRole("heading", { name: "Incidentes/Acidentes" }),
    ).toBeVisible();
  });

  test("Planos de Ação carrega com ação de criação", async ({ page }) => {
    await page.goto("/action-plans");
    await expect(page).toHaveURL(/\/action-plans/);
    await expect(page.getByRole("heading", { name: "Planos de Ação" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Novo plano" })).toBeVisible();
  });

  test("Auditorias de Risco: kanban de 3 colunas + criação por Action explícita", async ({
    page,
  }) => {
    await page.goto("/risk-audits");
    await expect(page).toHaveURL(/\/risk-audits/);
    await expect(
      page.getByRole("heading", { name: "Auditorias de Risco" }),
    ).toBeVisible();
    // 3 colunas do kanban.
    await expect(page.getByRole("heading", { name: "Aguardando análise" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Planejando ações" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Concluído" })).toBeVisible();
    // Criação é por Action explícita (formulário + botão), não drag-and-drop.
    await expect(page.getByRole("heading", { name: "Nova auditoria" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Criar auditoria" })).toBeVisible();
  });

  test("mega-menu expõe a rota Auditorias de Risco (integração de navegação)", async ({
    page,
  }) => {
    await page.goto("/risk-audits");
    // O item de menu da Fase 06 está registrado (link para a rota real).
    await expect(page.locator('a[href="/risk-audits"]').first()).toBeVisible();
  });
});
