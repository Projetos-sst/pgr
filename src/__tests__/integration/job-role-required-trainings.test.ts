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
  addRequiredTrainingAction,
  getEmployeeComplianceAction,
  listNonComplianceAction,
  listRequiredTrainingsAction,
  removeRequiredTrainingAction,
} from "@/shared/server/actions/pgr/job-role-required-trainings";
import { createTrainingRecordAction } from "@/shared/server/actions/pgr/training-records";
import { todayInSaoPaulo } from "@/shared/dates";

import { adminClient, applyMigrations } from "./_helpers/db";
import { seedPgrBase, PGR_IDS } from "./_helpers/pgr-seed";

const APP_RUNTIME_URL = process.env.INTEGRATION_APP_RUNTIME_URL;
const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!APP_RUNTIME_URL && !!ADMIN_URL;

const mockedGate = requireOfficeStaff as jest.MockedFunction<typeof requireOfficeStaff>;
const asOwner = (tenantId: string) =>
  mockedGate.mockResolvedValue({ userId: "u", tenantId, plan: "free", role: "owner" });

const CATALOG = {
  annualA: "61111111-1111-1111-1111-1111111111a1",
  singleA: "61111111-1111-1111-1111-1111111111a2",
  annualB: "62222222-2222-2222-2222-2222222222b1",
} as const;

const EXTRA = {
  jobRoleA2: "61111111-1111-1111-1111-1111111111a3",
  employeeNoRole: "61111111-1111-1111-1111-1111111111a4",
} as const;

const I = PGR_IDS;

function shiftYears(isoDate: string, years: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year + years, month - 1, day)).toISOString().slice(0, 10);
}

async function seedTrainings(admin: ReturnType<typeof postgres>): Promise<void> {
  await admin.unsafe(`
    insert into public.training_catalog (id, org_id, name, workload_hours, periodicity) values
      ('${CATALOG.annualA}','org_a','NR-18 Canteiro',4,'annual'),
      ('${CATALOG.singleA}','org_a','Integração',2,'single'),
      ('${CATALOG.annualB}','org_b','NR-10 SEP',40,'annual');

    insert into public.job_roles (id, org_id, company_id, title) values
      ('${EXTRA.jobRoleA2}','org_a','${I.companyA}','Carpinteiro');

    insert into public.employees (id, org_id, company_id, full_name, cpf) values
      ('${EXTRA.employeeNoRole}','org_a','${I.companyA}','Sem Função','11122233344');
  `);
}

(shouldRun ? describe : describe.skip)(
  "US4 — obrigatórios por função + conformidade",
  () => {
    let admin: ReturnType<typeof postgres>;
    const today = todayInSaoPaulo();

    beforeAll(async () => {
      admin = adminClient();
      await applyMigrations(admin);
    });
    afterAll(async () => {
      await admin.end({ timeout: 5 });
    });
    beforeEach(async () => {
      await seedPgrBase(admin);
      await seedTrainings(admin);
      mockedGate.mockReset();
      asOwner("org_a");
    });

    it("add é idempotente (UNIQUE) e remove desfaz o vínculo", async () => {
      const first = await addRequiredTrainingAction({
        jobRoleId: I.jobRoleA,
        trainingId: CATALOG.annualA,
      });
      expect(first.ok).toBe(true);
      if (!first.ok) return;

      const again = await addRequiredTrainingAction({
        jobRoleId: I.jobRoleA,
        trainingId: CATALOG.annualA,
      });
      expect(again.ok).toBe(true);
      if (!again.ok) return;
      expect(again.data.id).toBe(first.data.id);

      const list = await listRequiredTrainingsAction({ jobRoleId: I.jobRoleA });
      expect(list.ok && list.data).toHaveLength(1);

      const removed = await removeRequiredTrainingAction(first.data.id);
      expect(removed.ok).toBe(true);

      const after = await listRequiredTrainingsAction({ jobRoleId: I.jobRoleA });
      expect(after.ok && after.data).toHaveLength(0);
    });

    it("função/treinamento de OUTRO tenant → FK_NOT_FOUND", async () => {
      const foreignTraining = await addRequiredTrainingAction({
        jobRoleId: I.jobRoleA,
        trainingId: CATALOG.annualB,
      });
      expect(!foreignTraining.ok && foreignTraining.error.code).toBe("FK_NOT_FOUND");

      const foreignRole = await addRequiredTrainingAction({
        jobRoleId: I.jobRoleB,
        trainingId: CATALOG.annualA,
      });
      expect(!foreignRole.ok && foreignRole.error.code).toBe("FK_NOT_FOUND");
    });

    it("conformidade: sem registro → missing; último registro decide (D5); single realizado 1× → ok", async () => {
      await addRequiredTrainingAction({
        jobRoleId: I.jobRoleA,
        trainingId: CATALOG.annualA,
      });
      await addRequiredTrainingAction({
        jobRoleId: I.jobRoleA,
        trainingId: CATALOG.singleA,
      });

      // employeeA tem jobRoleA. Sem registros ainda → 2 missing.
      const before = await getEmployeeComplianceAction({ employeeId: I.employeeA });
      expect(before.ok).toBe(true);
      if (!before.ok) return;
      expect(before.data).toHaveLength(2);
      expect(before.data.every((row) => row.status === "missing")).toBe(true);

      // realização antiga vencida do annual + single realizado
      await createTrainingRecordAction({
        employeeId: I.employeeA,
        trainingId: CATALOG.annualA,
        completedAt: shiftYears(today, -2),
      });
      await createTrainingRecordAction({
        employeeId: I.employeeA,
        trainingId: CATALOG.singleA,
        completedAt: shiftYears(today, -3),
      });

      const middle = await getEmployeeComplianceAction({ employeeId: I.employeeA });
      expect(middle.ok).toBe(true);
      if (!middle.ok) return;
      const byTraining = Object.fromEntries(
        middle.data.map((row) => [row.trainingId, row.status]),
      );
      expect(byTraining[CATALOG.annualA]).toBe("expired");
      expect(byTraining[CATALOG.singleA]).toBe("ok"); // single não expira nunca

      // reciclagem do annual hoje → último registro conta → ok
      await createTrainingRecordAction({
        employeeId: I.employeeA,
        trainingId: CATALOG.annualA,
        completedAt: today,
      });
      const after = await getEmployeeComplianceAction({ employeeId: I.employeeA });
      expect(after.ok).toBe(true);
      if (!after.ok) return;
      expect(after.data.every((row) => row.status === "ok")).toBe(true);
    });

    it("função sem obrigatórios → lista vazia, não erro (FR-042)", async () => {
      const result = await getEmployeeComplianceAction({ employeeId: I.employeeA });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data).toEqual([]);
    });

    it("funcionário sem função → conforme por vacuidade (lista vazia)", async () => {
      await addRequiredTrainingAction({
        jobRoleId: I.jobRoleA,
        trainingId: CATALOG.annualA,
      });
      const result = await getEmployeeComplianceAction({
        employeeId: EXTRA.employeeNoRole,
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data).toEqual([]);
    });

    it("mesmo treinamento obrigatório em várias funções", async () => {
      const roleA = await addRequiredTrainingAction({
        jobRoleId: I.jobRoleA,
        trainingId: CATALOG.annualA,
      });
      const roleA2 = await addRequiredTrainingAction({
        jobRoleId: EXTRA.jobRoleA2,
        trainingId: CATALOG.annualA,
      });
      expect(roleA.ok && roleA2.ok).toBe(true);

      const listA = await listRequiredTrainingsAction({ jobRoleId: I.jobRoleA });
      const listA2 = await listRequiredTrainingsAction({ jobRoleId: EXTRA.jobRoleA2 });
      expect(listA.ok && listA.data).toHaveLength(1);
      expect(listA2.ok && listA2.data).toHaveLength(1);
    });

    it("relatório de não-conformes: missing|expired entram, ok fica de fora", async () => {
      await addRequiredTrainingAction({
        jobRoleId: I.jobRoleA,
        trainingId: CATALOG.annualA,
      });
      await addRequiredTrainingAction({
        jobRoleId: I.jobRoleA,
        trainingId: CATALOG.singleA,
      });
      // single realizado → ok (fora do relatório); annual sem registro → missing
      await createTrainingRecordAction({
        employeeId: I.employeeA,
        trainingId: CATALOG.singleA,
        completedAt: today,
      });

      const report = await listNonComplianceAction();
      expect(report.ok).toBe(true);
      if (!report.ok) return;
      expect(report.data).toHaveLength(1);
      expect(report.data[0].trainingId).toBe(CATALOG.annualA);
      expect(report.data[0].status).toBe("missing");
      expect(report.data[0].employeeId).toBe(I.employeeA);
    });

    it("conformidade de funcionário cross-tenant → NOT_FOUND; vínculos isolados por tenant", async () => {
      const foreign = await getEmployeeComplianceAction({ employeeId: I.employeeB });
      expect(!foreign.ok && foreign.error.code).toBe("NOT_FOUND");

      await admin.unsafe(`
        insert into public.job_role_required_trainings (org_id, job_role_id, training_id)
        values ('org_b','${I.jobRoleB}','${CATALOG.annualB}');
      `);
      const listForeign = await listRequiredTrainingsAction({ jobRoleId: I.jobRoleB });
      expect(listForeign.ok && listForeign.data).toHaveLength(0);

      const report = await listNonComplianceAction();
      expect(report.ok && report.data).toHaveLength(0);
    });

    it("papel client → FORBIDDEN em escrita", async () => {
      mockedGate.mockRejectedValue(new ForbiddenError());
      const result = await addRequiredTrainingAction({
        jobRoleId: I.jobRoleA,
        trainingId: CATALOG.annualA,
      });
      expect(!result.ok && result.error.code).toBe("FORBIDDEN");
    });
  },
);
