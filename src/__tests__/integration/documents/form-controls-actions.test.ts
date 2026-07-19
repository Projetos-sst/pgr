/**
 * Integração das Server Actions de Controle de Formulário — ISO (issue #88)
 * contra Postgres efêmero. Cobre o gate de papel (FORBIDDEN), NOT_FOUND
 * cross-tenant em getById/update/delete, e o fluxo feliz create→update→delete.
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
  createFormControlAction,
  deleteFormControlAction,
  getFormControlAction,
  listFormControlsAction,
  updateFormControlAction,
} from "@/shared/server/actions/documents/form-controls";

import { adminClient, applyMigrations } from "../_helpers/db";
import { seedPgrBase } from "../_helpers/pgr-seed";

const APP_RUNTIME_URL = process.env.INTEGRATION_APP_RUNTIME_URL;
const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!APP_RUNTIME_URL && !!ADMIN_URL;

const mockedGate = requireOfficeStaff as jest.MockedFunction<typeof requireOfficeStaff>;
const asOwner = (tenantId: string) =>
  mockedGate.mockResolvedValue({ userId: "u", tenantId, plan: "free", role: "owner" });

const base = (frmCode: string) => ({
  formType: "PGR",
  frmCode,
  revision: "00",
  issueDate: "2026-01-15",
  position: "top" as const,
});

(shouldRun ? describe : describe.skip)(
  "Server Actions — form_controls (issue #88)",
  () => {
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
      mockedGate.mockReset();
    });

    it("papel client → FORBIDDEN em list/create", async () => {
      mockedGate.mockRejectedValue(new ForbiddenError());

      const listResult = await listFormControlsAction();
      expect(listResult.ok).toBe(false);
      if (!listResult.ok) expect(listResult.error.code).toBe("FORBIDDEN");

      const createResult = await createFormControlAction(base("FRM-A-FORBIDDEN"));
      expect(createResult.ok).toBe(false);
      if (!createResult.ok) expect(createResult.error.code).toBe("FORBIDDEN");
    });

    it("fluxo feliz: create → list → update → delete (owner, org_a)", async () => {
      asOwner("org_a");

      const created = await createFormControlAction(base("FRM-A-FLOW"));
      expect(created.ok).toBe(true);
      if (!created.ok) throw new Error("create failed");

      const listed = await listFormControlsAction({ search: "FLOW" });
      expect(listed.ok).toBe(true);
      if (listed.ok)
        expect(listed.data.rows.some((r) => r.id === created.data.id)).toBe(true);

      const updated = await updateFormControlAction(created.data.id, {
        ...base("FRM-A-FLOW"),
        revision: "01",
      });
      expect(updated.ok).toBe(true);

      const deleted = await deleteFormControlAction(created.data.id);
      expect(deleted.ok).toBe(true);

      const afterDelete = await getFormControlAction(created.data.id);
      expect(afterDelete.ok).toBe(false);
      if (!afterDelete.ok) expect(afterDelete.error.code).toBe("NOT_FOUND");
    });

    // Regressão do bug de QA: o form envia `null` (não string vazia) para
    // companyId/gesId quando o <select> é limpo; a action devolvia 422 antes do
    // fix (`optionalUuid` não aceitava `null`).
    it("cria com companyId/gesId = null sem 422 (form limpo)", async () => {
      asOwner("org_a");
      const created = await createFormControlAction({
        ...base("FRM-A-NULLFK"),
        companyId: null,
        gesId: null,
      });
      expect(created.ok).toBe(true);
      if (!created.ok) return;

      const found = await getFormControlAction(created.data.id);
      expect(found.ok).toBe(true);
      if (found.ok) {
        expect(found.data.control.companyId).toBeNull();
        expect(found.data.control.gesId).toBeNull();
      }
    });

    it("getById/update/delete de controle de outro tenant → NOT_FOUND (nunca vaza)", async () => {
      asOwner("org_b");
      const created = await createFormControlAction(base("FRM-B-XTENANT"));
      expect(created.ok).toBe(true);
      if (!created.ok) throw new Error("create failed");

      asOwner("org_a");
      const got = await getFormControlAction(created.data.id);
      expect(got.ok).toBe(false);
      if (!got.ok) expect(got.error.code).toBe("NOT_FOUND");

      const updated = await updateFormControlAction(
        created.data.id,
        base("FRM-B-XTENANT"),
      );
      expect(updated.ok).toBe(false);
      if (!updated.ok) expect(updated.error.code).toBe("NOT_FOUND");

      const deleted = await deleteFormControlAction(created.data.id);
      expect(deleted.ok).toBe(false);
      if (!deleted.ok) expect(deleted.error.code).toBe("NOT_FOUND");
    });
  },
);
