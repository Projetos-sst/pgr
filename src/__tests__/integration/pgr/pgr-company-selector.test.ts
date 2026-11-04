/**
 * Seletor de empresas do Novo PGR contra Postgres efêmero (app_runtime, RLS ativa). Reproduz o caso
 * relatado em homologação: empresas criadas depois da NOB-97 começam sem o serviço PGR, aparecem no
 * cadastro e não no seletor. É a regra (só o administrador habilita), não perda de dados: depois
 * da habilitação a empresa aparece; PGR existente não a exclui; outro escritório nunca a vê.
 * Dados fictícios.
 */
import type postgres from "postgres";
jest.mock("@/shared/db/env", () => ({
  getDatabaseUrl: () => process.env.INTEGRATION_APP_RUNTIME_URL,
}));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("@/shared/auth/require-office-staff", () => ({
  requireOfficeStaff: jest.fn(),
}));

import { ForbiddenError } from "@/shared/auth/errors";
import { requireOfficeStaff } from "@/shared/auth/require-office-staff";
import {
  createCompanyAction,
  listCompaniesAction,
  listCompanyOptionsAction,
} from "@/shared/server/actions/pgr/companies";
import { createPgrAction } from "@/shared/server/actions/pgr/pgr";
import { changeCompanyModuleAction } from "@/shared/server/actions/platform/company-modules";
import { adminClient, applyMigrations } from "../_helpers/db";
import { seedPgrBase, PGR_IDS as I } from "../_helpers/pgr-seed";

const enabled =
  !!process.env.INTEGRATION_APP_RUNTIME_URL && !!process.env.INTEGRATION_DATABASE_URL;
const gate = requireOfficeStaff as jest.Mock;
const as = (role: "owner" | "collaborator", tenantId = "org_a") =>
  gate.mockResolvedValue({ userId: `${role}-user`, tenantId, role, plan: "free" });
const pgrInput = (companyId: string) => ({
  companyId,
  registrationType: "not_applicable" as const,
  issuedAt: "2026-01-10",
  validUntil: "2027-01-10",
  declarationAccepted: true as const,
});
const ids = (r: { ok: boolean; data?: { id: string }[] }) =>
  r.ok ? (r.data ?? []).map((c) => c.id) : null;

(enabled ? describe : describe.skip)("Novo PGR — seletor de empresas", () => {
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
    gate.mockReset();
  });

  it("empresas novas: no cadastro, fora do seletor até o administrador habilitar o PGR; PGR existente não exclui", async () => {
    as("owner");
    const created: string[] = [];
    for (const razaoSocial of ["Nova Alfa Fictícia Ltda", "Nova Beta Fictícia Ltda"]) {
      const result = await createCompanyAction({ razaoSocial, riskGrade: 2 } as never);
      expect(result.ok).toBe(true);
      if (result.ok) created.push(result.data.id);
    }
    // Cadastro: as duas aparecem, sem módulos ("Sem módulos — gerenciar serviços").
    const listing = await listCompaniesAction({});
    const rows = listing.ok
      ? listing.data.rows.filter((r) => created.includes(r.id))
      : [];
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => !r.pgrEnabled && !r.medicineEnabled)).toBe(true);
    // Seletor do Novo PGR: nenhuma das novas; a lista comum tem todas.
    for (const role of ["owner", "collaborator"] as const) {
      as(role);
      const pgr = ids(await listCompanyOptionsAction("pgr"));
      expect(pgr).toEqual([I.companyA]);
      expect(ids(await listCompanyOptionsAction())).toEqual(
        expect.arrayContaining([I.companyA, ...created]),
      );
    }
    // Criar PGR sem o serviço continua bloqueado (servidor e banco).
    as("collaborator");
    const blocked = await createPgrAction(pgrInput(created[0]));
    expect(!blocked.ok && blocked.error.code).toBe("FORBIDDEN");
    const [{ count: none }] =
      await admin`select count(*)::int as count from pgr where company_id = ${created[0]}`;
    expect(none).toBe(0);
    // Colaborador não habilita; o administrador sim.
    const denied = await changeCompanyModuleAction(created[0], {
      module: "pgr",
      enabled: true,
      reason: "Contratação do PGR (fictício).",
    });
    expect(!denied.ok && denied.error.code).toBe("FORBIDDEN");
    as("owner");
    const enabledNow = await changeCompanyModuleAction(created[0], {
      module: "pgr",
      enabled: true,
      reason: "Contratação do PGR (fictício).",
    });
    expect(enabledNow.ok).toBe(true);
    expect(ids(await listCompanyOptionsAction("pgr"))).toEqual(
      expect.arrayContaining([I.companyA, created[0]]),
    );
    expect(ids(await listCompanyOptionsAction("pgr"))).not.toContain(created[1]);
    // Criação válida; empresa com PGR continua no seletor (vários PGRs por empresa são permitidos).
    as("collaborator");
    expect((await createPgrAction(pgrInput(created[0]))).ok).toBe(true);
    expect(ids(await listCompanyOptionsAction("pgr"))).toContain(created[0]);
    expect((await createPgrAction(pgrInput(created[0]))).ok).toBe(true);
    // PGR já existente da empresa do seed também não a exclui.
    expect(ids(await listCompanyOptionsAction("pgr"))).toContain(I.companyA);
  });

  it("isolamento: outro escritório não vê nem usa as empresas; cliente não acessa", async () => {
    as("owner", "org_b");
    const optionsB = ids(await listCompanyOptionsAction("pgr"));
    expect(optionsB).toEqual([I.companyB]);
    expect(ids(await listCompanyOptionsAction())).not.toContain(I.companyA);
    const cross = await createPgrAction(pgrInput(I.companyA));
    expect(cross.ok).toBe(false);
    // Cliente: o gate de escritório recusa antes de qualquer consulta.
    gate.mockRejectedValue(new ForbiddenError());
    const client = await listCompanyOptionsAction("pgr");
    expect(!client.ok && client.error.code).toBe("FORBIDDEN");
  });
});
