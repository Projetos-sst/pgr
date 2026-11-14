import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

jest.mock("@/shared/db/env", () => ({
  getDatabaseUrl: () => process.env.INTEGRATION_APP_RUNTIME_URL,
}));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("@/shared/integrations/pdf/gotenberg", () => ({ docxToPdf: jest.fn() }));
jest.mock("@/shared/integrations/storage/company-logo-storage", () => ({
  downloadCompanyLogo: jest.fn().mockResolvedValue(null),
}));
jest.mock("@/shared/integrations/storage/documents-storage", () => ({
  slugifyFileName: (name: string) => name.toLowerCase().replace(/[^a-z0-9.]+/g, "-"),
}));
const mockStaff = jest.fn();
jest.mock("@/shared/auth/require-office-staff", () => ({
  OFFICE_STAFF_ROLES: new Set(["owner", "collaborator"]),
  requireOfficeStaff: () => mockStaff(),
}));

import { adminClient, applyMigrations } from "../_helpers/db";
import { PGR_IDS as I } from "../_helpers/pgr-seed";
import {
  OTHER_COMPANY,
  UNKNOWN_ID,
  acting,
  clientUser,
  collaborator,
  contractOffer,
  devRequest,
  errorCode,
  outsider,
  owner,
  seedCommercialBase,
} from "../_helpers/commercial-seed";
import * as core from "@/shared/server/commercial/commercial-core";
import {
  getCommercialTrialAction,
  listCommercialTrialsAction,
  startCommercialTrialAction,
} from "@/shared/server/actions/commercial/commercial";
import { generatePgrDocx } from "@/shared/server/platform/pgr-docx-core";
import * as trialsRoute from "@/app/api/v1/commercial-trials/route";
import * as trialRoute from "@/app/api/v1/commercial-trials/[companyId]/route";

const enabled =
  !!process.env.INTEGRATION_APP_RUNTIME_URL && !!process.env.INTEGRATION_DATABASE_URL;
const START = new Date("2026-11-01T12:00:00Z");
const DURING = new Date("2026-11-10T12:00:00Z");
const AFTER = new Date("2026-12-10T12:00:00Z");

(enabled ? describe : describe.skip)("período de teste por empresa", () => {
  let admin: ReturnType<typeof postgres>;
  const oldEnv = { ...process.env };

  const start = (companyId: string, ctx = owner, now = START) =>
    acting(ctx, (actor) => core.startCompanyTrial(actor, { companyId }, now));
  const get = (companyId: string, ctx = owner, now = DURING) =>
    acting(ctx, (actor) => core.getCompanyTrial(actor, companyId, now));
  const list = (ctx = owner) => acting(ctx, (actor) => core.listCompanyTrials(actor, {}));
  const gate = (now: Date, pgrId = I.pgrA) =>
    acting(owner, () => core.assertPgrEmissionAllowed({ orgId: "org_a", pgrId, now }));
  const issue = () =>
    acting(owner, () => generatePgrDocx("org_a", I.pgrA, { purpose: "issue" }));
  const rows = () =>
    admin`select company_id as "companyId", started_at as "startedAt", ends_at as "endsAt", days
      from commercial_trials order by company_id`;
  const entitle = (contractId: string, service: string, companyId: string | null) =>
    admin`insert into commercial_entitlements (org_id, contract_id, company_id, service, status, reason, applied)
      values ('org_a', ${contractId}, ${companyId}, ${service}, 'active', 'subscription_active', true)`;

  beforeAll(async () => {
    admin = adminClient();
    await admin`set client_min_messages=warning`;
    await applyMigrations(admin);
  });
  afterAll(async () => {
    process.env = oldEnv;
    await admin.end({ timeout: 5 });
  });
  beforeEach(async () => {
    await seedCommercialBase(admin);
    await admin`delete from commercial_trials`;
    await admin`delete from commercial_entitlements`;
    await admin`insert into company_modules (org_id, company_id, module, enabled)
      values ('org_a', ${I.companyA}, 'pgr', true)`;
    mockStaff.mockReset();
    mockStaff.mockResolvedValue(owner);
    process.env.APP_ENV = "local";
    process.env.DEV_API_AUTH_BYPASS = "true";
    process.env.COMMERCIAL_CATALOG_ENABLED = "true";
  });

  describe("janela", () => {
    it("abre com 15 dias definidos no servidor", async () => {
      const result = await start(I.companyA);
      expect(result.created).toBe(true);
      expect(result.trial).toMatchObject({
        companyId: I.companyA,
        days: 15,
        startedBy: "owner",
        status: "active",
        convertedAt: null,
      });
      expect(result.trial.endsAt.toISOString()).toBe("2026-11-16T12:00:00.000Z");
    });

    it("repetir não reinicia a janela", async () => {
      const first = await start(I.companyA);
      const later = new Date("2026-11-08T12:00:00Z");
      const second = await start(I.companyA, owner, later);
      expect(second.created).toBe(false);
      expect(second.trial.id).toBe(first.trial.id);
      expect(second.trial.startedAt.getTime()).toBe(START.getTime());
      expect(second.trial.endsAt.getTime()).toBe(first.trial.endsAt.getTime());
      expect(await rows()).toHaveLength(1);
    });

    it("expira pelo relógio injetado", async () => {
      await start(I.companyA);
      expect((await get(I.companyA, owner, DURING)).status).toBe("active");
      expect((await get(I.companyA, owner, AFTER)).status).toBe("expired");
    });

    it("empresa sem teste dá NOT_FOUND na consulta", async () => {
      expect(await errorCode(() => get(I.companyA))).toBe("NOT_FOUND");
    });

    it("lista paginada por escritório", async () => {
      await start(I.companyA);
      await start(OTHER_COMPANY);
      expect((await list()).total).toBe(2);
      expect((await list(collaborator)).total).toBe(2);
      expect((await list(outsider)).total).toBe(0);
    });
  });

  describe("emissão final", () => {
    it("empresa sem teste segue como hoje (validação normal, sem bloqueio)", async () => {
      await gate(AFTER);
      expect(await errorCode(issue)).toBe("VALIDATION");
    });

    it("teste ativo ou expirado sem direito pago bloqueia a emissão final", async () => {
      await start(I.companyA);
      expect(await errorCode(() => gate(DURING))).toBe("EMISSION_BLOCKED");
      expect(await errorCode(() => gate(AFTER))).toBe("EMISSION_BLOCKED");
      expect(await errorCode(issue)).toBe("EMISSION_BLOCKED");
    });

    it("a prévia (sem purpose) segue livre durante o teste", async () => {
      await start(I.companyA);
      const preview = await acting(owner, () => generatePgrDocx("org_a", I.pgrA));
      expect(preview.file.length).toBeGreaterThan(0);
    });

    it("direito pago de PGR libera", async () => {
      const contract = await contractOffer(drizzle(admin), "pgr");
      await start(I.companyA);
      await entitle(contract.id, "pgr", I.companyA);
      await gate(AFTER);
      expect(await errorCode(issue)).toBe("VALIDATION");
    });

    it("só Medicina paga e Pro do escritório não liberam o PGR", async () => {
      const contract = await contractOffer(drizzle(admin), "pgr");
      await start(I.companyA);
      await entitle(contract.id, "medicine", I.companyA);
      await entitle(contract.id, "pro", null);
      expect(await errorCode(() => gate(AFTER))).toBe("EMISSION_BLOCKED");
    });

    it("direito pago de PGR de outra empresa não libera", async () => {
      const contract = await contractOffer(drizzle(admin), "pgr");
      await start(I.companyA);
      await entitle(contract.id, "pgr", OTHER_COMPANY);
      expect(await errorCode(() => gate(AFTER))).toBe("EMISSION_BLOCKED");
    });

    it("flag desligada segue como hoje mesmo com teste ativo", async () => {
      await start(I.companyA);
      process.env.COMMERCIAL_CATALOG_ENABLED = "false";
      await gate(AFTER);
      expect(await errorCode(issue)).toBe("VALIDATION");
    });

    it("PGR de outro escritório dá NOT_FOUND na geração", async () => {
      expect(
        await errorCode(() =>
          acting(outsider, () => generatePgrDocx("org_b", I.pgrA, { purpose: "issue" })),
        ),
      ).toBe("NOT_FOUND");
    });
  });

  describe("papéis e isolamento", () => {
    it("collaborator consulta mas não abre teste", async () => {
      await start(I.companyA);
      expect((await get(I.companyA, collaborator)).companyId).toBe(I.companyA);
      expect(await errorCode(() => start(OTHER_COMPANY, collaborator))).toBe("FORBIDDEN");
    });

    it("client recebe FORBIDDEN em tudo", async () => {
      await start(I.companyA);
      expect(await errorCode(() => start(OTHER_COMPANY, clientUser))).toBe("FORBIDDEN");
      expect(await errorCode(() => get(I.companyA, clientUser))).toBe("FORBIDDEN");
      expect(await errorCode(() => list(clientUser))).toBe("FORBIDDEN");
    });

    it("empresa de outro escritório ou inexistente dá NOT_FOUND", async () => {
      expect(await errorCode(() => start(I.companyB))).toBe("NOT_FOUND");
      expect(await errorCode(() => start(UNKNOWN_ID))).toBe("NOT_FOUND");
      await start(I.companyA);
      expect(await errorCode(() => get(I.companyA, outsider))).toBe("NOT_FOUND");
    });

    it("recusa campos além de companyId e id inválido", async () => {
      expect(
        await errorCode(() =>
          acting(owner, (actor) =>
            core.startCompanyTrial(actor, { companyId: I.companyA, days: 1 }),
          ),
        ),
      ).toBe("VALIDATION");
      expect(await errorCode(() => get("x"))).toBe("VALIDATION");
      expect(await rows()).toHaveLength(0);
    });

    it("com a flag desligada as consultas respondem FORBIDDEN", async () => {
      await start(I.companyA);
      process.env.COMMERCIAL_CATALOG_ENABLED = "false";
      expect(await errorCode(() => get(I.companyA))).toBe("FORBIDDEN");
      expect(await errorCode(() => list())).toBe("FORBIDDEN");
      expect(await errorCode(() => start(OTHER_COMPANY))).toBe("FORBIDDEN");
    });
  });

  describe("Server Actions", () => {
    it("devolvem o contrato ActionResult", async () => {
      expect(await startCommercialTrialAction({ companyId: I.companyA })).toMatchObject({
        ok: true,
        data: { created: true },
      });
      expect(await listCommercialTrialsAction()).toMatchObject({
        ok: true,
        data: { total: 1 },
      });
      expect(await getCommercialTrialAction(I.companyA)).toMatchObject({ ok: true });
      mockStaff.mockResolvedValue(clientUser);
      expect(await listCommercialTrialsAction()).toMatchObject({
        ok: false,
        error: { code: "FORBIDDEN" },
      });
    });
  });

  describe("REST /api/v1/commercial-trials", () => {
    it("POST responde 201 ao abrir e 200 ao repetir", async () => {
      const body = { companyId: I.companyA };
      const created = await trialsRoute.POST(
        devRequest("/api/v1/commercial-trials", "POST", body),
      );
      expect(created.status).toBe(201);
      const again = await trialsRoute.POST(
        devRequest("/api/v1/commercial-trials", "POST", body),
      );
      expect(again.status).toBe(200);
      expect((await again.json()).created).toBe(false);
    });

    it("POST responde 403 para collaborator e 404 para empresa de outro escritório", async () => {
      const forbidden = await trialsRoute.POST(
        devRequest(
          "/api/v1/commercial-trials",
          "POST",
          { companyId: I.companyA },
          "collaborator",
        ),
      );
      expect(forbidden.status).toBe(403);
      const missing = await trialsRoute.POST(
        devRequest("/api/v1/commercial-trials", "POST", { companyId: I.companyB }),
      );
      expect(missing.status).toBe(404);
    });

    it("GET lista e GET por empresa", async () => {
      await start(I.companyA);
      const listed = await trialsRoute.GET(
        devRequest("/api/v1/commercial-trials", "GET", undefined, "collaborator"),
      );
      expect(listed.status).toBe(200);
      expect((await listed.json()).total).toBe(1);
      const url = `/api/v1/commercial-trials/${I.companyA}`;
      const one = await trialRoute.GET(devRequest(url, "GET"), {
        params: Promise.resolve({ companyId: I.companyA }),
      });
      expect(one.status).toBe(200);
      const cross = await trialRoute.GET(
        devRequest(url, "GET", undefined, "owner", "org_b"),
        { params: Promise.resolve({ companyId: I.companyA }) },
      );
      expect(cross.status).toBe(404);
    });
  });

  describe("banco", () => {
    it("o UNIQUE impede segunda janela e o CHECK recusa fim antes do início", async () => {
      await admin.unsafe(
        `insert into commercial_trials (org_id, company_id, started_at, ends_at, days, started_by)
         values ('org_a', '${I.companyA}', now(), now() + interval '1 day', 1, 'owner')`,
      );
      await expect(
        admin.unsafe(
          `insert into commercial_trials (org_id, company_id, started_at, ends_at, days, started_by)
           values ('org_a', '${I.companyA}', now(), now() + interval '1 day', 1, 'owner')`,
        ),
      ).rejects.toMatchObject({ code: "23505" });
      await expect(
        admin.unsafe(
          `insert into commercial_trials (org_id, company_id, started_at, ends_at, days, started_by)
           values ('org_a', '${OTHER_COMPANY}', now(), now() - interval '1 day', 1, 'owner')`,
        ),
      ).rejects.toMatchObject({ code: "23514" });
    });

    it("recusa empresa de outro escritório", async () => {
      await expect(
        admin.unsafe(
          `insert into commercial_trials (org_id, company_id, started_at, ends_at, days, started_by)
           values ('org_a', '${I.companyB}', now(), now() + interval '1 day', 1, 'owner')`,
        ),
      ).rejects.toMatchObject({ code: "23503" });
    });
  });
});
