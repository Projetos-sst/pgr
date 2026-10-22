import type postgres from "postgres";
import { NextRequest } from "next/server";
jest.mock("@/shared/db/env", () => ({
  getDatabaseUrl: () => process.env.INTEGRATION_APP_RUNTIME_URL,
}));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("@/shared/auth/require-office-staff", () => ({
  OFFICE_STAFF_ROLES: new Set(["owner", "collaborator"]),
  requireOfficeStaff: jest.fn().mockResolvedValue({
    tenantId: "org_a",
    userId: "staff",
    role: "collaborator",
    plan: "free",
  }),
}));
import { adminClient, applyMigrations, withOrgTx } from "../_helpers/db";
import { seedPgrBase, PGR_IDS as I } from "../_helpers/pgr-seed";
import {
  createMachine,
  updateMachine,
  archiveMachine,
  getMachine,
} from "@/shared/server/pgr/machine-installation-core";
import { createMachineAction } from "@/shared/server/actions/pgr/machine-installations";
import { POST, GET } from "@/app/api/v1/companies/[id]/machines/route";
import { PUT, DELETE } from "@/app/api/v1/companies/[id]/machines/[machineId]/route";
import { getPgrDocxExtras } from "@/shared/db/repositories/pgr-docx-extras";
const enabled = !!process.env.INTEGRATION_APP_RUNTIME_URL;
const ctx = {
  tenantId: "org_a",
  userId: "staff",
  role: "collaborator",
  plan: "free" as const,
};
const input = {
  workUnitId: I.workUnitA,
  gesId: I.gesA,
  catalogId: I.epiCatalogA,
  mode: "individual",
  quantity: 1,
  identifier: "PAT-1",
  description: "Operação fictícia",
  safetyMeasures: "Medida observada",
  reason: "Cadastro fictício",
};
const req = (method: string, body?: unknown, role = "collaborator") =>
  new NextRequest("http://localhost/api/v1/companies/machines", {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      "x-dev-tenant": "org_a",
      "x-dev-user": "staff",
      "x-dev-role": role,
    },
  });
(enabled ? describe : describe.skip)("machine installations", () => {
  let admin: ReturnType<typeof postgres>, runtime: ReturnType<typeof postgres>;
  const originalEnv = { ...process.env };
  beforeAll(async () => {
    admin = adminClient();
    await admin`set client_min_messages=warning`;
    await applyMigrations(admin);
    runtime = (await import("postgres")).default(
      process.env.INTEGRATION_APP_RUNTIME_URL!,
      { max: 1, prepare: false },
    );
  });
  afterAll(async () => {
    process.env = originalEnv;
    await runtime?.end({ timeout: 5 });
    await admin?.end({ timeout: 5 });
  });
  beforeEach(async () => {
    await seedPgrBase(admin);
    const [category] =
      await admin`insert into categories (org_id,type,name) values ('org_a','machine','Máquinas fictícias') returning id`;
    await admin`update epi_catalog set type='machine',category_id=${category.id},name='Máquina A' where id=${I.epiCatalogA}`;
    process.env.APP_ENV = "local";
    process.env.DEV_API_AUTH_BYPASS = "true";
  });
  it("creates, edits and retires with immutable history and optimistic concurrency", async () => {
    const row = await createMachine(ctx, I.companyA, input);
    expect(row.createdBy).toBe("staff");
    const changed = await updateMachine(ctx, I.companyA, row.id, {
      expectedVersion: 1,
      data: { ...input, description: "Operação revisada", reason: "Revisão" },
    });
    expect(changed.version).toBe(2);
    await expect(
      updateMachine(ctx, I.companyA, row.id, { expectedVersion: 1, data: input }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    await archiveMachine(ctx, I.companyA, row.id, {
      expectedVersion: 2,
      reason: "Retirada",
    });
    const detail = await getMachine(ctx, I.companyA, row.id);
    expect(detail.installation.active).toBe(false);
    expect(detail.history.total).toBe(3);
    await expect(
      withOrgTx(runtime, "org_a", (tx) => tx`delete from machine_installation_events`),
    ).rejects.toMatchObject({ code: "42501" });
  });
  it("rejects epi items, foreign tenant and mismatched company/work-unit/GES contexts", async () => {
    await expect(
      createMachine(ctx, I.companyA, { ...input, catalogId: I.epiCatalogB }),
    ).rejects.toMatchObject({ code: "FK_NOT_FOUND" });
    await expect(
      createMachine(ctx, I.companyA, { ...input, workUnitId: I.workUnitB }),
    ).rejects.toMatchObject({ code: "FK_NOT_FOUND" });
    await expect(
      createMachine(ctx, I.companyA, { ...input, gesId: I.gesB }),
    ).rejects.toMatchObject({ code: "FK_NOT_FOUND" });

    const [epi] =
      await admin`insert into epi_catalog (org_id,type,category_id,name) values ('org_a','epi',${I.categoryA},'EPI fictício') returning id`;
    await expect(
      createMachine(ctx, I.companyA, { ...input, catalogId: epi.id }),
    ).rejects.toMatchObject({ code: "FK_NOT_FOUND" });
  });
  it("isolates same-tenant companies and includes only linked active machines in document extras", async () => {
    const row = await createMachine(ctx, I.companyA, input);
    expect(
      (await getPgrDocxExtras("org_a", I.pgrA))?.machines?.map((m) => m.catalogName),
    ).toEqual(["Máquina A"]);
    expect((await getPgrDocxExtras("org_b", I.pgrB))?.machines).toEqual([]);
    await archiveMachine(ctx, I.companyA, row.id, {
      expectedVersion: 1,
      reason: "Retirada",
    });
    expect((await getPgrDocxExtras("org_a", I.pgrA))?.machines).toEqual([]);
  });
  it("rejects another work unit of the same company and foreign-company inserts in RLS", async () => {
    const [unit] =
      await admin`insert into work_units (org_id,company_id,name,description) values ('org_a',${I.companyA},'Outra obra','Descrição') returning id`;
    await expect(
      createMachine(ctx, I.companyA, { ...input, workUnitId: unit.id }),
    ).rejects.toMatchObject({ code: "FK_NOT_FOUND" });
    await expect(
      withOrgTx(
        runtime,
        "org_a",
        (tx) =>
          tx`insert into machine_installations (org_id,company_id,work_unit_id,catalog_id,catalog_name,mode,quantity,description,created_by,updated_by) values ('org_a',${I.companyA},${I.workUnitB},${I.epiCatalogA},'Máquina','group',2,'Descrição','actor','actor')`,
      ),
    ).rejects.toMatchObject({ code: "42501" });
  });
  it("serializes competing edits without losing either history or the winning version", async () => {
    const row = await createMachine(ctx, I.companyA, input);
    const attempts = await Promise.allSettled([
      updateMachine(ctx, I.companyA, row.id, {
        expectedVersion: 1,
        data: { ...input, description: "Primeira" },
      }),
      updateMachine(ctx, I.companyA, row.id, {
        expectedVersion: 1,
        data: { ...input, description: "Segunda" },
      }),
    ]);
    expect(attempts.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((await getMachine(ctx, I.companyA, row.id)).history.total).toBe(2);
  });
  it("rolls back machine creation when history cannot be inserted", async () => {
    await admin`revoke insert on machine_installation_events from app_runtime`;
    try {
      await expect(createMachine(ctx, I.companyA, input)).rejects.toBeDefined();
      expect(await admin`select id from machine_installations`).toHaveLength(0);
    } finally {
      await admin`grant insert on machine_installation_events to app_runtime`;
    }
  });
  it("uses Server Actions and REST with staff gate, module guard and validation", async () => {
    expect((await createMachineAction(I.companyA, input)).ok).toBe(true);
    const params = { params: Promise.resolve({ id: I.companyA }) };
    expect((await GET(req("GET", undefined, "client"), params)).status).toBe(403);
    const response = await POST(
      req("POST", { ...input, mode: "group", quantity: 3, identifier: null }),
      params,
    );
    expect(response.status).toBe(201);
    const row = await response.json();
    const itemParams = { params: Promise.resolve({ id: I.companyA, machineId: row.id }) };
    expect(
      (
        await PUT(
          req("PUT", { expectedVersion: 1, data: { ...input, reason: "Revisão HTTP" } }),
          itemParams,
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await DELETE(
          req("DELETE", { expectedVersion: 2, reason: "Retirada HTTP" }),
          itemParams,
        )
      ).status,
    ).toBe(204);
    await admin`update company_modules set enabled=false where company_id=${I.companyA} and module='pgr'`;
    expect((await POST(req("POST", input), params)).status).toBe(403);
  });
});
