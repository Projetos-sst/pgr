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
  archivePgrRevisionAction,
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
  return { revisedAt: "2026-07-12", ...overrides };
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
    // 2º PGR em org_a, fora do seed base (que mantém 1 pgr/tenant p/ os testes de
    // isolamento): usado para provar que o lock de numeração é POR PGR, não global.
    await admin`
      insert into public.pgr (id, org_id, company_id, work_unit_id)
      values (${PGR_IDS.pgrA2}, 'org_a', ${PGR_IDS.companyA}, ${PGR_IDS.workUnitA})
    `;
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

  it("create calcula o número no servidor (seed tem nº 1 → próxima = 2)", async () => {
    const created = await createPgrRevisionAction(
      PGR_IDS.pgrA,
      rev({ notes: "Revisão anual" }),
    );
    expect(created.ok).toBe(true);
    if (created.ok) {
      expect(created.data.revisionNumber).toBe(2);
      expect(created.data.notes).toBe("Revisão anual");
    }
  });

  it("primeira revisão de um PGR sem histórico → nº 1", async () => {
    // pgrA2 não tem revisão no seed.
    const created = await createPgrRevisionAction(PGR_IDS.pgrA2, rev());
    expect(created.ok && created.data.revisionNumber).toBe(1);
  });

  it("revisionNumber enviado pelo cliente → VALIDATION (schema estrito)", async () => {
    const result = await createPgrRevisionAction(PGR_IDS.pgrA, {
      revisedAt: "2026-07-12",
      // @ts-expect-error — campo proibido no input; deve ser rejeitado, não ignorado.
      revisionNumber: 99,
    });
    expect(!result.ok && result.error.code).toBe("VALIDATION");
  });

  it("concorrência no MESMO PGR → ambas criadas, números consecutivos (nenhuma perdida)", async () => {
    const [a, b] = await Promise.all([
      createPgrRevisionAction(PGR_IDS.pgrA2, rev()),
      createPgrRevisionAction(PGR_IDS.pgrA2, rev()),
    ]);
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) {
      const nums = [a.data.revisionNumber, b.data.revisionNumber].sort();
      expect(nums).toEqual([1, 2]);
    }
    const list = await listPgrRevisionsAction(PGR_IDS.pgrA2);
    expect(list.ok && list.data).toHaveLength(2);
  });

  it("concorrência em PGRs diferentes (mesmo tenant) → sem lock global", async () => {
    const [a, b] = await Promise.all([
      createPgrRevisionAction(PGR_IDS.pgrA, rev()), // seed nº 1 → 2
      createPgrRevisionAction(PGR_IDS.pgrA2, rev()), // sem histórico → 1
    ]);
    expect(a.ok && a.data.revisionNumber).toBe(2);
    expect(b.ok && b.data.revisionNumber).toBe(1);
  });

  it("UNIQUE continua ativa: número duplicado inserido fora do fluxo → 23505", async () => {
    await expect(
      admin`insert into public.pgr_revisions (org_id, pgr_id, revision_number)
            values ('org_a', ${PGR_IDS.pgrA}, 1)`,
    ).rejects.toMatchObject({ code: "23505" });
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

  // ── Arquivamento (#46) ──────────────────────────────────────────────────────

  it("archive marca archivedAt (era null no seed)", async () => {
    const before = await listPgrRevisionsAction(PGR_IDS.pgrA);
    expect(before.ok && before.data[0].archivedAt).toBeNull();

    const result = await archivePgrRevisionAction(PGR_IDS.pgrA, PGR_IDS.pgrRevisionA);
    expect(result.ok).toBe(true);
    expect(result.ok && result.data.archivedAt).not.toBeNull();

    const after = await listPgrRevisionsAction(PGR_IDS.pgrA);
    expect(after.ok && after.data[0].archivedAt).not.toBeNull();
  });

  it("archive é idempotente: repetir não muda o timestamp original", async () => {
    const first = await archivePgrRevisionAction(PGR_IDS.pgrA, PGR_IDS.pgrRevisionA);
    expect(first.ok).toBe(true);
    const firstTimestamp = first.ok ? first.data.archivedAt : null;

    const second = await archivePgrRevisionAction(PGR_IDS.pgrA, PGR_IDS.pgrRevisionA);
    expect(second.ok).toBe(true);
    expect(second.ok && second.data.archivedAt?.getTime()).toBe(
      firstTimestamp?.getTime(),
    );
  });

  it("archive de revisão inexistente/cross-tenant → NOT_FOUND", async () => {
    const missing = await archivePgrRevisionAction(
      PGR_IDS.pgrA,
      "99999999-9999-9999-9999-999999999999",
    );
    expect(!missing.ok && missing.error.code).toBe("NOT_FOUND");

    // pgrRevisionB pertence a org_b; sessão está como org_a.
    const crossTenant = await archivePgrRevisionAction(
      PGR_IDS.pgrA,
      PGR_IDS.pgrRevisionB,
    );
    expect(!crossTenant.ok && crossTenant.error.code).toBe("NOT_FOUND");
  });
});
