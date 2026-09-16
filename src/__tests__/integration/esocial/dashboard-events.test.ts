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
  getEsocialDashboardAction,
  listEventsAction,
} from "@/shared/server/actions/esocial/events";

import { adminClient, applyMigrations } from "../_helpers/db";
import { seedPgrBase, PGR_IDS } from "../_helpers/pgr-seed";

const APP_RUNTIME_URL = process.env.INTEGRATION_APP_RUNTIME_URL;
const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!APP_RUNTIME_URL && !!ADMIN_URL;

const mockedGate = requireOfficeStaff as jest.MockedFunction<typeof requireOfficeStaff>;
const asOwner = (tenantId: string) =>
  mockedGate.mockResolvedValue({ userId: "u", tenantId, plan: "free", role: "owner" });

const BATCH_A = "cc000000-0000-4000-8000-0000000000b1";

(shouldRun ? describe : describe.skip)(
  "eSocial — painel agregado (#218) e colunas de eventos (#217)",
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

    it("painel sem eventos: zeros e conformidade null (sem divisão por zero)", async () => {
      const r = await getEsocialDashboardAction();
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.data.total).toBe(0);
      expect(r.data.transmitted).toBe(0);
      expect(r.data.pending).toBe(0);
      expect(r.data.failed).toBe(0);
      expect(r.data.conformityPercent).toBeNull();
      expect(r.data.recent).toEqual([]);
      // Catálogo completo de tipos, todos com 0.
      expect(r.data.byType.length).toBeGreaterThanOrEqual(7);
      expect(r.data.byType.every((t) => t.count === 0)).toBe(true);
    });

    it("KPIs por bucket, contagem por tipo e conformidade reais", async () => {
      await admin.unsafe(`
        insert into public.esocial_events (org_id, event_type, payload, status) values
          ('org_a','S-2210','<x/>','pending'),
          ('org_a','S-2220','<x/>','draft'),
          ('org_a','S-2220','<x/>','sent'),
          ('org_a','S-2240','<x/>','accepted'),
          ('org_a','S-2240','<x/>','accepted'),
          ('org_a','S-2240','<x/>','rejected'),
          ('org_a','S-2300','<x/>','error'),
          ('org_b','S-2210','<x/>','accepted');
      `);
      const r = await getEsocialDashboardAction();
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      // org_b NÃO entra (isolamento).
      expect(r.data.total).toBe(7);
      expect(r.data.pending).toBe(2); // pending + draft
      expect(r.data.transmitted).toBe(3); // sent + accepted*2
      expect(r.data.failed).toBe(2); // rejected + error
      // conformidade = aceitos / (aceitos+rejeitados+erro) = 2/4 = 50%
      expect(r.data.conformityPercent).toBe(50);

      const byType = Object.fromEntries(r.data.byType.map((t) => [t.eventType, t.count]));
      expect(byType["S-2240"]).toBe(3);
      expect(byType["S-2220"]).toBe(2);
      expect(byType["S-2210"]).toBe(1);
      expect(byType["S-2190"]).toBe(0);
    });

    it("lista traz Protocolo e Data Envio do lote, sem duplicar a linha do evento", async () => {
      await admin.unsafe(`
        insert into public.esocial_batches (id, org_id, protocol_number, status, sent_at)
          values ('${BATCH_A}','org_a','PROT-XYZ','sent','2026-07-11T09:30:00Z');
        insert into public.esocial_events (org_id, event_type, payload, status, batch_id, reference_id) values
          ('org_a','S-2220','<x/>','sent','${BATCH_A}','${PGR_IDS.employeeA}'),
          ('org_a','S-2210','<x/>','pending',null,'${PGR_IDS.employeeA}');
      `);
      const r = await listEventsAction({});
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.data.total).toBe(2); // sem fan-out do JOIN

      const withBatch = r.data.rows.find((e) => e.eventType === "S-2220")!;
      expect(withBatch.protocolNumber).toBe("PROT-XYZ");
      expect(withBatch.sentAt).not.toBeNull();
      expect(withBatch.employeeName).toBe("Func A");
      expect(withBatch.description).toBe("Monitoramento da Saúde do Trabalhador");

      const noBatch = r.data.rows.find((e) => e.eventType === "S-2210")!;
      expect(noBatch.protocolNumber).toBeNull();
      expect(noBatch.sentAt).toBeNull();
    });

    it("S-2240 não exibe funcionário (reference_id é risco), sem inventar dado", async () => {
      await admin.unsafe(`
        insert into public.esocial_events (org_id, event_type, payload, status, reference_id)
          values ('org_a','S-2240','<x/>','pending','${PGR_IDS.riskA}');
      `);
      const r = await listEventsAction({});
      expect(r.ok && r.data.rows[0].employeeName).toBeNull();
    });

    it("funcionário de OUTRO tenant nunca vaza no join", async () => {
      await admin.unsafe(`
        insert into public.esocial_events (org_id, event_type, payload, status, reference_id)
          values ('org_a','S-2220','<x/>','pending','${PGR_IDS.employeeB}');
      `);
      const r = await listEventsAction({});
      expect(r.ok && r.data.rows[0].employeeName).toBeNull();
    });

    it("filtro por status continua funcionando com os joins", async () => {
      await admin.unsafe(`
        insert into public.esocial_events (org_id, event_type, payload, status) values
          ('org_a','S-2210','<x/>','pending'),
          ('org_a','S-2220','<x/>','accepted');
      `);
      const r = await listEventsAction({ status: "accepted" });
      expect(r.ok && r.data.total).toBe(1);
      expect(r.ok && r.data.rows[0].eventType).toBe("S-2220");
    });

    it("papel client → FORBIDDEN no painel", async () => {
      mockedGate.mockRejectedValue(new ForbiddenError());
      const r = await getEsocialDashboardAction();
      expect(!r.ok && r.error.code).toBe("FORBIDDEN");
    });
  },
);
