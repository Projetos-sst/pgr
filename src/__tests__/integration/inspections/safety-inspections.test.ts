/**
 * Integração da inspeção de segurança + ocorrências (fatia 039) contra Postgres
 * efêmero. Cobre create (empresa opcional/validação), saveOccurrences (replace +
 * completed), filtro por categoria e isolamento cross-tenant.
 */
import type postgres from "postgres";

jest.mock("@/shared/db/env", () => ({
  getDatabaseUrl: () => process.env.INTEGRATION_APP_RUNTIME_URL,
}));

import {
  createSafetyInspection,
  deleteSafetyInspection,
  getSafetyInspection,
  listSafetyInspections,
  saveOccurrences,
  updateSafetyInspectionHeader,
} from "@/shared/db/repositories/safety-inspections";

import { adminClient, applyMigrations } from "../_helpers/db";
import { seedPgrBase } from "../_helpers/pgr-seed";

const APP_RUNTIME_URL = process.env.INTEGRATION_APP_RUNTIME_URL;
const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!APP_RUNTIME_URL && !!ADMIN_URL;

const COMPANY_A = "11111111-1111-1111-1111-111111111111"; // do seed (companyA org_a)
const COMPANY_B = "22222222-2222-2222-2222-222222222222"; // companyB org_b

(shouldRun ? describe : describe.skip)("inspeção de segurança + ocorrências", () => {
  let admin: ReturnType<typeof postgres>;

  beforeAll(async () => {
    admin = adminClient();
    await applyMigrations(admin);
    await seedPgrBase(admin);
  });

  afterAll(async () => {
    await admin.end();
  });

  it("cria com empresa do tenant e sem empresa", async () => {
    const withCompany = await createSafetyInspection("org_a", {
      category: "safety",
      inspectedAt: "2026-07-15",
      planned: true,
      area: "Almoxarifado",
      companyId: COMPANY_A,
    });
    expect(withCompany).not.toBeNull();
    const detail = await getSafetyInspection("org_a", withCompany!.id);
    expect(detail!.company?.id).toBe(COMPANY_A);
    expect(detail!.inspection.status).toBe("in_progress");

    const noCompany = await createSafetyInspection("org_a", {
      category: "environment",
      inspectedAt: "2026-07-15",
      planned: false,
      companyId: null,
    });
    expect(noCompany).not.toBeNull();
  });

  it("empresa de outro tenant → null (FK_NOT_FOUND)", async () => {
    const created = await createSafetyInspection("org_a", {
      category: "safety",
      inspectedAt: "2026-07-15",
      planned: false,
      companyId: COMPANY_B,
    });
    expect(created).toBeNull();
  });

  it("saveOccurrences substitui e conclui (completed)", async () => {
    const created = await createSafetyInspection("org_a", {
      category: "safety",
      inspectedAt: "2026-07-15",
      planned: false,
    });
    const ok = await saveOccurrences("org_a", created!.id, {
      occurrences: [
        { description: "Piso escorregadio", severity: "high" },
        { description: "Falta EPI", severity: "medium" },
      ],
    });
    expect(ok).toBe(true);
    const detail = await getSafetyInspection("org_a", created!.id);
    expect(detail!.inspection.status).toBe("completed");
    expect(detail!.occurrences).toHaveLength(2);

    // replace: nova gravação zera e regrava
    await saveOccurrences("org_a", created!.id, {
      occurrences: [{ description: "Só uma", severity: null }],
    });
    const after = await getSafetyInspection("org_a", created!.id);
    expect(after!.occurrences).toHaveLength(1);
    expect(after!.occurrences[0].severity).toBeNull();
  });

  it("filtro por categoria + isolamento cross-tenant", async () => {
    const safety = await listSafetyInspections("org_a", { category: "safety" });
    expect(safety.rows.every((r) => r.category === "safety")).toBe(true);

    const created = await createSafetyInspection("org_a", {
      category: "safety",
      inspectedAt: "2026-07-15",
      planned: false,
    });
    expect(await getSafetyInspection("org_b", created!.id)).toBeNull();
    expect(
      await updateSafetyInspectionHeader("org_b", created!.id, {
        category: "safety",
        inspectedAt: "2026-07-15",
        planned: false,
      }),
    ).toBe(false);
    expect(await deleteSafetyInspection("org_b", created!.id)).toBe(false);
    expect(await deleteSafetyInspection("org_a", created!.id)).toBe(true);
  });
});
