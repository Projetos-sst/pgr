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
  getEsocialConfigAction,
  getEsocialEventCountsAction,
  saveEsocialConfigAction,
} from "@/shared/server/actions/esocial/config";
import type { EsocialConfigInput } from "@/shared/domains/esocial/config";

import { adminClient, applyMigrations } from "../_helpers/db";
import { seedPgrBase } from "../_helpers/pgr-seed";

const APP_RUNTIME_URL = process.env.INTEGRATION_APP_RUNTIME_URL;
const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!APP_RUNTIME_URL && !!ADMIN_URL;

const mockedGate = requireOfficeStaff as jest.MockedFunction<typeof requireOfficeStaff>;
const asOwner = (tenantId: string) =>
  mockedGate.mockResolvedValue({ userId: "u", tenantId, plan: "free", role: "owner" });

const VALID: EsocialConfigInput = {
  environment: "production",
  employerCnpj: "12.345.678/0001-90",
  taxClassification: "01 — Lucro Real",
  certificateName: "EMPRESA_A1.pfx",
  certificateExpiresAt: "2026-11-18",
  enabledEvents: ["S-2210", "S-2240"],
  autoSend: true,
  checkFrequencyHours: 6,
};

(shouldRun ? describe : describe.skip)(
  "Server Actions — eSocial config (singleton por tenant)",
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

    it("get retorna null antes do primeiro salvamento; save cria; save de novo atualiza (mesma linha)", async () => {
      const before = await getEsocialConfigAction();
      expect(before.ok && before.data).toBeNull();

      const created = await saveEsocialConfigAction(VALID);
      expect(created.ok).toBe(true);
      if (!created.ok) return;
      expect(created.data.orgId).toBe("org_a");
      expect(created.data.environment).toBe("production");
      expect(created.data.enabledEvents).toEqual(["S-2210", "S-2240"]);
      expect(created.data.autoSend).toBe(true);
      const firstId = created.data.id;

      const updated = await saveEsocialConfigAction({
        ...VALID,
        environment: "homologation",
        autoSend: false,
        checkFrequencyHours: 24,
      });
      expect(updated.ok).toBe(true);
      if (!updated.ok) return;
      expect(updated.data.id).toBe(firstId); // upsert: mesma linha
      expect(updated.data.environment).toBe("homologation");
      expect(updated.data.autoSend).toBe(false);

      // Continua singleton: apenas 1 linha no tenant.
      const [{ n }] = await admin.unsafe(
        `select count(*)::int n from public.esocial_config where org_id='org_a'`,
      );
      expect(n).toBe(1);
    });

    it("config é isolada por tenant (org_b não enxerga a de org_a)", async () => {
      await saveEsocialConfigAction(VALID);

      asOwner("org_b");
      const other = await getEsocialConfigAction();
      expect(other.ok && other.data).toBeNull();

      const ownB = await saveEsocialConfigAction({
        ...VALID,
        environment: "homologation",
      });
      expect(ownB.ok && ownB.data.orgId).toBe("org_b");

      asOwner("org_a");
      const mine = await getEsocialConfigAction();
      expect(mine.ok && mine.data?.environment).toBe("production");
    });

    it("ambiente inválido → VALIDATION", async () => {
      const bad = await saveEsocialConfigAction({
        ...VALID,
        environment: "staging" as never,
      });
      expect(!bad.ok && bad.error.code).toBe("VALIDATION");
    });

    it("contagem de eventos é real e escopada ao tenant", async () => {
      await admin.unsafe(`
        insert into public.esocial_events (org_id, event_type, payload, status) values
          ('org_a','S-2210','<x/>','pending'),
          ('org_a','S-2240','<x/>','sent'),
          ('org_b','S-2210','<x/>','pending');
      `);
      const counts = await getEsocialEventCountsAction();
      expect(counts.ok && counts.data).toEqual({ pending: 1, sent: 1, total: 2 });
    });

    it("papel client → FORBIDDEN", async () => {
      mockedGate.mockRejectedValue(new ForbiddenError());
      const r = await saveEsocialConfigAction(VALID);
      expect(!r.ok && r.error.code).toBe("FORBIDDEN");
      const g = await getEsocialConfigAction();
      expect(!g.ok && g.error.code).toBe("FORBIDDEN");
    });
  },
);
