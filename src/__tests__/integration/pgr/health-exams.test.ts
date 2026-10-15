import type postgres from "postgres";

jest.mock("@/shared/db/env", () => ({
  getDatabaseUrl: () => process.env.INTEGRATION_APP_RUNTIME_URL,
}));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("@/shared/auth/require-office-staff", () => ({
  requireOfficeStaff: jest.fn(),
}));

import { requireOfficeStaff } from "@/shared/auth/require-office-staff";
import {
  listHealthExamsAction,
  getHealthExamAction,
  createHealthExamAction,
  updateHealthExamAction,
  deleteHealthExamAction,
} from "@/shared/server/actions/pgr/health-exams";
import { createMedicoAction } from "@/shared/server/actions/pgr/medicos";

import { adminClient, applyMigrations } from "../_helpers/db";
import { seedPgrBase, PGR_IDS } from "../_helpers/pgr-seed";

const APP_RUNTIME_URL = process.env.INTEGRATION_APP_RUNTIME_URL;
const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!APP_RUNTIME_URL && !!ADMIN_URL;

const mockedGate = requireOfficeStaff as jest.MockedFunction<typeof requireOfficeStaff>;
const asOwner = (tenantId: string) =>
  mockedGate.mockResolvedValue({ userId: "u", tenantId, plan: "free", role: "owner" });

(shouldRun ? describe : describe.skip)("Server Actions — health exams CRUD", () => {
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

  it("cria (com médico), lista, detalha, edita e exclui (escopado ao tenant)", async () => {
    const doctor = await createMedicoAction({ name: "Dra. Helena", crm: "CRM 12/MA" });
    expect(doctor.ok).toBe(true);
    if (!doctor.ok) return;

    const created = await createHealthExamAction({
      employeeId: PGR_IDS.employeeA,
      doctorId: doctor.data.id,
      examType: "admissional",
      performedAt: "2026-01-14",
      validUntil: "2027-01-14",
      aptitude: "fit",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const list = await listHealthExamsAction({});
    expect(list.ok && list.data.total).toBe(1);
    expect(list.ok && list.data.rows[0].employeeName).toBe("Func A");
    expect(list.ok && list.data.rows[0].doctorName).toBe("Dra. Helena");

    const got = await getHealthExamAction(created.data.id);
    expect(got.ok && got.data.examType).toBe("admissional");

    const updated = await updateHealthExamAction(created.data.id, {
      employeeId: PGR_IDS.employeeA,
      examType: "periodic",
      performedAt: "2026-02-03",
      aptitude: "fit_with_restrictions",
    });
    expect(updated.ok && updated.data.aptitude).toBe("fit_with_restrictions");
    expect(updated.ok && updated.data.doctorId).toBeNull();

    const del = await deleteHealthExamAction(created.data.id);
    expect(del.ok).toBe(true);

    const after = await listHealthExamsAction({});
    expect(after.ok && after.data.total).toBe(0);
  });

  it("busca por funcionário e filtra por tipo", async () => {
    await createHealthExamAction({
      employeeId: PGR_IDS.employeeA,
      examType: "admissional",
      performedAt: "2026-01-14",
      aptitude: "fit",
    });
    await createHealthExamAction({
      employeeId: PGR_IDS.employeeA,
      examType: "periodic",
      performedAt: "2026-03-14",
      aptitude: "fit",
    });

    const byType = await listHealthExamsAction({ examType: "periodic" });
    expect(byType.ok && byType.data.total).toBe(1);

    const byName = await listHealthExamsAction({ search: "Func A" });
    expect(byName.ok && byName.data.total).toBe(2);

    // Busca por "exame" (rótulo do tipo): "periód" casa só os periódicos.
    const byExam = await listHealthExamsAction({ search: "periód" });
    expect(byExam.ok && byExam.data.total).toBe(1);
    if (byExam.ok) expect(byExam.data.rows[0].examType).toBe("periodic");
  });

  it("médico cross-tenant → FK_NOT_FOUND", async () => {
    asOwner("org_b");
    const docB = await createMedicoAction({ name: "Dr. B", crm: "CRM 99/PA" });
    expect(docB.ok).toBe(true);
    if (!docB.ok) return;

    asOwner("org_a");
    const result = await createHealthExamAction({
      employeeId: PGR_IDS.employeeA,
      doctorId: docB.data.id, // médico de org_b
      examType: "admissional",
      performedAt: "2026-01-14",
      aptitude: "fit",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("FK_NOT_FOUND");
  });

  it("funcionário inexistente/cross-tenant → FK_NOT_FOUND", async () => {
    const result = await createHealthExamAction({
      employeeId: PGR_IDS.employeeB, // funcionário de org_b
      examType: "admissional",
      performedAt: "2026-01-14",
      aptitude: "fit",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("FK_NOT_FOUND");
  });

  it("data futura → VALIDATION", async () => {
    const result = await createHealthExamAction({
      employeeId: PGR_IDS.employeeA,
      examType: "admissional",
      performedAt: "2999-01-01",
      aptitude: "fit",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("VALIDATION");
  });

  it("não vaza entre tenants (cross-tenant → NOT_FOUND)", async () => {
    const created = await createHealthExamAction({
      employeeId: PGR_IDS.employeeA,
      examType: "admissional",
      performedAt: "2026-01-14",
      aptitude: "fit",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    asOwner("org_b");
    const got = await getHealthExamAction(created.data.id);
    expect(got.ok).toBe(false);
    if (!got.ok) expect(got.error.code).toBe("NOT_FOUND");

    const list = await listHealthExamsAction({});
    expect(list.ok && list.data.total).toBe(0);
  });
});
