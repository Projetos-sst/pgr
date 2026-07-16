/**
 * Cota compartilhada entre `demo` e `pgr` (contador por tenant/mês, sem filtro de target_type).
 */
import type postgres from "postgres";

jest.mock("@/shared/db/env", () => ({
  getDatabaseUrl: () => process.env.INTEGRATION_APP_RUNTIME_URL,
}));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("@/shared/auth/require-office-staff", () => ({
  requireOfficeStaff: jest.fn(),
}));

import { requireOfficeStaff } from "@/shared/auth/require-office-staff";
import { createSignatureRequest } from "@/shared/server/actions/signatures";
import { createPgrSignatureRequestAction } from "@/shared/server/actions/pgr/pgr-signature";
import { FREE_SIGNATURE_MONTHLY_QUOTA } from "@/shared/tenant/plan";

import { adminClient, applyMigrations } from "../_helpers/db";
import { seedPgrBase, PGR_IDS } from "../_helpers/pgr-seed";

const APP_RUNTIME_URL = process.env.INTEGRATION_APP_RUNTIME_URL;
const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!APP_RUNTIME_URL && !!ADMIN_URL;

// Cada teste faz 10+ round-trips ao Postgres (loop de criações) — o default de 5s do Jest é
// apertado em Postgres efêmero via Docker (latência por query). 30s cobre com folga.
jest.setTimeout(30_000);

const mockedGate = requireOfficeStaff as jest.MockedFunction<typeof requireOfficeStaff>;
const asPlan = (tenantId: string, plan: "free" | "pro") =>
  mockedGate.mockResolvedValue({ userId: "u", tenantId, plan, role: "owner" });
const createDemo = () =>
  createSignatureRequest({ targetType: "demo", payload: { title: "T" } });

(shouldRun ? describe : describe.skip)("Assinatura do PGR — cota compartilhada", () => {
  let admin: ReturnType<typeof postgres>;
  beforeAll(async () => {
    admin = adminClient();
    await applyMigrations(admin);
  });
  afterAll(async () => {
    await admin.end({ timeout: 5 });
  });
  beforeEach(async () => {
    await seedPgrBase(admin);
    mockedGate.mockReset();
  });

  it("demo consome a cota do free → a solicitação de PGR seguinte é bloqueada (mesmo contador)", async () => {
    asPlan("org_a", "free");
    for (let i = 0; i < FREE_SIGNATURE_MONTHLY_QUOTA; i += 1) {
      expect((await createDemo()).ok).toBe(true);
    }
    const pgr = await createPgrSignatureRequestAction({ pgrId: PGR_IDS.pgrA });
    expect(pgr.ok).toBe(false);
    if (!pgr.ok) expect(pgr.error.code).toBe("QUOTA_EXCEEDED");
  });

  it("pro (org_b) nunca é bloqueado", async () => {
    asPlan("org_b", "pro");
    for (let i = 0; i < FREE_SIGNATURE_MONTHLY_QUOTA + 2; i += 1) {
      expect((await createDemo()).ok).toBe(true);
    }
    expect((await createPgrSignatureRequestAction({ pgrId: PGR_IDS.pgrB })).ok).toBe(
      true,
    );
  });
});
