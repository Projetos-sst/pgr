/**
 * Lista C (NTEP) — NOB-113 — contra Postgres efêmero: consulta global por CID-10/CNAE (REST e
 * Server Action), consulta pela classe CNAE cadastrada da empresa (tenant + Medicina
 * habilitada), perfis, outro tenant e ausência de dado individual. Dados fictícios.
 */
import type postgres from "postgres";
import { NextRequest } from "next/server";
jest.mock("@/shared/db/env", () => ({
  getDatabaseUrl: () => process.env.INTEGRATION_APP_RUNTIME_URL,
}));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("@/shared/auth/require-office-staff", () => {
  const actual = jest.requireActual("@/shared/auth/require-office-staff");
  return { ...actual, requireOfficeStaff: jest.fn(actual.requireOfficeStaff) };
});

import { requireOfficeStaff } from "@/shared/auth/require-office-staff";
import { GET as LOOKUP } from "@/app/api/v1/medicine/ntep/route";
import { GET as COMPANY } from "@/app/api/v1/companies/[id]/ntep/route";
import {
  getCompanyNtepAction,
  lookupNtepAction,
} from "@/shared/server/actions/medicine/ntep";
import listaC from "@/shared/domains/medicine/ntep/lista-c.json";
import { adminClient, applyMigrations } from "../_helpers/db";
import { seedPgrBase, PGR_IDS as I } from "../_helpers/pgr-seed";

const enabled =
  !!process.env.INTEGRATION_APP_RUNTIME_URL && !!process.env.INTEGRATION_DATABASE_URL;
const gate = requireOfficeStaff as jest.Mock;
const asStaff = (tenantId = "org_a", role = "collaborator") =>
  gate.mockResolvedValue({ userId: "staff", tenantId, role, plan: "free" });

const req = (path: string, role: string, tenant = "org_a") =>
  new NextRequest(`http://localhost${path}`, {
    method: "GET",
    headers: { "x-dev-tenant": tenant, "x-dev-role": role, "x-dev-user": "api-user" },
  });

(enabled ? describe : describe.skip)("Lista C — NTEP (NOB-113)", () => {
  let admin: ReturnType<typeof postgres>;
  const env = { ...process.env };
  beforeAll(async () => {
    admin = adminClient();
    await applyMigrations(admin);
  });
  afterAll(async () => {
    process.env = env;
    await admin?.end({ timeout: 5 });
  });
  beforeEach(async () => {
    await seedPgrBase(admin);
    // CNAE fictício de cadastro (subclasse); a Lista C compara pelos 4 dígitos iniciais.
    await admin`update companies set cnae = '0810-0/01' where id = ${I.companyA}`;
    gate.mockReset();
    process.env.APP_ENV = "local";
    process.env.DEV_API_AUTH_BYPASS = "true";
  });

  it("REST: correspondência, sem correspondência, código inválido (422) e cliente barrado", async () => {
    const match = await LOOKUP(
      req("/api/v1/medicine/ntep?cid=A15.0&cnae=0810", "collaborator"),
    );
    expect(match.status).toBe(200);
    const body = await match.json();
    expect(body).toMatchObject({
      kind: "match",
      matches: [{ interval: "A15-A19", cnaeClasses: ["0810"] }],
      source: { version: listaC.version, url: listaC.url },
    });
    expect(body.notice).toMatch(/Não estabelece nexo ocupacional individual/);
    expect(body.source).not.toHaveProperty("rows");

    const none = await LOOKUP(req("/api/v1/medicine/ntep?cid=A20&cnae=0810", "owner"));
    expect((await none.json()).kind).toBe("no_match");
    expect(
      (await LOOKUP(req("/api/v1/medicine/ntep?cid=XX9&cnae=0810", "owner"))).status,
    ).toBe(422);
    expect((await LOOKUP(req("/api/v1/medicine/ntep?cnae=12", "owner"))).status).toBe(
      422,
    );
    expect((await LOOKUP(req("/api/v1/medicine/ntep?cid=A15", "client"))).status).toBe(
      403,
    );
  });

  it("empresa: usa a classe do CNAE cadastrado, exige Medicina, isola o tenant e não expõe dado individual", async () => {
    const ok = await COMPANY(
      req(`/api/v1/companies/${I.companyA}/ntep`, "collaborator"),
      {
        params: Promise.resolve({ id: I.companyA }),
      },
    );
    expect(ok.status).toBe(200);
    const body = await ok.json();
    expect(body).toMatchObject({
      company: { id: I.companyA, cnae: "0810-0/01" },
      cnaeClass: "0810",
      status: "ok",
      result: { kind: "match" },
    });
    expect(body.result.matches.map((m: { interval: string }) => m.interval)).toContain(
      "A15-A19",
    );
    expect(JSON.stringify(body)).not.toMatch(/cpf|employee|funcion|diagn|exam/i);

    // Outro tenant: 404. Cliente: 403.
    expect(
      (
        await COMPANY(req(`/api/v1/companies/${I.companyA}/ntep`, "owner", "org_b"), {
          params: Promise.resolve({ id: I.companyA }),
        })
      ).status,
    ).toBe(404);
    expect(
      (
        await COMPANY(req(`/api/v1/companies/${I.companyA}/ntep`, "client"), {
          params: Promise.resolve({ id: I.companyA }),
        })
      ).status,
    ).toBe(403);

    // Sem Medicina habilitada: recusado.
    await admin`update company_modules set enabled = false where company_id = ${I.companyA} and module = 'medicine'`;
    asStaff();
    const blocked = await getCompanyNtepAction(I.companyA);
    expect(!blocked.ok && blocked.error.code).toBe("FORBIDDEN");
  });

  it("empresa sem CNAE ou com CNAE sem classe: estado explícito, nunca 'sem correspondência'", async () => {
    asStaff();
    await admin`update companies set cnae = null where id = ${I.companyA}`;
    const missing = await getCompanyNtepAction(I.companyA);
    expect(missing.ok && missing.data).toMatchObject({
      status: "missing_cnae",
      result: null,
    });
    await admin`update companies set cnae = 'abc' where id = ${I.companyA}`;
    const invalid = await getCompanyNtepAction(I.companyA);
    expect(invalid.ok && invalid.data).toMatchObject({
      status: "invalid_cnae",
      result: null,
    });
  });

  it("Server Action: correspondência, versão inexistente e código inválido explícitos", async () => {
    asStaff("org_a", "owner");
    const r = await lookupNtepAction({ cnae: "0810" });
    expect(r.ok && r.data.kind).toBe("match");
    const v = await lookupNtepAction({ cnae: "0810", version: "versão inexistente" });
    expect(v.ok && v.data.kind).toBe("version_not_available");
    const bad = await lookupNtepAction({ cid: "999" });
    expect(!bad.ok && bad.error.code).toBe("VALIDATION");
  });
});
