import { test, expect, type APIRequestContext } from "@playwright/test";

/**
 * E2E público de `/signature-requests/[token]` (Fase 06 / US3) — **sem Clerk**. Cunha um token
 * real emitindo a assinatura de uma OS via API (bypass DEV, só cabeçalhos de teste) e dirige a
 * página pública no navegador. Não registra o token em screenshot/nome/log; usa dados efêmeros.
 * Cenários de token expirado/usado/replay são cobertos na suíte de integração
 * `safety/service-order-signature` (estado derivado do banco).
 */
const DEV = {
  "x-dev-tenant": "org_a",
  "x-dev-role": "owner",
  "content-type": "application/json",
};
const EMPLOYEE_A = "11111111-1111-1111-1111-1111111111a4";

/** Emite uma OS assinável e devolve o token público (último segmento do publicUrl). */
async function mintSignatureToken(request: APIRequestContext): Promise<string> {
  const so = await request.post("/api/v1/service-orders", {
    headers: DEV,
    data: {
      title: "OS E2E assinatura",
      openedAt: "2026-07-15",
      assignedEmployeeId: EMPLOYEE_A,
      items: [{ description: "Item E2E" }],
    },
  });
  expect(so.status()).toBe(201);
  const soId = (await so.json()).id as string;

  const sig = await request.post(`/api/v1/service-orders/${soId}/signature`, {
    headers: DEV,
    data: {},
  });
  expect(sig.status()).toBe(201);
  const publicUrl = (await sig.json()).publicUrl as string;
  const token = publicUrl.split("/").filter(Boolean).pop();
  expect(token, "token derivado do publicUrl").toBeTruthy();
  return token as string;
}

test.describe("Assinatura pública da OS (sem Clerk)", () => {
  test("token válido abre a página de assinatura sem login", async ({
    page,
    request,
  }) => {
    const token = await mintSignatureToken(request);
    await page.goto(`/signature-requests/${token}`);
    // Rota pública: não redireciona para o Clerk.
    await expect(page).toHaveURL(/\/signature-requests\//);
    await expect(page.getByText("Link inválido")).toHaveCount(0);
    // O formulário de assinatura (canvas + ação) é renderizado.
    await expect(page.locator("canvas, form")).not.toHaveCount(0);
  });

  test("token inválido mostra 'Link inválido' (sem vazar nada)", async ({ page }) => {
    await page.goto("/signature-requests/token-inexistente-000");
    await expect(page.getByText("Link inválido")).toBeVisible();
  });

  test("resposta não é cacheável e não referencia /assinar", async ({
    page,
    request,
  }) => {
    const token = await mintSignatureToken(request);
    const response = await page.goto(`/signature-requests/${token}`);
    // Estado da assinatura nunca deve ser cacheado (proxy: no-cache, must-revalidate).
    const cache = response?.headers()["cache-control"] ?? "";
    expect(cache).toMatch(/no-cache|no-store/);
    // A rota pública correta é /signature-requests/[token] — nunca /assinar (infra antiga de EPI).
    const html = await page.content();
    expect(html).not.toContain("/assinar");
  });
});
