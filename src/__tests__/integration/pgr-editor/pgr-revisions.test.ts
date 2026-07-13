/**
 * Integração das Server Actions de revisões do PGR contra Postgres efêmero.
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
import { ForbiddenError } from "@/shared/auth/errors";
import {
  listPgrRevisionsAction,
  createPgrRevisionAction,
} from "@/shared/server/actions/pgr/pgr-revisions";
import type { PgrRevisionInput } from "@/shared/domains/pgr/pgr-revision";

import { adminClient, applyMigrations } from "../_helpers/db";
import { seedPgrBase, PGR_IDS } from "../_helpers/pgr-seed";

const APP_RUNTIME_URL = process.env.INTEGRATION_APP_RUNTIME_URL;
const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!APP_RUNTIME_URL && !!ADMIN_URL;

const mockedGate = requireOfficeStaff as jest.MockedFunction<typeof requireOfficeStaff>;
function asOwner(tenantId: string) {
  mockedGate.mockResolvedValue({ userId: "u", tenantId, plan: "free", role: "owner" });
}

function rev(overrides: Partial<PgrRevisionInput> = {}): PgrRevisionInput {
  return { revisionNumber: 2, revisedAt: "2026-07-12", ...overrides };
}

(shouldRun ? describe : describe.skip)("Server Actions — pgr_revisions", () => {
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
    asOwner("org_a");
  });

  it("list retorna as revisões do PGR (seed = 1: nº 1)", async () => {
    const result = await listPgrRevisionsAction(PGR_IDS.pgrA);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(1);
      expect(result.data[0].revisionNumber).toBe(1);
    }
  });

  it("create nova revisão (append-only) persiste número/data/notas", async () => {
    const created = await createPgrRevisionAction(
      PGR_IDS.pgrA,
      rev({ revisionNumber: 2, notes: "Revisão anual" }),
    );
    expect(created.ok).toBe(true);
    if (created.ok) {
      expect(created.data.revisionNumber).toBe(2);
      expect(created.data.notes).toBe("Revisão anual");
    }
  });

  it("create com número repetido → DUPLICATE (UNIQUE)", async () => {
    const result = await createPgrRevisionAction(
      PGR_IDS.pgrA,
      rev({ revisionNumber: 1 }),
    );
    expect(!result.ok && result.error.code).toBe("DUPLICATE");
  });

  it("validação (revisionNumber < 1) → VALIDATION", async () => {
    const result = await createPgrRevisionAction(
      PGR_IDS.pgrA,
      rev({ revisionNumber: 0 }),
    );
    expect(!result.ok && result.error.code).toBe("VALIDATION");
  });

  it("PGR inexistente/cross-tenant → NOT_FOUND (list/create)", async () => {
    const list = await listPgrRevisionsAction(PGR_IDS.pgrB);
    expect(!list.ok && list.error.code).toBe("NOT_FOUND");
    const create = await createPgrRevisionAction(PGR_IDS.pgrB, rev());
    expect(!create.ok && create.error.code).toBe("NOT_FOUND");
  });

  it("papel client → FORBIDDEN", async () => {
    mockedGate.mockReset();
    mockedGate.mockRejectedValue(new ForbiddenError());
    const result = await createPgrRevisionAction(PGR_IDS.pgrA, rev());
    expect(!result.ok && result.error.code).toBe("FORBIDDEN");
  });
});
