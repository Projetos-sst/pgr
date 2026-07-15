/**
 * Integração do CRUD de Permissões de Trabalho (fatia 040) contra Postgres
 * efêmero. Cobre create/get/update/delete, DUPLICATE (nº por org), CHECK de
 * validade, empresa opcional/cross-tenant e isolamento.
 */
import type postgres from "postgres";

jest.mock("@/shared/db/env", () => ({
  getDatabaseUrl: () => process.env.INTEGRATION_APP_RUNTIME_URL,
}));

import {
  createWorkPermit,
  deleteWorkPermit,
  getWorkPermit,
  listWorkPermits,
  updateWorkPermit,
} from "@/shared/db/repositories/work-permits";
import { ReferenceNotFoundError } from "@/shared/errors/reference-not-found-error";

import { adminClient, applyMigrations } from "../_helpers/db";
import { seedPgrBase } from "../_helpers/pgr-seed";

const APP_RUNTIME_URL = process.env.INTEGRATION_APP_RUNTIME_URL;
const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!APP_RUNTIME_URL && !!ADMIN_URL;

const COMPANY_A = "11111111-1111-1111-1111-111111111111";
const COMPANY_B = "22222222-2222-2222-2222-222222222222";

const base = (n: string) => ({
  number: n,
  type: "hot_work" as const,
  status: "draft" as const,
  description: "Solda em estrutura",
  validFrom: "2026-07-15",
  validUntil: "2026-07-16",
});

(shouldRun ? describe : describe.skip)("permissões de trabalho — CRUD", () => {
  let admin: ReturnType<typeof postgres>;

  beforeAll(async () => {
    admin = adminClient();
    await applyMigrations(admin);
    await seedPgrBase(admin);
  });

  afterAll(async () => {
    await admin.end();
  });

  it("cria com empresa do tenant e lê de volta", async () => {
    const { id } = await createWorkPermit("org_a", {
      ...base("PT-A-100"),
      companyId: COMPANY_A,
    });
    const found = await getWorkPermit("org_a", id);
    expect(found!.permit.number).toBe("PT-A-100");
    expect(found!.company?.id).toBe(COMPANY_A);
  });

  it("número duplicado no mesmo tenant → 23505 (DUPLICATE)", async () => {
    await createWorkPermit("org_a", base("PT-DUP"));
    await expect(createWorkPermit("org_a", base("PT-DUP"))).rejects.toBeDefined();
    // outro tenant pode reusar o mesmo número
    const other = await createWorkPermit("org_b", base("PT-DUP"));
    expect(other.id).toBeDefined();
  });

  it("empresa de outro tenant → FK_NOT_FOUND", async () => {
    await expect(
      createWorkPermit("org_a", { ...base("PT-A-XCO"), companyId: COMPANY_B }),
    ).rejects.toBeInstanceOf(ReferenceNotFoundError);
  });

  it("update altera campos; delete remove", async () => {
    const { id } = await createWorkPermit("org_a", base("PT-A-EDIT"));
    const ok = await updateWorkPermit("org_a", id, {
      ...base("PT-A-EDIT"),
      status: "active",
      description: "Revisado",
    });
    expect(ok).toBe(true);
    const found = await getWorkPermit("org_a", id);
    expect(found!.permit.status).toBe("active");
    expect(await deleteWorkPermit("org_a", id)).toBe(true);
    expect(await getWorkPermit("org_a", id)).toBeNull();
  });

  it("busca por número + isolamento cross-tenant", async () => {
    const { id } = await createWorkPermit("org_a", base("PT-A-SEARCH"));
    const listed = await listWorkPermits("org_a", { search: "SEARCH" });
    expect(listed.rows.some((r) => r.id === id)).toBe(true);

    expect(await getWorkPermit("org_b", id)).toBeNull();
    expect(await updateWorkPermit("org_b", id, base("PT-A-SEARCH"))).toBe(false);
    expect(await deleteWorkPermit("org_b", id)).toBe(false);
  });

  it("CHECK de validade rejeita validUntil < validFrom no banco", async () => {
    // Bypassa o Zod (que também barra) para provar o backstop do banco.
    await expect(
      createWorkPermit("org_a", {
        ...base("PT-A-BADRANGE"),
        validFrom: "2026-07-20",
        validUntil: "2026-07-10",
      }),
    ).rejects.toBeDefined();
  });
});
