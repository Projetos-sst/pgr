/**
 * Proposta de exames e catálogo de procedimentos (NOB-147) contra Postgres efêmero:
 * proposta a partir do inventário real da Medicina (fonte interna/externa, status e
 * atualidade), isolamento por tenant, módulo Medicina e perfil cliente. Dados fictícios.
 *
 * A validação técnica do risco é feita por fixture (admin) porque o fluxo de revisão
 * por profissional autorizado já é coberto em `platform/risk-authorizations.test.ts`.
 */
import type postgres from "postgres";
import { NextRequest } from "next/server";
jest.mock("@/shared/db/env", () => ({
  getDatabaseUrl: () => process.env.INTEGRATION_APP_RUNTIME_URL,
}));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("@/shared/auth/require-office-staff", () => ({
  requireOfficeStaff: jest.fn(),
  OFFICE_STAFF_ROLES: new Set(["owner", "collaborator"]),
}));
import { requireOfficeStaff } from "@/shared/auth/require-office-staff";
import { registerMedicalRiskSourceAction } from "@/shared/server/actions/medicine/risk-sources";
import {
  getExamProposalAction,
  getProcedureAction,
  searchProceduresAction,
} from "@/shared/server/actions/medicine/exam-proposal";
import { GET as PROPOSAL } from "@/app/api/v1/companies/[id]/exam-proposal/route";
import { GET as PROCEDURES } from "@/app/api/v1/medicine/procedures/route";
import { GET as PROCEDURE } from "@/app/api/v1/medicine/procedures/[code]/route";
import { adminClient, applyMigrations } from "../_helpers/db";
import { seedPgrBase, PGR_IDS as I } from "../_helpers/pgr-seed";

const enabled =
  !!process.env.INTEGRATION_APP_RUNTIME_URL && !!process.env.INTEGRATION_DATABASE_URL;
const NOISE = "02.01.001";

const gate = (tenantId = "org_a", role = "owner") =>
  (requireOfficeStaff as jest.Mock).mockResolvedValue({
    userId: "registrador",
    tenantId,
    role,
    plan: "free",
  });

(enabled ? describe : describe.skip)("exam proposal (NOB-147)", () => {
  let admin: ReturnType<typeof postgres>;
  beforeAll(async () => {
    admin = adminClient();
    await applyMigrations(admin);
  });
  afterAll(async () => {
    await admin?.end({ timeout: 5 });
  });
  beforeEach(async () => {
    await seedPgrBase(admin);
    await admin`update risks set noxious_agent_code=${NOISE} where id=${I.riskA}`;
    gate();
  });

  async function registerInternal() {
    const created = await registerMedicalRiskSourceAction(I.companyA, {
      kind: "internal",
      pgrId: I.pgrA,
    });
    if (!created.ok) throw new Error(`fixture: ${created.error.code}`);
    return created.data.id;
  }
  const validateAll = (sourceId: string) =>
    admin`update medical_risk_entries set status='validated', reviewed_by='prof-ficticio', reviewed_at=now() where source_id=${sourceId}`;

  it("risco de ruído pendente não gera exame; validado gera audiometria com origem", async () => {
    const sourceId = await registerInternal();
    const pending = await getExamProposalAction(I.companyA);
    if (!pending.ok) throw new Error("read failed");
    expect(pending.data.groups).toEqual([]);
    expect(pending.data.excluded.pending).toHaveLength(1);

    await validateAll(sourceId);
    const result = await getExamProposalAction(I.companyA);
    if (!result.ok) throw new Error("read failed");
    expect(result.data.requiresMedicalReview).toBe(true);
    expect(result.data.basis).toEqual([
      expect.objectContaining({ id: sourceId, kind: "internal", version: "Revisão 1" }),
    ]);
    const [group] = result.data.groups;
    expect(group.suggestions).toEqual([
      expect.objectContaining({
        procedureCode: "0281",
        procedureDescription: "Audiometria tonal ocupacional",
        reference: "NR-7, Anexo II, itens 2 e 4",
        triggeredBy: [
          expect.objectContaining({
            sourceId,
            agentCode: NOISE,
            description: "Ruído contínuo",
          }),
        ],
      }),
    ]);
  });

  it("PGR alterado depois da validação tira o risco da proposta", async () => {
    await validateAll(await registerInternal());
    await admin`update risks set description='Inventário atualizado' where id=${I.riskA}`;
    const result = await getExamProposalAction(I.companyA);
    if (!result.ok) throw new Error("read failed");
    expect(result.data.groups).toEqual([]);
    expect(result.data.excluded.outdated).toHaveLength(1);
    expect(result.data.warnings.join(" ")).toMatch(/desatualizada/);
  });

  it("fonte externa validada sem código fica para o coordenador", async () => {
    const created = await registerMedicalRiskSourceAction(I.companyA, {
      kind: "external",
      title: "PGR externo fictício",
      reference: "GED:exemplo",
      version: "3",
      risks: [
        {
          agentType: "physical",
          description: "Ruído informado no PGR externo",
          exposureGroup: "Produção",
          jobRole: "Operador",
        },
      ],
    });
    if (!created.ok) throw new Error("fixture failed");
    await validateAll(created.data.id);
    const result = await getExamProposalAction(I.companyA);
    if (!result.ok) throw new Error("read failed");
    expect(result.data.basis[0]).toMatchObject({ kind: "external", version: "3" });
    expect(result.data.groups[0]).toMatchObject({
      exposureGroup: "Produção",
      jobRole: "Operador",
      suggestions: [],
    });
    expect(result.data.groups[0].withoutRule[0].reason).toMatch(/Sem código/);
  });

  it("sem fonte registrada avisa que não é ausência de risco", async () => {
    const result = await getExamProposalAction(I.companyA);
    if (!result.ok) throw new Error("read failed");
    expect(result.data.basis).toEqual([]);
    expect(result.data.warnings[0]).toMatch(/não significa ausência de riscos/);
  });

  it("isolamento: outro tenant não vê a proposta da empresa", async () => {
    await validateAll(await registerInternal());
    gate("org_b");
    const other = await getExamProposalAction(I.companyA);
    expect(!other.ok && other.error.code).toBe("NOT_FOUND");
  });

  it("empresa sem Medicina habilitada → FORBIDDEN", async () => {
    await admin`update company_modules set enabled=false where company_id=${I.companyA} and module='medicine'`;
    const denied = await getExamProposalAction(I.companyA);
    expect(!denied.ok && denied.error.code).toBe("FORBIDDEN");
  });

  it("ID de empresa malformado → VALIDATION", async () => {
    const invalid = await getExamProposalAction("nao-e-uuid");
    expect(!invalid.ok && invalid.error.code).toBe("VALIDATION");
  });

  it("catálogo pelas Server Actions: busca, código oficial e código inventado", async () => {
    const search = await searchProceduresAction("audiometria ocupacional");
    expect(search.ok && search.data.rows.map((p) => p.code)).toEqual(["0281"]);
    expect(search.ok && search.data.source.count).toBe(1450);
    const found = await getProcedureAction("1078");
    expect(found.ok && found.data.description).toMatch(/Padrão OIT/);
    const missing = await getProcedureAction("0000");
    expect(!missing.ok && missing.error.code).toBe("NOT_FOUND");
  });

  it("REST: proposta e catálogo respeitam papel e tenant", async () => {
    await validateAll(await registerInternal());
    const oldApp = process.env.APP_ENV,
      oldBypass = process.env.DEV_API_AUTH_BYPASS;
    process.env.APP_ENV = "local";
    process.env.DEV_API_AUTH_BYPASS = "true";
    const req = (path: string, role: string, tenant = "org_a") =>
      new NextRequest(`http://localhost/api/v1/${path}`, {
        headers: { "x-dev-tenant": tenant, "x-dev-role": role },
      });
    const company = { params: Promise.resolve({ id: I.companyA }) };
    try {
      const ok = await PROPOSAL(
        req(`companies/${I.companyA}/exam-proposal`, "owner"),
        company,
      );
      expect(ok.status).toBe(200);
      const body = await ok.json();
      expect(body.groups[0].suggestions[0].procedureCode).toBe("0281");
      expect(
        (
          await PROPOSAL(
            req(`companies/${I.companyA}/exam-proposal`, "collaborator"),
            company,
          )
        ).status,
      ).toBe(200);
      expect(
        (await PROPOSAL(req(`companies/${I.companyA}/exam-proposal`, "client"), company))
          .status,
      ).toBe(403);
      expect(
        (
          await PROPOSAL(
            req(`companies/${I.companyA}/exam-proposal`, "owner", "org_b"),
            company,
          )
        ).status,
      ).toBe(404);

      const list = await PROCEDURES(req("medicine/procedures?search=torax", "owner"));
      expect(list.status).toBe(200);
      expect(
        (await list.json()).rows.some((p: { code: string }) => p.code === "1078"),
      ).toBe(true);
      expect((await PROCEDURES(req("medicine/procedures", "client"))).status).toBe(403);
      const code = (value: string) => ({ params: Promise.resolve({ code: value }) });
      expect(
        (await PROCEDURE(req("medicine/procedures/0281", "owner"), code("0281"))).status,
      ).toBe(200);
      expect(
        (await PROCEDURE(req("medicine/procedures/0000", "owner"), code("0000"))).status,
      ).toBe(404);
    } finally {
      if (oldApp === undefined) delete process.env.APP_ENV;
      else process.env.APP_ENV = oldApp;
      if (oldBypass === undefined) delete process.env.DEV_API_AUTH_BYPASS;
      else process.env.DEV_API_AUTH_BYPASS = oldBypass;
    }
  });
});
