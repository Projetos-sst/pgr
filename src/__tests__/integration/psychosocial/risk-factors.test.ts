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
  createPsychosocialRiskFactorAction,
  deletePsychosocialRiskFactorAction,
  getPsychosocialRiskFactorAction,
  listPsychosocialRiskFactorsAction,
  updatePsychosocialRiskFactorAction,
} from "@/shared/server/actions/psychosocial/risk-factors";
import { formatPsychosocialFactorCode } from "@/shared/domains/psychosocial/risk-factors";

import { adminClient, applyMigrations } from "../_helpers/db";
import { seedPgrBase, PGR_IDS } from "../_helpers/pgr-seed";

const APP_RUNTIME_URL = process.env.INTEGRATION_APP_RUNTIME_URL;
const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!APP_RUNTIME_URL && !!ADMIN_URL;

const mockedGate = requireOfficeStaff as jest.MockedFunction<typeof requireOfficeStaff>;
const asOwner = (tenantId: string) =>
  mockedGate.mockResolvedValue({ userId: "u", tenantId, plan: "free", role: "owner" });

const VALID_INPUT = {
  name: "Sobrecarga de trabalho",
  gesId: PGR_IDS.gesA,
  level: "high",
  assessmentMethod: "Questionário COPSOQ",
  status: "in_action",
} as const;

(shouldRun ? describe : describe.skip)(
  "Server Actions — psychosocial risk factors CRUD (catálogo)",
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

    it("cria, lista (com GES derivado), detalha, edita e exclui — escopado ao tenant", async () => {
      const created = await createPsychosocialRiskFactorAction(VALID_INPUT);
      expect(created.ok).toBe(true);
      if (!created.ok) return;
      expect(created.data.orgId).toBe("org_a");
      expect(created.data.number).toBe(1);
      expect(created.data.level).toBe("high");

      const list = await listPsychosocialRiskFactorsAction({});
      expect(list.ok && list.data.total).toBe(1);
      expect(list.ok && list.data.rows[0].gesName).toBe("GES A");

      const got = await getPsychosocialRiskFactorAction(created.data.id);
      expect(got.ok && got.data.name).toBe("Sobrecarga de trabalho");

      const updated = await updatePsychosocialRiskFactorAction(created.data.id, {
        ...VALID_INPUT,
        name: "Sobrecarga de trabalho (rev.)",
        level: "medium",
        status: "monitored",
      });
      expect(updated.ok && updated.data.name).toBe("Sobrecarga de trabalho (rev.)");
      expect(updated.ok && updated.data.level).toBe("medium");

      const del = await deletePsychosocialRiskFactorAction(created.data.id);
      expect(del.ok).toBe(true);

      const after = await listPsychosocialRiskFactorsAction({});
      expect(after.ok && after.data.total).toBe(0);
    });

    it("código sequencial (PS-01, PS-02…) incrementa por tenant", async () => {
      const a = await createPsychosocialRiskFactorAction(VALID_INPUT);
      const b = await createPsychosocialRiskFactorAction({
        ...VALID_INPUT,
        name: "Assédio moral",
      });
      expect(a.ok && a.data.number).toBe(1);
      expect(b.ok && b.data.number).toBe(2);
      expect(formatPsychosocialFactorCode(1)).toBe("PS-01");
    });

    it("busca por fator e filtro por nível", async () => {
      await createPsychosocialRiskFactorAction(VALID_INPUT);
      await createPsychosocialRiskFactorAction({
        ...VALID_INPUT,
        name: "Falta de autonomia",
        level: "low",
      });

      const byName = await listPsychosocialRiskFactorsAction({ search: "autonomia" });
      expect(byName.ok && byName.data.total).toBe(1);

      const byLevel = await listPsychosocialRiskFactorsAction({ level: "high" });
      expect(byLevel.ok && byLevel.data.total).toBe(1);
      expect(byLevel.ok && byLevel.data.rows[0].name).toBe("Sobrecarga de trabalho");
    });

    it("GES de OUTRO tenant → FK_NOT_FOUND (isolamento)", async () => {
      const foreign = await createPsychosocialRiskFactorAction({
        ...VALID_INPUT,
        gesId: PGR_IDS.gesB,
      });
      expect(foreign.ok).toBe(false);
      if (!foreign.ok) expect(foreign.error.code).toBe("FK_NOT_FOUND");
    });

    it("nível fora do enum / nome vazio → VALIDATION", async () => {
      const badLevel = await createPsychosocialRiskFactorAction({
        ...VALID_INPUT,
        level: "critical" as never,
      });
      expect(!badLevel.ok && badLevel.error.code).toBe("VALIDATION");

      const noName = await createPsychosocialRiskFactorAction({
        ...VALID_INPUT,
        name: "",
      });
      expect(!noName.ok && noName.error.code).toBe("VALIDATION");
    });

    it("get/update/delete de item de OUTRO tenant → NOT_FOUND", async () => {
      asOwner("org_b");
      const foreign = await createPsychosocialRiskFactorAction({
        ...VALID_INPUT,
        gesId: PGR_IDS.gesB,
      });
      expect(foreign.ok).toBe(true);
      if (!foreign.ok) return;

      asOwner("org_a");
      const got = await getPsychosocialRiskFactorAction(foreign.data.id);
      expect(!got.ok && got.error.code).toBe("NOT_FOUND");

      const updated = await updatePsychosocialRiskFactorAction(
        foreign.data.id,
        VALID_INPUT,
      );
      expect(!updated.ok && updated.error.code).toBe("NOT_FOUND");

      const deleted = await deletePsychosocialRiskFactorAction(foreign.data.id);
      expect(!deleted.ok && deleted.error.code).toBe("NOT_FOUND");
    });

    it("papel client → FORBIDDEN em toda ação", async () => {
      mockedGate.mockRejectedValue(new ForbiddenError());

      const created = await createPsychosocialRiskFactorAction(VALID_INPUT);
      expect(!created.ok && created.error.code).toBe("FORBIDDEN");

      const listed = await listPsychosocialRiskFactorsAction({});
      expect(!listed.ok && listed.error.code).toBe("FORBIDDEN");
    });
  },
);
