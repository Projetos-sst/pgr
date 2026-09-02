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
  createTrainingRecordAction,
  deleteTrainingRecordAction,
  getTrainingRecordAction,
  listTrainingRecordsAction,
} from "@/shared/server/actions/pgr/training-records";

import { adminClient, applyMigrations } from "./_helpers/db";
import { seedPgrBase, PGR_IDS } from "./_helpers/pgr-seed";

const APP_RUNTIME_URL = process.env.INTEGRATION_APP_RUNTIME_URL;
const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!APP_RUNTIME_URL && !!ADMIN_URL;

const mockedGate = requireOfficeStaff as jest.MockedFunction<typeof requireOfficeStaff>;
const asOwner = (tenantId: string) =>
  mockedGate.mockResolvedValue({ userId: "u", tenantId, plan: "free", role: "owner" });

const CATALOG = {
  biennialA: "41111111-1111-1111-1111-1111111111a1",
  singleA: "41111111-1111-1111-1111-1111111111a2",
  biennialB: "42222222-2222-2222-2222-2222222222b1",
} as const;

const I = PGR_IDS;

async function seedTrainingCatalog(admin: ReturnType<typeof postgres>): Promise<void> {
  await admin.unsafe(`
    insert into public.training_catalog (id, org_id, number, name, workload_hours, periodicity) values
      ('${CATALOG.biennialA}','org_a',1,'NR-35 Trabalho em Altura',8,'biennial'),
      ('${CATALOG.singleA}','org_a',2,'Integração de Segurança',2,'single'),
      ('${CATALOG.biennialB}','org_b',1,'NR-10 SEP',40,'biennial');
  `);
}

(shouldRun ? describe : describe.skip)("Server Actions — training records (US2)", () => {
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
    await seedTrainingCatalog(admin);
    mockedGate.mockReset();
    asOwner("org_a");
  });

  it("create grava valid_until = completed_at + 2 anos (biennial), calculado no servidor", async () => {
    const created = await createTrainingRecordAction({
      employeeId: I.employeeA,
      trainingId: CATALOG.biennialA,
      completedAt: "2026-01-10",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.data.validUntil).toBe("2028-01-10");
    expect(created.data.orgId).toBe("org_a");

    const got = await getTrainingRecordAction(created.data.id);
    expect(got.ok && got.data.validUntil).toBe("2028-01-10");

    const list = await listTrainingRecordsAction({ employeeId: I.employeeA });
    expect(list.ok && list.data.total).toBe(1);
    expect(list.ok && list.data.rows[0].trainingName).toBe("NR-35 Trabalho em Altura");

    const del = await deleteTrainingRecordAction(created.data.id);
    expect(del.ok).toBe(true);
  });

  it("periodicidade single grava valid_until = null", async () => {
    const created = await createTrainingRecordAction({
      employeeId: I.employeeA,
      trainingId: CATALOG.singleA,
      completedAt: "2026-01-10",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.data.validUntil).toBeNull();
  });

  it("certificado é opcional; quando informado, é persistido", async () => {
    const created = await createTrainingRecordAction({
      employeeId: I.employeeA,
      trainingId: CATALOG.biennialA,
      completedAt: "2026-01-10",
      certificatePath: "certificados/nr35-2026.pdf",
    });
    expect(created.ok && created.data.certificatePath).toBe("certificados/nr35-2026.pdf");
  });

  it("completed_at no futuro → VALIDATION, nada gravado", async () => {
    const created = await createTrainingRecordAction({
      employeeId: I.employeeA,
      trainingId: CATALOG.biennialA,
      completedAt: "2099-01-01",
    });
    expect(!created.ok && created.error.code).toBe("VALIDATION");

    const list = await listTrainingRecordsAction({ employeeId: I.employeeA });
    expect(list.ok && list.data.total).toBe(0);
  });

  it("funcionário de OUTRO tenant → FK_NOT_FOUND, nada gravado", async () => {
    const created = await createTrainingRecordAction({
      employeeId: I.employeeB,
      trainingId: CATALOG.biennialA,
      completedAt: "2026-01-10",
    });
    expect(!created.ok && created.error.code).toBe("FK_NOT_FOUND");

    const rows = await admin.unsafe(
      `select id from public.training_records where employee_id = '${I.employeeB}'`,
    );
    expect(rows).toHaveLength(0);
  });

  it("treinamento de OUTRO tenant → FK_NOT_FOUND, nada gravado", async () => {
    const created = await createTrainingRecordAction({
      employeeId: I.employeeA,
      trainingId: CATALOG.biennialB,
      completedAt: "2026-01-10",
    });
    expect(!created.ok && created.error.code).toBe("FK_NOT_FOUND");

    const list = await listTrainingRecordsAction({ employeeId: I.employeeA });
    expect(list.ok && list.data.total).toBe(0);
  });

  it("get/delete de registro de OUTRO tenant → NOT_FOUND", async () => {
    asOwner("org_b");
    const foreign = await createTrainingRecordAction({
      employeeId: I.employeeB,
      trainingId: CATALOG.biennialB,
      completedAt: "2026-01-10",
    });
    expect(foreign.ok).toBe(true);
    if (!foreign.ok) return;

    asOwner("org_a");
    const got = await getTrainingRecordAction(foreign.data.id);
    expect(!got.ok && got.error.code).toBe("NOT_FOUND");

    const del = await deleteTrainingRecordAction(foreign.data.id);
    expect(!del.ok && del.error.code).toBe("NOT_FOUND");
  });

  it("papel client → FORBIDDEN", async () => {
    mockedGate.mockRejectedValue(new ForbiddenError());
    const created = await createTrainingRecordAction({
      employeeId: I.employeeA,
      trainingId: CATALOG.biennialA,
      completedAt: "2026-01-10",
    });
    expect(!created.ok && created.error.code).toBe("FORBIDDEN");
  });
});
