/**
 * Regra de status da medida de controle por nível de risco (issue #42, lote 029) contra
 * Postgres efêmero. `riskAssessmentA` (seed) pertence a `riskA`/org_a; cada teste ajusta
 * `result` (a classificação vigente) via conexão admin antes de exercer a Server Action —
 * mesma técnica de `beforeEach(seedPgrBase)` + ajuste pontual usada nos vizinhos.
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
import {
  createControlMeasureAction,
  updateControlMeasureAction,
} from "@/shared/server/actions/pgr/control-measures";
import type { ControlMeasureInput } from "@/shared/domains/pgr/control-measure";

import { adminClient, applyMigrations } from "../_helpers/db";
import { seedPgrBase, PGR_IDS } from "../_helpers/pgr-seed";

const APP_RUNTIME_URL = process.env.INTEGRATION_APP_RUNTIME_URL;
const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!APP_RUNTIME_URL && !!ADMIN_URL;

const mockedGate = requireOfficeStaff as jest.MockedFunction<typeof requireOfficeStaff>;

function asOwner(tenantId: string) {
  mockedGate.mockResolvedValue({ userId: "u", tenantId, plan: "free", role: "owner" });
}

/** Nível não usado pelo seed (controlMeasureA = elimination@riskA). */
function createInput(overrides: Partial<ControlMeasureInput> = {}): ControlMeasureInput {
  return {
    controlLevel: "collective_protection",
    applicable: false,
    ...overrides,
  };
}

(shouldRun ? describe : describe.skip)(
  "Regra de status da medida de controle por nível de risco (#42)",
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

    async function setRiskAClassification(result: string | null): Promise<void> {
      await admin`
        update public.risk_assessments set result = ${result}
        where id = ${PGR_IDS.riskAssessmentA}
      `;
    }

    it("risco trivial: status default vira 'maintain' quando não informado", async () => {
      await setRiskAClassification("trivial");
      const created = await createControlMeasureAction(PGR_IDS.riskA, createInput());
      expect(created.ok).toBe(true);
      if (created.ok) expect(created.data.status).toBe("maintain");
    });

    it("risco tolerável: status default vira 'maintain'", async () => {
      await setRiskAClassification("tolerable");
      const created = await createControlMeasureAction(PGR_IDS.riskA, createInput());
      expect(created.ok).toBe(true);
      if (created.ok) expect(created.data.status).toBe("maintain");
    });

    it("risco moderado, medida aplicável, sem responsável/prazo → VALIDATION", async () => {
      await setRiskAClassification("moderate");
      const result = await createControlMeasureAction(
        PGR_IDS.riskA,
        createInput({
          applicable: true,
          actionWhat: "Treinar equipe",
          actionHow: "Curso NR-01",
        }),
      );
      expect(!result.ok && result.error.code).toBe("VALIDATION");
    });

    it("risco moderado, medida aplicável, com responsável+prazo → cria com status 'introduced'", async () => {
      await setRiskAClassification("moderate");
      const created = await createControlMeasureAction(
        PGR_IDS.riskA,
        createInput({
          applicable: true,
          actionWhat: "Treinar equipe",
          actionHow: "Curso NR-01",
          actionResponsible: "Ana Lima",
          actionDeadline: "2026-10-01",
        }),
      );
      expect(created.ok).toBe(true);
      if (created.ok) expect(created.data.status).toBe("introduced");
    });

    it("risco intolerável, medida NÃO aplicável: não exige responsável/prazo (regra é condicional a applicable)", async () => {
      await setRiskAClassification("intolerable");
      const created = await createControlMeasureAction(
        PGR_IDS.riskA,
        createInput({ applicable: false }),
      );
      expect(created.ok).toBe(true);
      if (created.ok) {
        expect(created.data.status).toBe("introduced");
        expect(created.data.actionResponsible).toBeNull();
      }
    });

    it("sem avaliação vigente (result null): não força default nem bloqueia", async () => {
      await setRiskAClassification(null);
      const created = await createControlMeasureAction(
        PGR_IDS.riskA,
        createInput({
          applicable: true,
          actionWhat: "Treinar equipe",
          actionHow: "Curso NR-01",
        }),
      );
      expect(created.ok).toBe(true);
      if (created.ok) expect(created.data.status).toBeNull();
    });

    it("status explícito informado pelo cliente vence o default (ex.: 'improved')", async () => {
      await setRiskAClassification("trivial");
      const created = await createControlMeasureAction(
        PGR_IDS.riskA,
        createInput({ status: "improved" }),
      );
      expect(created.ok).toBe(true);
      if (created.ok) expect(created.data.status).toBe("improved");
    });

    it("update: risco moderado, medida aplicável, sem prazo → VALIDATION", async () => {
      await setRiskAClassification("moderate");
      const updated = await updateControlMeasureAction(
        PGR_IDS.riskA,
        PGR_IDS.controlMeasureA,
        createInput({
          applicable: true,
          actionWhat: "Enclausuramento",
          actionHow: "Projeto acústico",
          actionResponsible: "Maria Souza",
        }),
      );
      expect(!updated.ok && updated.error.code).toBe("VALIDATION");
    });

    it("update: risco moderado, medida aplicável, com responsável+prazo → status 'introduced'", async () => {
      await setRiskAClassification("substantial");
      const updated = await updateControlMeasureAction(
        PGR_IDS.riskA,
        PGR_IDS.controlMeasureA,
        createInput({
          applicable: true,
          actionWhat: "Enclausuramento",
          actionHow: "Projeto acústico",
          actionResponsible: "Maria Souza",
          actionDeadline: "2026-09-30",
        }),
      );
      expect(updated.ok).toBe(true);
      if (updated.ok) expect(updated.data.status).toBe("introduced");
    });
  },
);
