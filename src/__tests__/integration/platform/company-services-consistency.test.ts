/**
 * NOB-170: o estado dos serviços (PGR/Medicina) por empresa é o mesmo em todas as superfícies —
 * listagem `/companies`, página de serviços, seletores (`listCompanyOptionsAction`) e banco —
 * contra Postgres efêmero (app_runtime, RLS). Reproduz a divergência relatada: a listagem dizia
 * "Sem módulos" para empresa com os dois serviços habilitados. Dados fictícios.
 */
import type postgres from "postgres";
jest.mock("@/shared/db/env", () => ({
  getDatabaseUrl: () => process.env.INTEGRATION_APP_RUNTIME_URL,
}));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("@/shared/auth/require-office-staff", () => ({
  OFFICE_STAFF_ROLES: new Set(["owner", "collaborator"]),
  requireOfficeStaff: jest.fn(),
}));

import { requireOfficeStaff } from "@/shared/auth/require-office-staff";
import {
  createCompanyAction,
  listCompaniesAction,
  listCompanyOptionsAction,
} from "@/shared/server/actions/pgr/companies";
import {
  changeCompanyModuleAction,
  getCompanyModuleOverviewAction,
} from "@/shared/server/actions/platform/company-modules";
import { createPgrAction } from "@/shared/server/actions/pgr/pgr";
import { adminClient, applyMigrations } from "../_helpers/db";
import { seedPgrBase, PGR_IDS as I } from "../_helpers/pgr-seed";

const enabled =
  !!process.env.INTEGRATION_APP_RUNTIME_URL && !!process.env.INTEGRATION_DATABASE_URL;
const gate = requireOfficeStaff as jest.Mock;
const as = (role: "owner" | "collaborator", userId = `${role}-1`, tenantId = "org_a") =>
  gate.mockResolvedValue({ userId, tenantId, role, plan: "free" });
type Module = "pgr" | "medicine";
const change = (companyId: string, module: Module, on: boolean, reason: string) =>
  changeCompanyModuleAction(companyId, { module, enabled: on, reason });

(enabled ? describe : describe.skip)("NOB-170 — estado dos serviços coerente", () => {
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
    await admin`insert into users (id, email) values ('owner-1','o1@example.test'), ('collaborator-1','c1@example.test'), ('owner-b','ob@example.test')`;
    await admin`insert into org_memberships (org_id, user_id, role) values ('org_a','owner-1','owner'), ('org_a','collaborator-1','org:member'), ('org_b','owner-b','owner')`;
    gate.mockReset();
    as("owner");
  });

  /** Estado de uma empresa em cada superfície (mesma sessão) e no banco. */
  async function surfaces(companyId: string) {
    const [listing, overview, pgrOptions, medOptions] = await Promise.all([
      listCompaniesAction({ pageSize: 100 }),
      getCompanyModuleOverviewAction(companyId),
      listCompanyOptionsAction("pgr"),
      listCompanyOptionsAction("medicine"),
    ]);
    if (!listing.ok || !overview.ok || !pgrOptions.ok || !medOptions.ok)
      throw new Error("consulta falhou");
    const row = listing.data.rows.find((r) => r.id === companyId);
    const db =
      await admin`select module, enabled from company_modules where company_id = ${companyId}`;
    const dbOn = (m: Module) => db.some((r) => r.module === m && r.enabled === true);
    const service = (m: Module) =>
      overview.data.modules.find((x) => x.module === m)?.enabled ?? null;
    return {
      listing: { pgr: row?.pgrEnabled, medicine: row?.medicineEnabled },
      services: { pgr: service("pgr"), medicine: service("medicine") },
      selectors: {
        pgr: pgrOptions.data.some((c) => c.id === companyId),
        medicine: medOptions.data.some((c) => c.id === companyId),
      },
      db: { pgr: dbOn("pgr"), medicine: dbOn("medicine") },
    };
  }
  const coherent = (state: { pgr: boolean; medicine: boolean }) => ({
    listing: state,
    services: state,
    selectors: state,
    db: state,
  });
  async function newCompany(razaoSocial: string) {
    const created = await createCompanyAction({ razaoSocial, riskGrade: 2 } as never);
    if (!created.ok) throw new Error(created.error.message);
    return created.data.id;
  }

  it("empresa antiga habilitada pela migration 0053: os dois serviços aparecem iguais em listagem, serviços, seletores e banco", async () => {
    // A e B do seed representam empresas pré-0053 (habilitadas pelo backfill).
    expect(await surfaces(I.companyA)).toEqual(coherent({ pgr: true, medicine: true }));
  });

  it("parcial, nenhum, alterações manuais e múltiplas: estado coerente e persistido em toda superfície", async () => {
    const onlyPgr = await newCompany("Só PGR Fictícia Ltda");
    const onlyMed = await newCompany("Só Medicina Fictícia Ltda");
    const none = await newCompany("Sem Serviços Fictícia Ltda");
    const toggled = await newCompany("Alterada Fictícia Ltda");
    expect((await change(onlyPgr, "pgr", true, "Contratação PGR")).ok).toBe(true);
    expect((await change(onlyMed, "medicine", true, "Contratação Medicina")).ok).toBe(
      true,
    );
    for (const [on, reason] of [
      [true, "Contratou"],
      [false, "Encerrou"],
      [true, "Recontratou"],
      [false, "Encerrou de novo"],
    ] as const)
      expect((await change(toggled, "pgr", on, reason)).ok).toBe(true);

    expect(await surfaces(onlyPgr)).toEqual(coherent({ pgr: true, medicine: false }));
    expect(await surfaces(onlyMed)).toEqual(coherent({ pgr: false, medicine: true }));
    expect(await surfaces(none)).toEqual(coherent({ pgr: false, medicine: false }));
    expect(await surfaces(toggled)).toEqual(coherent({ pgr: false, medicine: false }));

    // "Nova sessão": outro usuário do escritório (colaborador) lê o mesmo estado.
    as("collaborator");
    expect(await surfaces(onlyPgr)).toEqual(coherent({ pgr: true, medicine: false }));
    expect(await surfaces(toggled)).toEqual(coherent({ pgr: false, medicine: false }));

    // Histórico íntegro, do mais recente para o mais antigo, com ator e motivo.
    const history = await getCompanyModuleOverviewAction(toggled);
    expect(
      history.ok &&
        history.data.history.rows.map((e) => [
          e.previousEnabled,
          e.enabled,
          e.reason,
          e.changedBy,
        ]),
    ).toEqual([
      [true, false, "Encerrou de novo", "owner-1"],
      [false, true, "Recontratou", "owner-1"],
      [true, false, "Encerrou", "owner-1"],
      [false, true, "Contratou", "owner-1"],
    ]);
  });

  it("empresa com PGR existente: desabilitar preserva o PGR e tira do seletor; reabilitar devolve", async () => {
    as("owner");
    expect((await change(I.companyA, "pgr", false, "Pausa contratual")).ok).toBe(true);
    expect(await surfaces(I.companyA)).toEqual(coherent({ pgr: false, medicine: true }));
    const [{ count }] =
      await admin`select count(*)::int as count from pgr where company_id = ${I.companyA}`;
    expect(count).toBe(1);
    expect((await change(I.companyA, "pgr", true, "Retomada contratual")).ok).toBe(true);
    expect(await surfaces(I.companyA)).toEqual(coherent({ pgr: true, medicine: true }));
    as("collaborator");
    expect(
      (
        await createPgrAction({
          companyId: I.companyA,
          registrationType: "not_applicable",
          issuedAt: "2026-01-10",
          validUntil: "2027-01-10",
          declarationAccepted: true,
        })
      ).ok,
    ).toBe(true);
  });

  it("banco: só administrador do escritório altera serviços, mesmo por SQL direto ou com papel forjado no servidor", async () => {
    const runtime = (await import("postgres")).default(
      process.env.INTEGRATION_APP_RUNTIME_URL!,
      { max: 1, prepare: false },
    );
    const asActor = (
      actor: string,
      fn: (tx: postgres.TransactionSql) => Promise<unknown>,
    ) =>
      runtime.begin(async (tx) => {
        await tx`select set_config('app.current_org', 'org_a', true), set_config('app.current_actor', ${actor}, true)`;
        return fn(tx);
      });
    try {
      const disable = (tx: postgres.TransactionSql) =>
        tx`update company_modules set enabled = false where company_id = ${I.companyA} and module = 'pgr' returning id`;
      // Colaborador, ator de outro escritório e sessão sem ator: UPDATE não altera nada.
      for (const actor of ["collaborator-1", "owner-b", ""])
        expect(await asActor(actor, disable)).toHaveLength(0);
      const event = (actor: string, changedBy: string) =>
        asActor(
          actor,
          (
            tx,
          ) => tx`insert into company_module_events (org_id, company_id, module, previous_enabled, enabled, changed_by, reason)
            values ('org_a', ${I.companyA}, 'pgr', true, false, ${changedBy}, 'Forjado')`,
        );
      await expect(event("collaborator-1", "collaborator-1")).rejects.toMatchObject({
        code: "42501",
      });
      await expect(event("owner-1", "outra-pessoa")).rejects.toMatchObject({
        code: "42501",
      });
      await expect(
        asActor(
          "collaborator-1",
          (tx) => tx`insert into company_modules (org_id, company_id, module, enabled)
            values ('org_a', ${I.companyB}, 'pgr', true)`,
        ),
      ).rejects.toMatchObject({ code: expect.stringMatching(/42501|23503/) });
      expect(await surfaces(I.companyA)).toEqual(coherent({ pgr: true, medicine: true }));
      // Servidor com papel "owner" forjado para um colaborador: o banco recusa e nada muda.
      as("owner", "collaborator-1");
      const forged = await change(I.companyA, "pgr", false, "Tentativa forjada");
      expect(!forged.ok && forged.error.code).toBe("FORBIDDEN");
      as("owner");
      expect(await surfaces(I.companyA)).toEqual(coherent({ pgr: true, medicine: true }));
      expect(await admin`select * from company_module_events`).toHaveLength(0);
      // O administrador real altera por SQL com o próprio nome no evento.
      expect(await asActor("owner-1", disable)).toHaveLength(1);
    } finally {
      await runtime.end({ timeout: 5 });
    }
  });

  it("outro escritório: não vê o estado nem a empresa", async () => {
    as("owner", "owner-b", "org_b");
    const listing = await listCompaniesAction({});
    expect(listing.ok && listing.data.rows.map((r) => r.id)).toEqual([I.companyB]);
    expect(listing.ok && listing.data.rows[0]).toMatchObject({
      pgrEnabled: true,
      medicineEnabled: true,
    });
    const foreign = await getCompanyModuleOverviewAction(I.companyA);
    expect(!foreign.ok && foreign.error.code).toBe("NOT_FOUND");
  });
});
