/**
 * Validação ponta a ponta do Gotenberg (fatia #36) — chama `htmlToPdf` contra o
 * container local. OPCIONAL: só roda com o serviço no ar e `GOTENBERG_URL` setada.
 *
 *   docker compose up -d gotenberg
 *   GOTENBERG_URL=http://localhost:3001 npm run test:integration -- pdf/gotenberg
 *
 * Sem a env, a suíte é pulada (não gateia CI enquanto o serviço não roda no pipeline).
 */
import type postgres from "postgres";

// O repositório consultado abaixo abre a própria conexão via `getDatabaseUrl()`.
// Sem este mock ele apontaria para a `DATABASE_URL` do ambiente (dev/homolog) em
// vez do banco efêmero de teste — mesma convenção das demais suítes.
jest.mock("@/shared/db/env", () => ({
  getDatabaseUrl: () => process.env.INTEGRATION_APP_RUNTIME_URL,
}));

import { htmlToPdf } from "@/shared/integrations/pdf/gotenberg";
import { buildPgrHtml } from "@/shared/domains/pgr/pgr-pdf-template";

const RUN =
  Boolean(process.env.GOTENBERG_URL) &&
  Boolean(process.env.INTEGRATION_APP_RUNTIME_URL) &&
  Boolean(process.env.INTEGRATION_DATABASE_URL);
const describeMaybe = RUN ? describe : describe.skip;

let admin: ReturnType<typeof postgres>;
let getPgrConsolidated: typeof import("@/shared/db/repositories/pgr-consolidated").getPgrConsolidated;
let PGR_IDS: typeof import("../_helpers/pgr-seed").PGR_IDS;

function expectPdf(pdf: Buffer): void {
  expect(Buffer.isBuffer(pdf)).toBe(true);
  expect(pdf.byteLength).toBeGreaterThan(0);
  expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
}

describeMaybe("Gotenberg HTML→PDF (serviço local)", () => {
  beforeAll(async () => {
    const [dbHelpers, seedHelpers, repo] = await Promise.all([
      import("../_helpers/db"),
      import("../_helpers/pgr-seed"),
      import("@/shared/db/repositories/pgr-consolidated"),
    ]);

    admin = dbHelpers.adminClient();
    await dbHelpers.applyMigrations(admin);
    await seedHelpers.seedPgrBase(admin);
    PGR_IDS = seedHelpers.PGR_IDS;
    getPgrConsolidated = repo.getPgrConsolidated;
  });

  afterAll(async () => {
    await admin.end({ timeout: 5 });
  });

  it("converte HTML em um PDF válido (assinatura %PDF)", async () => {
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
      <title>Smoke</title></head><body><h1>SST Manager — smoke test</h1>
      <p>Documento gerado pelo Gotenberg.</p></body></html>`;
    expectPdf(await htmlToPdf(html));
  }, 30_000);

  it("gera o PDF do PGR (#40) a partir do template real", async () => {
    const data = await getPgrConsolidated("org_a", PGR_IDS.pgrA);
    expect(data).not.toBeNull();
    if (!data) return;

    const html = buildPgrHtml(data, {
      generatedAt: "2026-07-19",
      formHeader: { code: "FRM-001", revision: "02", date: "2026-07-19" },
    });
    expectPdf(await htmlToPdf(html));
  }, 30_000);
});
