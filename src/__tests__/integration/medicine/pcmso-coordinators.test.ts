import type postgres from "postgres";
import { NextRequest } from "next/server";
jest.mock("@/shared/db/env", () => ({
  getDatabaseUrl: () => process.env.INTEGRATION_APP_RUNTIME_URL,
}));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("@/shared/auth/require-office-staff", () => ({
  OFFICE_STAFF_ROLES: new Set(["owner", "collaborator"]),
  requireOfficeStaff: jest.fn(),
}));
import { requireOfficeStaff } from "@/shared/auth/require-office-staff";
import type { TenantContext } from "@/shared/auth/require-tenant-context";
import {
  closeCoordinator,
  designateCoordinator,
  listCoordinators,
} from "@/shared/server/medicine/pcmso-coordinator-core";
import {
  designatePcmsoCoordinatorAction,
  listPcmsoCoordinatorsAction,
} from "@/shared/server/actions/medicine/pcmso-coordinators";
import { deleteMedicoAction } from "@/shared/server/actions/pgr/medicos";
import { SWITCH_END_REASON } from "@/shared/domains/medicine/pcmso-coordinators";
import {
  GET as LIST,
  POST as DESIGNATE,
} from "@/app/api/v1/companies/[id]/pcmso-coordinators/route";
import { GET as SHOW, PUT as CLOSE } from "@/app/api/v1/pcmso-coordinators/[id]/route";
import { adminClient, applyMigrations } from "../_helpers/db";
import { seedPgrBase, PGR_IDS as I } from "../_helpers/pgr-seed";

// Dados 100% fictícios (MED-22): nenhum nome, CRM ou RQE real.
const enabled =
  !!process.env.INTEGRATION_APP_RUNTIME_URL && !!process.env.INTEGRATION_DATABASE_URL;
const owner: TenantContext = {
  tenantId: "org_a",
  userId: "owner",
  role: "owner",
  plan: "free",
};
const collaborator: TenantContext = { ...owner, userId: "staff", role: "collaborator" };
const ownerB: TenantContext = {
  tenantId: "org_b",
  userId: "owner-b",
  role: "owner",
  plan: "pro",
};

const M = {
  withRqe: "aaaaaaaa-0000-4000-8000-000000000001",
  withRqe2: "aaaaaaaa-0000-4000-8000-000000000002",
  noRqe: "aaaaaaaa-0000-4000-8000-000000000003",
  psychologist: "aaaaaaaa-0000-4000-8000-000000000004",
  inactive: "aaaaaaaa-0000-4000-8000-000000000005",
  noUf: "aaaaaaaa-0000-4000-8000-000000000006",
  otherTenant: "bbbbbbbb-0000-4000-8000-000000000001",
};

const request = (ctx: TenantContext, method: string, body?: unknown) =>
  new NextRequest("http://localhost/api/v1/pcmso-coordinators", {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      "x-dev-tenant": ctx.tenantId,
      "x-dev-user": ctx.userId,
      "x-dev-role": ctx.role,
    },
  });
const params = (id: string) => ({ params: Promise.resolve({ id }) });

(enabled ? describe : describe.skip)(
  "PCMSO coordinator designation (MED-02, NOB-121)",
  () => {
    let admin: ReturnType<typeof postgres>;
    let runtime: ReturnType<typeof postgres>;
    const originalEnv = { ...process.env };

    beforeAll(async () => {
      admin = adminClient();
      await admin`set client_min_messages = warning`;
      await applyMigrations(admin);
      runtime = (await import("postgres")).default(
        process.env.INTEGRATION_APP_RUNTIME_URL!,
        {
          max: 1,
          prepare: false,
        },
      );
    });
    afterAll(async () => {
      process.env = originalEnv;
      await runtime?.end({ timeout: 5 });
      await admin?.end({ timeout: 5 });
    });
    beforeEach(async () => {
      jest.clearAllMocks();
      await seedPgrBase(admin);
      await admin`insert into users (id,email) values ('owner','owner@example.test'),('staff','staff@example.test'),('owner-b','owner-b@example.test')`;
      await admin`insert into org_memberships (org_id,user_id,role) values ('org_a','owner','owner'),('org_a','staff','collaborator'),('org_b','owner-b','owner')`;
      await admin`insert into medicos (id, org_id, name, crm, profession, registration_uf, rqe, affiliation, status) values
      (${M.withRqe}, 'org_a', 'Dra. Fictícia Um', '10001', 'physician', 'MA', '901', 'internal', 'active'),
      (${M.withRqe2}, 'org_a', 'Dr. Fictício Dois', '10002', 'physician', 'PI', '902', 'external', 'active'),
      (${M.noRqe}, 'org_a', 'Dr. Fictício Sem RQE', '10003', 'physician', 'MA', null, 'external', 'active'),
      (${M.psychologist}, 'org_a', 'Psicóloga Fictícia', '06/10004', 'psychologist', 'SP', null, 'internal', 'active'),
      (${M.inactive}, 'org_a', 'Dr. Fictício Inativo', '10005', 'physician', 'MA', '905', 'internal', 'inactive'),
      (${M.noUf}, 'org_a', 'Dr. Fictício Legado', '10006', 'physician', null, '906', 'internal', 'active'),
      (${M.otherTenant}, 'org_b', 'Dra. Outro Escritório', '20001', 'physician', 'PA', '907', 'internal', 'active')`;
      process.env.APP_ENV = "local";
      process.env.DEV_API_AUTH_BYPASS = "true";
      (requireOfficeStaff as jest.Mock).mockResolvedValue(owner);
    });

    it("designates a physician with RQE and lists the open assignment", async () => {
      const created = await designateCoordinator(owner, I.companyA, {
        medicoId: M.withRqe,
        startsOn: "2026-01-01",
      });
      expect(created).toMatchObject({
        endsOn: null,
        createdBy: "owner",
        rqeExceptionReason: null,
      });
      const history = await listCoordinators(owner, I.companyA);
      expect(history).toHaveLength(1);
      expect(history[0]).toMatchObject({
        medicoName: "Dra. Fictícia Um",
        medicoRqe: "901",
      });
    });

    it("switching coordinators closes the open one on the previous day and keeps history", async () => {
      await designateCoordinator(owner, I.companyA, {
        medicoId: M.withRqe,
        startsOn: "2026-01-01",
      });
      await designateCoordinator(owner, I.companyA, {
        medicoId: M.withRqe2,
        startsOn: "2026-03-01",
      });
      const history = await listCoordinators(owner, I.companyA);
      expect(history.map((h) => [h.medicoId, h.startsOn, h.endsOn])).toEqual([
        [M.withRqe2, "2026-03-01", null],
        [M.withRqe, "2026-01-01", "2026-02-28"],
      ]);
      expect(history[1]).toMatchObject({
        endReason: SWITCH_END_REASON,
        endedBy: "owner",
      });
      await expect(
        designateCoordinator(owner, I.companyA, {
          medicoId: M.withRqe,
          startsOn: "2026-03-01",
        }),
      ).rejects.toMatchObject({ code: "VALIDATION" });
    });

    it("requires the NR-7 7.5.2 justification for a physician without RQE", async () => {
      await expect(
        designateCoordinator(owner, I.companyA, {
          medicoId: M.noRqe,
          startsOn: "2026-01-01",
        }),
      ).rejects.toMatchObject({
        code: "VALIDATION",
        message: expect.stringContaining("7.5.2"),
      });
      const created = await designateCoordinator(owner, I.companyA, {
        medicoId: M.noRqe,
        startsOn: "2026-01-01",
        rqeExceptionReason: "Sem médico do trabalho no município fictício de atuação.",
      });
      expect(created.rqeExceptionReason).toContain("município fictício");
    });

    it.each([
      ["psychologist", M.psychologist, "Somente médico"],
      ["inactive", M.inactive, "inativo"],
      ["without CRM UF", M.noUf, "UF do CRM"],
    ])("rejects a %s professional", async (_label, medicoId, message) => {
      await expect(
        designateCoordinator(owner, I.companyA, { medicoId, startsOn: "2026-01-01" }),
      ).rejects.toMatchObject({
        code: "VALIDATION",
        message: expect.stringContaining(message),
      });
    });

    it("only the owner designates; the DB policy blocks a non-owner actor even past the app check", async () => {
      await expect(
        designateCoordinator(collaborator, I.companyA, {
          medicoId: M.withRqe,
          startsOn: "2026-01-01",
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      // Contexto forjado com papel "owner" para um usuário que é colaborador no banco.
      // A policy RLS (42501) barra a escrita; a Action mapeia para FORBIDDEN.
      const forged: TenantContext = { ...collaborator, role: "owner" };
      (requireOfficeStaff as jest.Mock).mockResolvedValue(forged);
      expect(
        await designatePcmsoCoordinatorAction(I.companyA, {
          medicoId: M.withRqe,
          startsOn: "2026-01-01",
        }),
      ).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
      expect(await admin`select id from pcmso_coordinator_assignments`).toHaveLength(0);
      (requireOfficeStaff as jest.Mock).mockResolvedValue(collaborator);
      const viaAction = await designatePcmsoCoordinatorAction(I.companyA, {
        medicoId: M.withRqe,
        startsOn: "2026-01-01",
      });
      expect(viaAction).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
      // Leitura continua liberada à equipe do escritório.
      expect(await listPcmsoCoordinatorsAction(I.companyA)).toMatchObject({
        ok: true,
        data: [],
      });
    });

    it("isolates tenants: no cross-tenant company or physician", async () => {
      await expect(listCoordinators(ownerB, I.companyA)).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
      await expect(
        designateCoordinator(owner, I.companyA, {
          medicoId: M.otherTenant,
          startsOn: "2026-01-01",
        }),
      ).rejects.toMatchObject({ code: "VALIDATION" });
      // Backstop: a FK composta (medico_id, org_id) barra o vínculo mesmo por fora do app.
      await expect(
        admin`insert into pcmso_coordinator_assignments (org_id, company_id, medico_id, starts_on, created_by)
        values ('org_a', ${I.companyA}, ${M.otherTenant}, '2026-01-01', 'owner')`,
      ).rejects.toMatchObject({ code: "23503" });
    });

    it("is blocked when Medicine is not enabled for the company", async () => {
      await admin`update company_modules set enabled = false where company_id = ${I.companyA} and module = 'medicine'`;
      await expect(
        designateCoordinator(owner, I.companyA, {
          medicoId: M.withRqe,
          startsOn: "2026-01-01",
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("closes without replacement once, never reopens, never deletes", async () => {
      const created = await designateCoordinator(owner, I.companyA, {
        medicoId: M.withRqe,
        startsOn: "2026-01-01",
      });
      await expect(
        closeCoordinator(owner, created.id, {
          endsOn: "2025-12-31",
          endReason: "Encerramento fictício.",
        }),
      ).rejects.toMatchObject({ code: "VALIDATION" });
      const closed = await closeCoordinator(owner, created.id, {
        endsOn: "2026-06-30",
        endReason: "Contrato fictício encerrado.",
      });
      expect(closed).toMatchObject({ endsOn: "2026-06-30", endedBy: "owner" });
      await expect(
        closeCoordinator(owner, created.id, {
          endsOn: "2026-07-31",
          endReason: "Segunda tentativa.",
        }),
      ).rejects.toMatchObject({ code: "VALIDATION" });

      const asRuntime = (fn: (tx: postgres.TransactionSql) => Promise<unknown>) =>
        runtime.begin(async (tx) => {
          await tx`select set_config('app.current_org', 'org_a', true), set_config('app.current_actor', 'owner', true)`;
          return fn(tx);
        });
      await expect(
        asRuntime(
          (tx) => tx`delete from pcmso_coordinator_assignments where id = ${created.id}`,
        ),
      ).rejects.toMatchObject({ code: "42501" });
      const reopened = (await asRuntime(
        (tx) =>
          tx`update pcmso_coordinator_assignments set ends_on = null, end_reason = null where id = ${created.id} returning id`,
      )) as unknown[];
      expect(reopened).toHaveLength(0);
      await expect(
        asRuntime(
          (tx) =>
            tx`update pcmso_coordinator_assignments set medico_id = ${M.withRqe2} where id = ${created.id}`,
        ),
      ).rejects.toMatchObject({ code: "42501" });
    });

    it("allows only one open assignment per company (partial unique index)", async () => {
      await designateCoordinator(owner, I.companyA, {
        medicoId: M.withRqe,
        startsOn: "2026-01-01",
      });
      await expect(
        admin`insert into pcmso_coordinator_assignments (org_id, company_id, medico_id, starts_on, created_by)
        values ('org_a', ${I.companyA}, ${M.withRqe2}, '2026-05-01', 'owner')`,
      ).rejects.toMatchObject({ code: "23505" });
    });

    it("a physician with coordination history cannot be deleted (IN_USE)", async () => {
      await designateCoordinator(owner, I.companyA, {
        medicoId: M.withRqe,
        startsOn: "2026-01-01",
      });
      const result = await deleteMedicoAction(M.withRqe);
      expect(result).toMatchObject({ ok: false, error: { code: "IN_USE" } });
      expect(await deleteMedicoAction(M.withRqe2)).toMatchObject({ ok: true });
    });

    it("REST mirror: POST 201, GET list and item, PUT closes", async () => {
      const created = await DESIGNATE(
        request(owner, "POST", { medicoId: M.withRqe, startsOn: "2026-01-01" }),
        params(I.companyA),
      );
      expect(created.status).toBe(201);
      const body = await created.json();
      const list = await LIST(request(owner, "GET"), params(I.companyA));
      expect(list.status).toBe(200);
      expect(await list.json()).toHaveLength(1);
      const show = await SHOW(request(owner, "GET"), params(body.id));
      expect((await show.json()).medicoCrm).toBe("10001");
      const closed = await CLOSE(
        request(owner, "PUT", {
          endsOn: "2026-02-01",
          endReason: "Encerramento fictício via REST.",
        }),
        params(body.id),
      );
      expect(closed.status).toBe(200);
      expect((await closed.json()).endsOn).toBe("2026-02-01");
      const forbidden = await DESIGNATE(
        request(collaborator, "POST", { medicoId: M.withRqe, startsOn: "2026-03-01" }),
        params(I.companyA),
      );
      expect(forbidden.status).toBe(403);
      const invalid = await DESIGNATE(
        request(owner, "POST", { medicoId: "x", startsOn: "2026-13-45" }),
        params(I.companyA),
      );
      expect(invalid.status).toBe(422);
    });
  },
);
