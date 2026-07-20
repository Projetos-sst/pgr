/**
 * Integração do CRUD de Controle de Formulário — ISO (issue #88) contra Postgres
 * efêmero. Cobre create/get/update/delete, DUPLICATE (código FRM por org), FK
 * inválida (empresa/GES), e isolamento cross-tenant.
 */
import type postgres from "postgres";

jest.mock("@/shared/db/env", () => ({
  getDatabaseUrl: () => process.env.INTEGRATION_APP_RUNTIME_URL,
}));

import {
  createFormControl,
  deleteFormControl,
  getFormControlById,
  listFormControls,
  updateFormControl,
} from "@/shared/db/repositories/form-controls";
import { ReferenceNotFoundError } from "@/shared/errors/reference-not-found-error";

import { adminClient, applyMigrations } from "../_helpers/db";
import { PGR_IDS, seedPgrBase } from "../_helpers/pgr-seed";

const APP_RUNTIME_URL = process.env.INTEGRATION_APP_RUNTIME_URL;
const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!APP_RUNTIME_URL && !!ADMIN_URL;

const base = (frmCode: string) => ({
  formType: "PGR",
  frmCode,
  revision: "00",
  issueDate: "2026-01-15",
  position: "top" as const,
});

(shouldRun ? describe : describe.skip)("controle de formulário (ISO) — CRUD", () => {
  let admin: ReturnType<typeof postgres>;

  beforeAll(async () => {
    admin = adminClient();
    await applyMigrations(admin);
  });

  afterAll(async () => {
    await admin.end();
  });

  beforeEach(async () => {
    await seedPgrBase(admin);
  });

  it("cria com empresa e GES do tenant e lê de volta", async () => {
    const { id } = await createFormControl("org_a", {
      ...base("FRM-A-100"),
      companyId: PGR_IDS.companyA,
      gesId: PGR_IDS.gesA,
      nonConformityNumber: "NC-01",
      notes: "obs",
    });
    const found = await getFormControlById("org_a", id);
    expect(found!.control.frmCode).toBe("FRM-A-100");
    expect(found!.company?.id).toBe(PGR_IDS.companyA);
    expect(found!.ges?.id).toBe(PGR_IDS.gesA);
  });

  it("código FRM duplicado no mesmo tenant → rejeitado (DUPLICATE)", async () => {
    await createFormControl("org_a", base("FRM-DUP"));
    await expect(createFormControl("org_a", base("FRM-DUP"))).rejects.toBeDefined();
    // outro tenant pode reusar o mesmo código FRM
    const other = await createFormControl("org_b", base("FRM-DUP"));
    expect(other.id).toBeDefined();
  });

  it("empresa de outro tenant → FK_NOT_FOUND", async () => {
    await expect(
      createFormControl("org_a", { ...base("FRM-A-XCO"), companyId: PGR_IDS.companyB }),
    ).rejects.toBeInstanceOf(ReferenceNotFoundError);
  });

  it("GES de outro tenant → FK_NOT_FOUND", async () => {
    await expect(
      createFormControl("org_a", { ...base("FRM-A-XGES"), gesId: PGR_IDS.gesB }),
    ).rejects.toBeInstanceOf(ReferenceNotFoundError);
  });

  it("update altera campos; delete remove", async () => {
    const { id } = await createFormControl("org_a", base("FRM-A-EDIT"));
    const ok = await updateFormControl("org_a", id, {
      ...base("FRM-A-EDIT"),
      revision: "01",
      position: "both",
      notes: "revisado",
    });
    expect(ok).toBe(true);
    const found = await getFormControlById("org_a", id);
    expect(found!.control.revision).toBe("01");
    expect(found!.control.position).toBe("both");
    expect(await deleteFormControl("org_a", id)).toBe(true);
    expect(await getFormControlById("org_a", id)).toBeNull();
  });

  it("busca por código FRM + isolamento cross-tenant (404 nunca vaza)", async () => {
    const { id } = await createFormControl("org_a", base("FRM-A-SEARCH"));
    const listed = await listFormControls("org_a", { search: "SEARCH" });
    expect(listed.rows.some((r) => r.id === id)).toBe(true);

    // Controle de org_a nunca aparece nem é acessível/mutável por org_b.
    expect(await getFormControlById("org_b", id)).toBeNull();
    expect(await updateFormControl("org_b", id, base("FRM-A-SEARCH"))).toBe(false);
    expect(await deleteFormControl("org_b", id)).toBe(false);

    const listedFromB = await listFormControls("org_b", {});
    expect(listedFromB.rows.some((r) => r.id === id)).toBe(false);
  });
});
