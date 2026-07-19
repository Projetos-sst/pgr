/**
 * Integração do route handler `/api/v1/reports/[type]` (#83) contra Postgres
 * efêmero — Gotenberg MOCKADO (captura o HTML). Cobre o download consolidado de
 * eventos eSocial, o manual de onboarding, o **isolamento multi-tenant do
 * download** (o relatório de org_a nunca contém dados de org_b) e o mapeamento de
 * erros (404 tipo inexistente, 503 serviço de PDF indisponível).
 */
jest.mock("@/shared/db/env", () => ({
  getDatabaseUrl: () => process.env.INTEGRATION_APP_RUNTIME_URL,
}));

const htmlToPdf = jest.fn();
jest.mock("@/shared/integrations/pdf/gotenberg", () => ({
  htmlToPdf: (...a: unknown[]) => htmlToPdf(...a),
}));
jest.mock("@/shared/auth/require-office-staff", () => ({
  requireOfficeStaff: jest.fn(),
}));
jest.mock("@/shared/tenant/switcher", () => ({ getTenantSwitcher: jest.fn() }));

import { NextRequest } from "next/server";
import type postgres from "postgres";

import { requireOfficeStaff } from "@/shared/auth/require-office-staff";
import { getTenantSwitcher } from "@/shared/tenant/switcher";
import { generateReport } from "@/shared/server/platform/reports-core";
import { ReportUnavailableError } from "@/shared/errors/report-unavailable-error";

import { GET } from "../../../app/api/v1/reports/[type]/route";
import { adminClient, applyMigrations } from "../_helpers/db";
import { seedPgrBase, PGR_IDS } from "../_helpers/pgr-seed";

const shouldRun =
  !!process.env.INTEGRATION_APP_RUNTIME_URL && !!process.env.INTEGRATION_DATABASE_URL;
const d = shouldRun ? describe : describe.skip;

const REF_A = PGR_IDS.employeeA;
const REF_B = PGR_IDS.employeeB;

const mockedGate = requireOfficeStaff as jest.MockedFunction<typeof requireOfficeStaff>;
const mockedSwitcher = getTenantSwitcher as jest.MockedFunction<typeof getTenantSwitcher>;

function asTenant(tenantId: string, name: string) {
  mockedGate.mockResolvedValue({ userId: "u", tenantId, plan: "free", role: "owner" });
  mockedSwitcher.mockResolvedValue({
    options: [{ orgId: tenantId, name, isActive: true }],
  } as Awaited<ReturnType<typeof getTenantSwitcher>>);
}

function req(type: string) {
  return {
    request: new NextRequest(`http://localhost/api/v1/reports/${type}`),
    ctx: { params: Promise.resolve({ type }) },
  };
}

d("GET /api/v1/reports/[type]", () => {
  let admin: ReturnType<typeof postgres>;

  beforeAll(async () => {
    admin = adminClient();
    await applyMigrations(admin);
  });
  afterAll(async () => {
    await admin?.end();
  });

  beforeEach(async () => {
    await seedPgrBase(admin);
    await admin`insert into public.esocial_events (org_id, event_type, status, reference_id, payload) values
      ('org_a','S-2210','pending',${REF_A},'<xml>a</xml>'),
      ('org_b','S-2240','sent',${REF_B},'<xml>b</xml>')`;
    htmlToPdf.mockReset().mockResolvedValue(Buffer.from("%PDF-1.4 fake"));
  });

  it("baixa o consolidado eSocial em application/pdf", async () => {
    asTenant("org_a", "Org A");
    const { request, ctx } = req("esocial-events");
    const res = await GET(request, ctx);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("content-disposition")).toContain("eventos-esocial-");
  });

  it("isola o download por tenant: relatório de org_a não contém dados de org_b", async () => {
    asTenant("org_a", "Org A");
    const { request, ctx } = req("esocial-events");
    await GET(request, ctx);
    const html = htmlToPdf.mock.calls[0][0] as string;
    expect(html).toContain(REF_A);
    expect(html).not.toContain(REF_B);
    expect(html).toContain("1 evento(s)");
  });

  it("baixa o manual de onboarding", async () => {
    asTenant("org_a", "Org A");
    const { request, ctx } = req("onboarding-manual");
    const res = await GET(request, ctx);
    expect(res.status).toBe(200);
    const html = htmlToPdf.mock.calls[0][0] as string;
    expect(html).toContain("Manual de onboarding");
    expect(html).toContain("Cadastrar a primeira empresa");
  });

  it("tipo inexistente → 404", async () => {
    asTenant("org_a", "Org A");
    const { request, ctx } = req("nope");
    const res = await GET(request, ctx);
    expect(res.status).toBe(404);
  });

  it("serviço de PDF indisponível → 503", async () => {
    asTenant("org_a", "Org A");
    htmlToPdf.mockRejectedValue(new ReportUnavailableError());
    const { request, ctx } = req("esocial-events");
    const res = await GET(request, ctx);
    expect(res.status).toBe(503);
  });

  it("generateReport (core) também isola por tenant", async () => {
    const a = await generateReport("org_a", "Org A", "esocial-events");
    const htmlA = htmlToPdf.mock.calls.at(-1)![0] as string;
    expect(htmlA).toContain(REF_A);
    expect(htmlA).not.toContain(REF_B);
    expect(a.fileName).toContain("eventos-esocial-");
  });
});
