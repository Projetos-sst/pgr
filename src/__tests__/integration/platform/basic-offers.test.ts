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
    userId: "owner",
    role: "owner",
    plan: "free",
  }),
}));
import { adminClient, applyMigrations, withOrgTx } from "../_helpers/db";
import { seedPgrBase, PGR_IDS as I } from "../_helpers/pgr-seed";
import {
  listOffers,
  getOffer,
  createOffer,
  publishOffer,
} from "@/shared/server/pgr/basic-offer-core";
import { createBasicOfferAction } from "@/shared/server/actions/pgr/basic-offers";
import { POST, GET } from "@/app/api/v1/pgr-basic-offers/route";
import { PUT } from "@/app/api/v1/pgr-basic-offers/[id]/publication/route";
const enabled = !!process.env.INTEGRATION_APP_RUNTIME_URL;
const owner = {
  tenantId: "org_a",
  userId: "owner",
  role: "owner",
  plan: "free" as const,
};
const draft = {
  name: "PGR básico",
  eligibility: "",
  technicalScope: "",
  servicesIncluded: "",
  limitations: "",
  priceCents: null,
  currency: "BRL",
  billingPeriod: null,
  maxEmployees: null,
  maxWorkUnits: null,
  maxRevisions: null,
  reason: "Proposta",
};
const complete = {
  ...draft,
  eligibility: "Critério fictício aprovado para teste",
  technicalScope: "Mesmo gerador e conferências",
  servicesIncluded: "Serviços declarados para teste",
  limitations: "Limites declarados para teste",
  priceCents: 12345,
  billingPeriod: "one_time",
};
const publication = {
  active: true,
  expectedActiveVersionId: null,
  commercialApprovalReference: "Evidência fictícia comercial",
  technicalApprovalReference: "Evidência fictícia técnica",
  reason: "Publicação fictícia",
};
const req = (method: string, body?: unknown, role = "owner") =>
  new NextRequest("http://localhost/api/v1/pgr-basic-offers", {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      "x-dev-tenant": "org_a",
      "x-dev-user": "owner",
      "x-dev-role": role,
    },
  });
(enabled ? describe : describe.skip)("versioned PGR basic offers", () => {
  let admin: ReturnType<typeof postgres>, runtime: ReturnType<typeof postgres>;
  const oldEnv = { ...process.env };
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
    process.env = oldEnv;
    await runtime.end({ timeout: 5 });
    await admin.end({ timeout: 5 });
  });
  beforeEach(async () => {
    await seedPgrBase(admin);
    await admin`insert into users (id,email) values ('owner','owner@example.test')`;
    await admin`insert into org_memberships (org_id,user_id,role) values ('org_a','owner','owner')`;
    process.env.APP_ENV = "local";
    process.env.DEV_API_AUTH_BYPASS = "true";
  });
  it("creates an inactive draft and preserves company services and plan", async () => {
    const before =
      await admin`select * from company_modules where company_id=${I.companyA} order by module`;
    const row = await createOffer(owner, draft);
    expect(row.version).toBe(1);
    expect(row.data.priceCents).toBeNull();
    expect((await listOffers(owner)).activeVersionId).toBeNull();
    expect(
      await admin`select * from company_modules where company_id=${I.companyA} order by module`,
    ).toEqual(before);
  });
  it("publishes only complete versions with approvals and does not activate later drafts", async () => {
    const first = await createOffer(owner, draft);
    await expect(publishOffer(owner, first.id, publication)).rejects.toMatchObject({
      code: "VALIDATION",
    });
    const ready = await createOffer(owner, complete);
    await expect(
      publishOffer(owner, ready.id, { ...publication, technicalApprovalReference: "" }),
    ).rejects.toBeDefined();
    await publishOffer(owner, ready.id, publication);
    const later = await createOffer(owner, {
      ...complete,
      priceCents: 23456,
      reason: "Nova proposta",
    });
    expect((await listOffers(owner)).activeVersionId).toBe(ready.id);
    expect((await getOffer(owner, ready.id)).data.priceCents).toBe(12345);
    expect(later.version).toBe(3);
  });
  it("restricts owner operations, immutable versions/history and tenant boundaries", async () => {
    await expect(
      createOffer({ ...owner, role: "collaborator" }, complete),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    const row = await createOffer(owner, complete);
    await expect(getOffer({ ...owner, tenantId: "org_b" }, row.id)).rejects.toMatchObject(
      { code: "NOT_FOUND" },
    );
    await expect(
      withOrgTx(
        runtime,
        "org_a",
        (tx) => tx`update pgr_basic_offer_versions set data='{}'`,
      ),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      withOrgTx(runtime, "org_a", (tx) => tx`delete from pgr_basic_offer_events`),
    ).rejects.toMatchObject({ code: "42501" });
  });
  it("serializes version numbers and competing publications", async () => {
    const rows = await Promise.all([
      createOffer(owner, complete),
      createOffer(owner, { ...complete, name: "Outra versão" }),
    ]);
    expect(rows.map((r) => r.version).sort()).toEqual([1, 2]);
    const attempts = await Promise.allSettled(
      rows.map((r) => publishOffer(owner, r.id, publication)),
    );
    expect(attempts.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((await listOffers(owner)).history.total).toBe(3);
  });
  it("withdraws only the expected active version without changing access", async () => {
    const row = await createOffer(owner, complete);
    await publishOffer(owner, row.id, publication);
    await publishOffer(owner, row.id, {
      active: false,
      expectedActiveVersionId: row.id,
      reason: "Retirada explícita",
    });
    expect((await listOffers(owner)).activeVersionId).toBeNull();
    expect(
      (
        await admin`select enabled from company_modules where company_id=${I.companyA}`
      ).every((r) => r.enabled),
    ).toBe(true);
  });
  it("rolls back a version if its audit cannot be inserted", async () => {
    await admin`revoke insert on pgr_basic_offer_events from app_runtime`;
    try {
      await expect(createOffer(owner, complete)).rejects.toBeDefined();
      expect(await admin`select id from pgr_basic_offer_versions`).toHaveLength(0);
    } finally {
      await admin`grant insert on pgr_basic_offer_events to app_runtime`;
    }
  });
  it("shares owner-only behavior across Server Actions and HTTP", async () => {
    expect((await createBasicOfferAction(draft)).ok).toBe(true);
    expect((await GET(req("GET", undefined, "collaborator"))).status).toBe(403);
    const response = await POST(req("POST", complete));
    expect(response.status).toBe(201);
    const row = await response.json();
    expect(
      (await PUT(req("PUT", publication), { params: Promise.resolve({ id: row.id }) }))
        .status,
    ).toBe(200);
  });
});
