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
  createTrainingCatalogAction,
  deleteTrainingCatalogAction,
  getTrainingCatalogAction,
  getTrainingCatalogDependentsAction,
  listTrainingCatalogAction,
  updateTrainingCatalogAction,
} from "@/shared/server/actions/pgr/training-catalog";

import { adminClient, applyMigrations } from "./_helpers/db";
import { seedPgrBase, PGR_IDS } from "./_helpers/pgr-seed";

const APP_RUNTIME_URL = process.env.INTEGRATION_APP_RUNTIME_URL;
const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!APP_RUNTIME_URL && !!ADMIN_URL;

const mockedGate = requireOfficeStaff as jest.MockedFunction<typeof requireOfficeStaff>;
const asOwner = (tenantId: string) =>
  mockedGate.mockResolvedValue({ userId: "u", tenantId, plan: "free", role: "owner" });

const VALID_INPUT = {
  name: "NR-35 Trabalho em Altura",
  referenceNorm: "NR-35",
  workloadHours: "8",
  periodicity: "biennial",
} as const;

(shouldRun ? describe : describe.skip)(
  "Server Actions — training catalog CRUD (US1)",
  () => {
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

    it("cria, lista, detalha, edita e exclui (escopado ao tenant)", async () => {
      const created = await createTrainingCatalogAction(VALID_INPUT);
      expect(created.ok).toBe(true);
      if (!created.ok) return;
      expect(created.data.workloadHours).toBe(8);
      expect(created.data.orgId).toBe("org_a");

      const list = await listTrainingCatalogAction({});
      expect(list.ok && list.data.total).toBe(1);

      const got = await getTrainingCatalogAction(created.data.id);
      expect(got.ok && got.data.name).toBe("NR-35 Trabalho em Altura");

      const updated = await updateTrainingCatalogAction(created.data.id, {
        ...VALID_INPUT,
        name: "NR-35 Trabalho em Altura (rev. 2)",
        workloadHours: "16",
      });
      expect(updated.ok && updated.data.name).toBe("NR-35 Trabalho em Altura (rev. 2)");
      expect(updated.ok && updated.data.workloadHours).toBe(16);

      const del = await deleteTrainingCatalogAction(created.data.id);
      expect(del.ok).toBe(true);

      const after = await listTrainingCatalogAction({});
      expect(after.ok && after.data.total).toBe(0);
    });

    it("busca por nome e por norma de referência", async () => {
      await createTrainingCatalogAction(VALID_INPUT);
      await createTrainingCatalogAction({
        ...VALID_INPUT,
        name: "Segurança em Eletricidade",
        referenceNorm: "NR-10",
      });

      const byName = await listTrainingCatalogAction({ search: "Altura" });
      expect(byName.ok && byName.data.total).toBe(1);

      const byNorm = await listTrainingCatalogAction({ search: "NR-10" });
      expect(byNorm.ok && byNorm.data.total).toBe(1);
    });

    it("nome duplicado no mesmo escritório → DUPLICATE (409)", async () => {
      await createTrainingCatalogAction(VALID_INPUT);
      const dup = await createTrainingCatalogAction(VALID_INPUT);
      expect(dup.ok).toBe(false);
      if (!dup.ok) expect(dup.error.code).toBe("DUPLICATE");
    });

    it("carga horária inválida / periodicidade fora do enum → VALIDATION", async () => {
      const zero = await createTrainingCatalogAction({
        ...VALID_INPUT,
        workloadHours: "0",
      });
      expect(!zero.ok && zero.error.code).toBe("VALIDATION");

      const badEnum = await createTrainingCatalogAction({
        ...VALID_INPUT,
        periodicity: "monthly" as never,
      });
      expect(!badEnum.ok && badEnum.error.code).toBe("VALIDATION");
    });

    it("get/update/delete de item de OUTRO tenant → NOT_FOUND", async () => {
      asOwner("org_b");
      const foreign = await createTrainingCatalogAction(VALID_INPUT);
      expect(foreign.ok).toBe(true);
      if (!foreign.ok) return;

      asOwner("org_a");
      const got = await getTrainingCatalogAction(foreign.data.id);
      expect(!got.ok && got.error.code).toBe("NOT_FOUND");

      const updated = await updateTrainingCatalogAction(foreign.data.id, VALID_INPUT);
      expect(!updated.ok && updated.error.code).toBe("NOT_FOUND");

      const deleted = await deleteTrainingCatalogAction(foreign.data.id);
      expect(!deleted.ok && deleted.error.code).toBe("NOT_FOUND");

      const deps = await getTrainingCatalogDependentsAction(foreign.data.id);
      expect(!deps.ok && deps.error.code).toBe("NOT_FOUND");
    });

    it("dependents conta realizações e vínculos; exclusão em uso é bloqueada", async () => {
      const created = await createTrainingCatalogAction(VALID_INPUT);
      expect(created.ok).toBe(true);
      if (!created.ok) return;

      await admin.unsafe(`
      insert into public.training_records (org_id, employee_id, training_id, completed_at, valid_until)
      values ('org_a','${PGR_IDS.employeeA}','${created.data.id}','2026-01-10','2028-01-10');
      insert into public.job_role_required_trainings (org_id, job_role_id, training_id)
      values ('org_a','${PGR_IDS.jobRoleA}','${created.data.id}');
    `);

      const deps = await getTrainingCatalogDependentsAction(created.data.id);
      expect(deps.ok && deps.data).toEqual({ records: 1, requiredLinks: 1 });

      const del = await deleteTrainingCatalogAction(created.data.id);
      expect(del.ok).toBe(false);
      if (!del.ok) expect(del.error.code).toBe("IN_USE");

      const still = await getTrainingCatalogAction(created.data.id);
      expect(still.ok).toBe(true);
    });

    it("papel client → FORBIDDEN em toda ação de escrita", async () => {
      mockedGate.mockRejectedValue(new ForbiddenError());

      const created = await createTrainingCatalogAction(VALID_INPUT);
      expect(!created.ok && created.error.code).toBe("FORBIDDEN");

      const listed = await listTrainingCatalogAction({});
      expect(!listed.ok && listed.error.code).toBe("FORBIDDEN");
    });
  },
);
