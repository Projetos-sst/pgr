/**
 * Vínculo profissional ↔ conta (NOB-149) e autorização por vínculo (NOB-121) contra Postgres
 * efêmero: owner vincula e revoga com motivo, histórico sem DELETE, unicidade de vínculo aberto,
 * RLS com ator forjado, isolamento por tenant, perfil da sessão e "age como coordenador" só para
 * a conta vinculada ao médico da designação aberta. Dados 100% fictícios.
 */
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
import { isActorCompanyCoordinator } from "@/shared/db/repositories/medico-user-links";
import {
  link,
  myProfile,
  revoke,
} from "@/shared/server/medicine/professional-links-core";
import {
  getMyProfessionalProfileAction,
  linkMedicoUserAction,
  listMedicoUserLinksAction,
  revokeMedicoUserLinkAction,
} from "@/shared/server/actions/medicine/professional-links";
import { GET as LIST, POST as LINK } from "@/app/api/v1/medicos/[id]/user-links/route";
import { PUT as REVOKE } from "@/app/api/v1/medicos/[id]/user-links/[linkId]/route";
import { GET as ME } from "@/app/api/v1/me/professional/route";
import { adminClient, applyMigrations } from "../_helpers/db";
import { seedPgrBase, PGR_IDS as I } from "../_helpers/pgr-seed";

const enabled =
  !!process.env.INTEGRATION_APP_RUNTIME_URL && !!process.env.INTEGRATION_DATABASE_URL;
const owner: TenantContext = {
  tenantId: "org_a",
  userId: "owner",
  role: "owner",
  plan: "free",
};
const staff: TenantContext = { ...owner, userId: "staff", role: "collaborator" };
const doctor: TenantContext = { ...owner, userId: "doctor", role: "collaborator" };
const ownerB: TenantContext = {
  tenantId: "org_b",
  userId: "owner-b",
  role: "owner",
  plan: "pro",
};
const M = {
  coord: "aaaaaaaa-0000-4000-8000-000000000011",
  other: "aaaaaaaa-0000-4000-8000-000000000012",
  inactive: "aaaaaaaa-0000-4000-8000-000000000013",
  tenantB: "bbbbbbbb-0000-4000-8000-000000000011",
};
const REASON = "Profissional da equipe com acesso próprio.";

const req = (ctx: TenantContext, method = "GET", body?: unknown) =>
  new NextRequest("http://localhost/api/v1/medicos", {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      "x-dev-tenant": ctx.tenantId,
      "x-dev-user": ctx.userId,
      "x-dev-role": ctx.role,
    },
  });

(enabled ? describe : describe.skip)("professional links (NOB-149)", () => {
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
    await admin`insert into users (id,email) values ('owner','o@example.test'),('staff','s@example.test'),('doctor','d@example.test'),('owner-b','ob@example.test')`;
    await admin`insert into org_memberships (org_id,user_id,role) values ('org_a','owner','owner'),('org_a','staff','collaborator'),('org_a','doctor','collaborator'),('org_b','owner-b','owner')`;
    await admin`insert into medicos (id, org_id, name, crm, profession, registration_uf, rqe, affiliation, status) values
      (${M.coord}, 'org_a', 'Dra. Coordenadora Fictícia', '30001', 'physician', 'MA', '931', 'external', 'active'),
      (${M.other}, 'org_a', 'Dr. Outro Fictício', '30002', 'physician', 'MA', '932', 'internal', 'active'),
      (${M.inactive}, 'org_a', 'Dr. Inativo Fictício', '30003', 'physician', 'MA', '933', 'internal', 'inactive'),
      (${M.tenantB}, 'org_b', 'Dra. Outro Escritório', '40001', 'physician', 'PA', '941', 'internal', 'active')`;
    await admin`insert into pcmso_coordinator_assignments (org_id, company_id, medico_id, starts_on, created_by)
      values ('org_a', ${I.companyA}, ${M.coord}, '2026-01-01', 'owner')`;
    process.env.APP_ENV = "local";
    process.env.DEV_API_AUTH_BYPASS = "true";
    (requireOfficeStaff as jest.Mock).mockResolvedValue(owner);
  });

  it("owner vincula; a conta passa a agir como coordenadora só da empresa designada", async () => {
    expect(await isActorCompanyCoordinator(doctor, I.companyA)).toBe(false);
    const created = await link(owner, M.coord, { userId: "doctor", reason: REASON });
    expect(created).toMatchObject({
      userId: "doctor",
      linkedBy: "owner",
      revokedAt: null,
    });
    expect(await isActorCompanyCoordinator(doctor, I.companyA)).toBe(true);
    // Papel de owner não substitui o vínculo.
    expect(await isActorCompanyCoordinator(owner, I.companyA)).toBe(false);
    const profile = await myProfile(doctor);
    expect(profile).toMatchObject({
      medicoId: M.coord,
      rqe: "931",
      coordinatedCompanies: [expect.objectContaining({ companyId: I.companyA })],
    });
    expect(await myProfile(staff)).toBeNull();
  });

  it("revogação, designação encerrada, profissional inativo ou conta fora do escritório tiram a autorização", async () => {
    const created = await link(owner, M.coord, { userId: "doctor", reason: REASON });
    await admin`update pcmso_coordinator_assignments set ends_on='2026-06-30', end_reason='Encerramento fictício', ended_by='owner'`;
    expect(await isActorCompanyCoordinator(doctor, I.companyA)).toBe(false);
    await admin`update pcmso_coordinator_assignments set ends_on=null, end_reason=null, ended_by=null`;
    await admin`update medicos set status='inactive' where id=${M.coord}`;
    expect(await isActorCompanyCoordinator(doctor, I.companyA)).toBe(false);
    expect(await myProfile(doctor)).toBeNull();
    await admin`update medicos set status='active' where id=${M.coord}`;
    await admin`delete from org_memberships where user_id='doctor'`;
    expect(await isActorCompanyCoordinator(doctor, I.companyA)).toBe(false);
    await admin`insert into org_memberships (org_id,user_id,role) values ('org_a','doctor','collaborator')`;
    await revoke(owner, M.coord, created.id, { reason: "Saída fictícia da equipe." });
    expect(await isActorCompanyCoordinator(doctor, I.companyA)).toBe(false);
  });

  it("histórico: revogar encerra, revogado não muda e novo vínculo é permitido", async () => {
    const first = await link(owner, M.coord, { userId: "doctor", reason: REASON });
    await revoke(owner, M.coord, first.id, { reason: "Troca fictícia de conta." });
    await expect(
      revoke(owner, M.coord, first.id, { reason: "Segunda revogação fictícia." }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await link(owner, M.coord, { userId: "staff", reason: REASON });
    const history = await listMedicoUserLinksAction(M.coord);
    expect(
      history.ok && history.data.map((l) => [l.userId, l.revokedAt === null]),
    ).toEqual([
      ["staff", true],
      ["doctor", false],
    ]);
  });

  it("um vínculo aberto por profissional e por conta (DUPLICATE)", async () => {
    await link(owner, M.coord, { userId: "doctor", reason: REASON });
    const sameMedico = await linkMedicoUserAction(M.coord, {
      userId: "staff",
      reason: REASON,
    });
    expect(!sameMedico.ok && sameMedico.error.code).toBe("DUPLICATE");
    const sameUser = await linkMedicoUserAction(M.other, {
      userId: "doctor",
      reason: REASON,
    });
    expect(!sameUser.ok && sameUser.error.code).toBe("DUPLICATE");
  });

  it("validações: conta de outro escritório, profissional inativo, motivo curto", async () => {
    const outsider = await linkMedicoUserAction(M.coord, {
      userId: "owner-b",
      reason: REASON,
    });
    expect(!outsider.ok && outsider.error.code).toBe("VALIDATION");
    const inactive = await linkMedicoUserAction(M.inactive, {
      userId: "doctor",
      reason: REASON,
    });
    expect(!inactive.ok && inactive.error.code).toBe("VALIDATION");
    const short = await linkMedicoUserAction(M.coord, {
      userId: "doctor",
      reason: "curto",
    });
    expect(!short.ok && short.error.code).toBe("VALIDATION");
    expect(await admin`select * from medico_user_links`).toHaveLength(0);
  });

  it("só o owner vincula; owner forjado é barrado pela RLS e nada é gravado", async () => {
    (requireOfficeStaff as jest.Mock).mockResolvedValue(staff);
    const denied = await linkMedicoUserAction(M.coord, {
      userId: "doctor",
      reason: REASON,
    });
    expect(!denied.ok && denied.error.code).toBe("FORBIDDEN");
    (requireOfficeStaff as jest.Mock).mockResolvedValue({ ...staff, role: "owner" });
    const forged = await linkMedicoUserAction(M.coord, {
      userId: "doctor",
      reason: REASON,
    });
    expect(!forged.ok && forged.error.code).toBe("FORBIDDEN");
    expect(await admin`select * from medico_user_links`).toHaveLength(0);
  });

  it("app_runtime não apaga nem troca a conta de um vínculo (42501)", async () => {
    const created = await link(owner, M.coord, { userId: "doctor", reason: REASON });
    const asOwner = (fn: (tx: postgres.TransactionSql) => Promise<unknown>) =>
      runtime.begin(async (tx) => {
        await tx`select set_config('app.current_org', 'org_a', true), set_config('app.current_actor', 'owner', true)`;
        return fn(tx);
      });
    await expect(
      asOwner((tx) => tx`delete from medico_user_links where id=${created.id}`),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      asOwner(
        (tx) => tx`update medico_user_links set user_id='staff' where id=${created.id}`,
      ),
    ).rejects.toMatchObject({ code: "42501" });
  });

  it("isolamento: outro tenant não vê nem vincula profissionais de org_a", async () => {
    (requireOfficeStaff as jest.Mock).mockResolvedValue(ownerB);
    const list = await listMedicoUserLinksAction(M.coord);
    expect(!list.ok && list.error.code).toBe("NOT_FOUND");
    const linked = await linkMedicoUserAction(M.coord, {
      userId: "owner-b",
      reason: REASON,
    });
    expect(!linked.ok && linked.error.code).toBe("NOT_FOUND");
    expect(await isActorCompanyCoordinator(ownerB, I.companyA)).toBe(false);
  });

  it("REST: vincular (201), listar, revogar, perfil da sessão e papéis", async () => {
    const id = { params: Promise.resolve({ id: M.coord }) };
    const created = await LINK(
      req(owner, "POST", { userId: "doctor", reason: REASON }),
      id,
    );
    expect(created.status).toBe(201);
    const body = await created.json();
    expect((await LIST(req(staff), id)).status).toBe(200);
    expect(
      (await LINK(req(staff, "POST", { userId: "staff", reason: REASON }), id)).status,
    ).toBe(403);
    expect((await LIST(req({ ...owner, role: "client" }), id)).status).toBe(403);
    expect((await LIST(req(ownerB), id)).status).toBe(404);
    const me = await ME(req(doctor));
    expect(me.status).toBe(200);
    expect((await me.json()).medicoId).toBe(M.coord);
    const revoked = await REVOKE(
      req(owner, "PUT", { reason: "Revogação fictícia via REST." }),
      {
        params: Promise.resolve({ id: M.coord, linkId: body.id }),
      },
    );
    expect(revoked.status).toBe(200);
    expect(await (await ME(req(doctor))).json()).toBeNull();
    (requireOfficeStaff as jest.Mock).mockResolvedValue(doctor);
    const profile = await getMyProfessionalProfileAction();
    expect(profile.ok && profile.data).toBeNull();
    const rev = await revokeMedicoUserLinkAction(M.coord, body.id, {
      reason: "Outra revogação fictícia.",
    });
    expect(!rev.ok && rev.error.code).toBe("FORBIDDEN");
  });
});
