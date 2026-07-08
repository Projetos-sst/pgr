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
  addRiskEpiAction,
  listAvailableEpisForRiskAction,
  listRiskEpisAction,
  removeRiskEpiAction,
  updateRiskEpiAction,
} from "@/shared/server/actions/pgr/epi-risk";

import { adminClient, applyMigrations } from "../_helpers/db";
import { seedPgrBase, PGR_IDS } from "../_helpers/pgr-seed";

const APP_RUNTIME_URL = process.env.INTEGRATION_APP_RUNTIME_URL;
const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!APP_RUNTIME_URL && !!ADMIN_URL;

const CAT2 = "11111111-1111-1111-1111-1111111111c1";

const mockedGate = requireOfficeStaff as jest.MockedFunction<typeof requireOfficeStaff>;
const asOwner = (tenantId: string) =>
  mockedGate.mockResolvedValue({ userId: "u", tenantId, plan: "free", role: "owner" });

(shouldRun ? describe : describe.skip)("Server Actions — epi_risk (EPI × risco)", () => {
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

  it("list retorna os EPIs vinculados ao risco com nome/CA/neutralização", async () => {
    const result = await listRiskEpisAction(PGR_IDS.riskA);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(1);
      expect(result.data[0].catalogId).toBe(PGR_IDS.epiCatalogA);
      expect(result.data[0].name).toBe("Capacete CA-123");
      expect(result.data[0].neutralization).toBe("neutralizes");
    }
  });

  it("available lista EPIs não vinculados (busca nome/CA) e some após vincular", async () => {
    await admin.unsafe(`insert into public.epi_catalog (id, org_id, type, category_id, name, ca)
      values ('${CAT2}','org_a','epi','${PGR_IDS.categoryA}','Luva CA-999','999')`);

    let avail = await listAvailableEpisForRiskAction(PGR_IDS.riskA);
    expect(avail.ok && avail.data.some((o) => o.catalogId === CAT2)).toBe(true);
    // epiCatalogA já está vinculado ao riskA → não deve aparecer nos disponíveis
    expect(avail.ok && avail.data.some((o) => o.catalogId === PGR_IDS.epiCatalogA)).toBe(
      false,
    );

    // busca por CA restringe
    const searched = await listAvailableEpisForRiskAction(PGR_IDS.riskA, "999");
    expect(searched.ok && searched.data).toHaveLength(1);

    const added = await addRiskEpiAction({
      riskId: PGR_IDS.riskA,
      catalogId: CAT2,
      neutralization: "does_not_neutralize",
    });
    expect(added.ok).toBe(true);

    const list = await listRiskEpisAction(PGR_IDS.riskA);
    expect(list.ok && list.data).toHaveLength(2);

    avail = await listAvailableEpisForRiskAction(PGR_IDS.riskA);
    expect(avail.ok && avail.data.some((o) => o.catalogId === CAT2)).toBe(false);
  });

  it("vincular o mesmo EPI duas vezes ao mesmo risco → DUPLICATE", async () => {
    const result = await addRiskEpiAction({
      riskId: PGR_IDS.riskA,
      catalogId: PGR_IDS.epiCatalogA,
      neutralization: "neutralizes",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("DUPLICATE");
  });

  it("vincular a risco de OUTRO tenant → FK_NOT_FOUND", async () => {
    const result = await addRiskEpiAction({
      riskId: PGR_IDS.riskB,
      catalogId: PGR_IDS.epiCatalogA,
      neutralization: "neutralizes",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("FK_NOT_FOUND");
  });

  it("vincular EPI de OUTRO tenant → FK_NOT_FOUND", async () => {
    const result = await addRiskEpiAction({
      riskId: PGR_IDS.riskA,
      catalogId: PGR_IDS.epiCatalogB,
      neutralization: "neutralizes",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("FK_NOT_FOUND");
  });

  it("atualiza a neutralização de um vínculo", async () => {
    const linked = await listRiskEpisAction(PGR_IDS.riskA);
    expect(linked.ok).toBe(true);
    if (!linked.ok) return;
    const id = linked.data[0].id;

    const updated = await updateRiskEpiAction(id, PGR_IDS.riskA, {
      neutralization: "not_applicable",
    });
    expect(updated.ok).toBe(true);

    const after = await listRiskEpisAction(PGR_IDS.riskA);
    expect(after.ok && after.data[0].neutralization).toBe("not_applicable");
  });

  it("remove o vínculo e o EPI volta a ficar disponível", async () => {
    const linked = await listRiskEpisAction(PGR_IDS.riskA);
    if (!linked.ok) return;
    const id = linked.data[0].id;

    const removed = await removeRiskEpiAction(id, PGR_IDS.riskA);
    expect(removed.ok).toBe(true);

    const after = await listRiskEpisAction(PGR_IDS.riskA);
    expect(after.ok && after.data).toHaveLength(0);

    const avail = await listAvailableEpisForRiskAction(PGR_IDS.riskA);
    expect(avail.ok && avail.data.some((o) => o.catalogId === PGR_IDS.epiCatalogA)).toBe(
      true,
    );
  });

  it("list de risco de outro tenant não vaza vínculos (isolamento)", async () => {
    const result = await listRiskEpisAction(PGR_IDS.riskB);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toHaveLength(0);
  });

  it("update/remove de vínculo inexistente/cross-tenant → NOT_FOUND", async () => {
    const fakeId = "99999999-9999-9999-9999-999999999999";
    const upd = await updateRiskEpiAction(fakeId, PGR_IDS.riskA, {
      neutralization: "neutralizes",
    });
    expect(upd.ok).toBe(false);
    if (!upd.ok) expect(upd.error.code).toBe("NOT_FOUND");

    const del = await removeRiskEpiAction(fakeId, PGR_IDS.riskA);
    expect(del.ok).toBe(false);
    if (!del.ok) expect(del.error.code).toBe("NOT_FOUND");
  });

  it("papel client → FORBIDDEN", async () => {
    mockedGate.mockRejectedValue(new ForbiddenError());
    const result = await listRiskEpisAction(PGR_IDS.riskA);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("FORBIDDEN");
  });
});
