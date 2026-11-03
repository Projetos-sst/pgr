/**
 * Vínculo profissional ↔ conta (NOB-149, NOB-157) e autorização por vínculo (NOB-121) contra
 * Postgres efêmero:
 * - o owner convida e o vínculo só nasce do aceite da própria conta convidada;
 * - o autovínculo do owner exige a aprovação de outro owner;
 * - recusa, cancelamento e expiração não geram vínculo;
 * - SQL forjado com o papel do app é barrado;
 * - revogação com motivo, histórico sem DELETE, unicidade e isolamento por tenant;
 * - "age como coordenador" só para a conta vinculada ao médico da designação aberta.
 * Dados 100% fictícios.
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
  actOnInvitation,
  invite,
  listInvitations,
  myPendingInvitations,
  myProfile,
  revoke,
} from "@/shared/server/medicine/professional-links-core";
import {
  getMyProfessionalProfileAction,
  inviteMedicoUserAction,
  listMedicoUserLinksAction,
  revokeMedicoUserLinkAction,
} from "@/shared/server/actions/medicine/professional-links";
import { GET as LIST } from "@/app/api/v1/medicos/[id]/user-links/route";
import { PUT as REVOKE } from "@/app/api/v1/medicos/[id]/user-links/[linkId]/route";
import {
  GET as LIST_INVITATIONS,
  POST as INVITE,
} from "@/app/api/v1/medicos/[id]/user-link-invitations/route";
import { POST as ACT } from "@/app/api/v1/medicos/[id]/user-link-invitations/[invitationId]/[action]/route";
import { GET as MY_INVITATIONS } from "@/app/api/v1/me/professional-invitations/route";
import { GET as ME } from "@/app/api/v1/me/professional/route";
import { adminClient, applyMigrations } from "../_helpers/db";
import { seedPgrBase, PGR_IDS as I } from "../_helpers/pgr-seed";
import {
  linkByInvitation as link,
  verifyIdentityForTest,
} from "../_helpers/professional-link";

const enabled =
  !!process.env.INTEGRATION_APP_RUNTIME_URL && !!process.env.INTEGRATION_DATABASE_URL;
const owner: TenantContext = {
  tenantId: "org_a",
  userId: "owner",
  role: "owner",
  plan: "free",
};
const owner2: TenantContext = { ...owner, userId: "owner2" };
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

(enabled ? describe : describe.skip)("professional links (NOB-149, NOB-157)", () => {
  let admin: ReturnType<typeof postgres>;
  let runtime: ReturnType<typeof postgres>;
  const originalEnv = { ...process.env };
  beforeAll(async () => {
    admin = adminClient();
    await admin`set client_min_messages = warning`;
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
    jest.clearAllMocks();
    await seedPgrBase(admin);
    await admin`insert into users (id,email) values ('owner','o@example.test'),('owner2','o2@example.test'),('staff','s@example.test'),('doctor','d@example.test'),('owner-b','ob@example.test')`;
    await admin`insert into org_memberships (org_id,user_id,role) values ('org_a','owner','owner'),('org_a','owner2','owner'),('org_a','staff','collaborator'),('org_a','doctor','collaborator'),('org_b','owner-b','owner')`;
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

  const asRuntime = (
    actor: string,
    fn: (tx: postgres.TransactionSql) => Promise<unknown>,
  ) =>
    runtime.begin(async (tx) => {
      await tx`select set_config('app.current_org', 'org_a', true), set_config('app.current_actor', ${actor}, true)`;
      return fn(tx);
    });

  it("convite + aceite da própria conta: só então a conta age como coordenadora", async () => {
    const invitation = await invite(owner, M.coord, { userId: "doctor", reason: REASON });
    expect(invitation).toMatchObject({
      status: "pending_acceptance",
      selfInvitation: false,
    });
    // Convite sozinho não dá acesso.
    expect(await isActorCompanyCoordinator(doctor, I.companyA)).toBe(false);
    expect((await myPendingInvitations(doctor)).map((i) => i.id)).toEqual([
      invitation.id,
    ]);
    const accepted = await actOnInvitation(doctor, M.coord, invitation.id, "accept");
    expect(accepted.status).toBe("linked");
    // NOB-158: vínculo aceito sem verificação independente não dá acesso clínico.
    expect(await isActorCompanyCoordinator(doctor, I.companyA)).toBe(false);
    await verifyIdentityForTest("org_a", M.coord, "doctor");
    expect(await isActorCompanyCoordinator(doctor, I.companyA)).toBe(true);
    // Papel de owner não substitui o vínculo.
    expect(await isActorCompanyCoordinator(owner, I.companyA)).toBe(false);
    const [created] = await admin`select linked_by, invitation_id from medico_user_links`;
    expect(created).toEqual({ linked_by: "doctor", invitation_id: invitation.id });
    const [event] =
      await admin`select kind, actor_user_id, statement from medico_link_invitation_events`;
    expect(event).toMatchObject({ kind: "accepted", actor_user_id: "doctor" });
    expect(event.statement).toContain("Dra. Coordenadora Fictícia");
    expect(event.statement).toContain("CRM 30001/MA");
    expect(await myProfile(doctor)).toMatchObject({
      medicoId: M.coord,
      rqe: "931",
      coordinatedCompanies: [expect.objectContaining({ companyId: I.companyA })],
    });
    expect(await myProfile(staff)).toBeNull();
    expect(await myPendingInvitations(doctor)).toEqual([]);
  });

  it("terceiros não aceitam pela conta convidada; recusa, cancelamento e expiração não geram vínculo", async () => {
    const invitation = await invite(owner, M.coord, { userId: "doctor", reason: REASON });
    for (const ctx of [owner, staff, owner2])
      await expect(
        actOnInvitation(ctx, M.coord, invitation.id, "accept"),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      actOnInvitation(staff, M.coord, invitation.id, "decline"),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      actOnInvitation(doctor, M.coord, invitation.id, "cancel"),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    const declined = await actOnInvitation(doctor, M.coord, invitation.id, "decline");
    expect(declined.status).toBe("declined");
    await expect(
      actOnInvitation(doctor, M.coord, invitation.id, "accept"),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    const second = await invite(owner, M.coord, { userId: "doctor", reason: REASON });
    await expect(
      invite(owner, M.coord, { userId: "staff", reason: REASON }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    expect((await actOnInvitation(owner, M.coord, second.id, "cancel")).status).toBe(
      "cancelled",
    );
    await expect(
      actOnInvitation(doctor, M.coord, second.id, "accept"),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    const third = await invite(owner, M.coord, { userId: "doctor", reason: REASON });
    await admin`update medico_link_invitations set invited_at = now() - interval '10 days', expires_at = now() - interval '1 day' where id=${third.id}`;
    expect(
      (await listInvitations(owner, M.coord)).find((i) => i.id === third.id)?.status,
    ).toBe("expired");
    await expect(
      actOnInvitation(doctor, M.coord, third.id, "accept"),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    expect(await admin`select id from medico_user_links`).toHaveLength(0);
    expect(await isActorCompanyCoordinator(doctor, I.companyA)).toBe(false);
  });

  it("autovínculo do owner: aceite não basta; o próprio owner não aprova; outro owner aprova", async () => {
    const invitation = await invite(owner, M.coord, { userId: "owner", reason: REASON });
    expect(invitation.selfInvitation).toBe(true);
    const accepted = await actOnInvitation(owner, M.coord, invitation.id, "accept");
    expect(accepted.status).toBe("pending_approval");
    expect(await admin`select id from medico_user_links`).toHaveLength(0);
    expect(await isActorCompanyCoordinator(owner, I.companyA)).toBe(false);
    await expect(
      actOnInvitation(owner, M.coord, invitation.id, "approve"),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      actOnInvitation(staff, M.coord, invitation.id, "approve"),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    const approved = await actOnInvitation(owner2, M.coord, invitation.id, "approve");
    expect(approved.status).toBe("linked");
    const [created] = await admin`select user_id, linked_by from medico_user_links`;
    expect(created).toEqual({ user_id: "owner", linked_by: "owner2" });
    // O owner legitimamente médico exerce a função depois da segunda aprovação E da verificação
    // independente da identidade (NOB-158).
    expect(await isActorCompanyCoordinator(owner, I.companyA)).toBe(false);
    await verifyIdentityForTest("org_a", M.coord, "owner");
    expect(await isActorCompanyCoordinator(owner, I.companyA)).toBe(true);
    // Convite comum não aceita "aprovação".
    const other = await invite(owner, M.other, { userId: "staff", reason: REASON });
    await expect(
      actOnInvitation(owner2, M.other, other.id, "approve"),
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("SQL direto com o papel do app: nenhuma associação forjada passa", async () => {
    // Vínculo direto (fluxo antigo da NOB-149) → barrado.
    await expect(
      asRuntime(
        "owner",
        (tx) =>
          tx`insert into medico_user_links (org_id, medico_id, user_id, reason, linked_by) values ('org_a', ${M.coord}, 'owner', 'Forjado fictício.', 'owner')`,
      ),
    ).rejects.toMatchObject({ code: "42501" });
    const self = await invite(owner, M.coord, { userId: "owner", reason: REASON });
    const toDoctor = await invite(owner, M.other, { userId: "doctor", reason: REASON });
    const insertLink = (
      actor: string,
      medico: string,
      user: string,
      invitationId: string,
    ) =>
      asRuntime(
        actor,
        (tx) =>
          tx`insert into medico_user_links (org_id, medico_id, user_id, reason, linked_by, invitation_id) values ('org_a', ${medico}, ${user}, 'Forjado fictício.', ${actor}, ${invitationId})`,
      );
    const insertEvent = (actor: string, invitationId: string, kind: string, as = actor) =>
      asRuntime(
        actor,
        (tx) =>
          tx`insert into medico_link_invitation_events (org_id, invitation_id, kind, actor_user_id, statement) values ('org_a', ${invitationId}, ${kind}, ${as}, ${kind === "accepted" ? "Declaração forjada." : null})`,
      );
    // Convite sem aceite não gera vínculo.
    await expect(
      insertLink("doctor", M.other, "doctor", toDoctor.id),
    ).rejects.toMatchObject({
      code: "42501",
    });
    // Owner aceitando pela conta convidada (com ou sem forjar o autor do evento) → barrado.
    await expect(insertEvent("owner", toDoctor.id, "accepted")).rejects.toMatchObject({
      code: "42501",
    });
    await expect(
      insertEvent("owner", toDoctor.id, "accepted", "doctor"),
    ).rejects.toMatchObject({ code: "42501" });
    // Autovínculo: o owner aceita o próprio convite, mas não aprova nem cria o vínculo sozinho.
    await insertEvent("owner", self.id, "accepted");
    await expect(insertEvent("owner", self.id, "approved")).rejects.toMatchObject({
      code: "42501",
    });
    await expect(insertLink("owner", M.coord, "owner", self.id)).rejects.toMatchObject({
      code: "42501",
    });
    // Colaborador não aprova; outro owner aprova e cria o vínculo em nome próprio.
    await expect(insertEvent("staff", self.id, "approved")).rejects.toMatchObject({
      code: "42501",
    });
    await insertEvent("owner2", self.id, "approved");
    // Com o aceite e a aprovação de outro owner, o vínculo pode ser materializado.
    await insertLink("owner2", M.coord, "owner", self.id);
    // O mesmo convite não gera segundo vínculo, nem depois de revogado.
    const [linked] =
      await admin`select id from medico_user_links where invitation_id=${self.id}`;
    await revoke(owner, M.coord, linked.id, { reason: "Revogação fictícia de teste." });
    await expect(insertLink("owner2", M.coord, "owner", self.id)).rejects.toMatchObject({
      code: expect.stringMatching(/23505|42501/),
    });
    // Convites e eventos: sem UPDATE nem DELETE.
    await expect(
      asRuntime("owner", (tx) => tx`update medico_link_invitations set user_id='owner'`),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      asRuntime("owner", (tx) => tx`delete from medico_link_invitation_events`),
    ).rejects.toMatchObject({ code: "42501" });
    // Só o owner cria convites, em nome próprio.
    await expect(
      asRuntime(
        "staff",
        (tx) =>
          tx`insert into medico_link_invitations (org_id, medico_id, user_id, reason, invited_by) values ('org_a', ${M.coord}, 'staff', 'Forjado fictício.', 'staff')`,
      ),
    ).rejects.toMatchObject({ code: "42501" });
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

  it("histórico: revogar encerra, revogado não muda e novo convite aceito vincula outra conta", async () => {
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

  it("vínculo aberto: profissional vinculado não recebe convite; conta vinculada não aceita outro (DUPLICATE)", async () => {
    await link(owner, M.coord, { userId: "doctor", reason: REASON });
    const sameMedico = await inviteMedicoUserAction(M.coord, {
      userId: "staff",
      reason: REASON,
    });
    expect(!sameMedico.ok && sameMedico.error.code).toBe("VALIDATION");
    const invitation = await invite(owner, M.other, { userId: "doctor", reason: REASON });
    const sameUser = await ACT(req(doctor, "POST"), {
      params: Promise.resolve({
        id: M.other,
        invitationId: invitation.id,
        action: "accept",
      }),
    });
    expect(sameUser.status).toBe(409);
  });

  it("validações: conta de outro escritório, profissional inativo, motivo curto", async () => {
    const outsider = await inviteMedicoUserAction(M.coord, {
      userId: "owner-b",
      reason: REASON,
    });
    expect(!outsider.ok && outsider.error.code).toBe("VALIDATION");
    const inactive = await inviteMedicoUserAction(M.inactive, {
      userId: "doctor",
      reason: REASON,
    });
    expect(!inactive.ok && inactive.error.code).toBe("VALIDATION");
    const short = await inviteMedicoUserAction(M.coord, {
      userId: "doctor",
      reason: "curto",
    });
    expect(!short.ok && short.error.code).toBe("VALIDATION");
    expect(await admin`select * from medico_link_invitations`).toHaveLength(0);
    expect(await admin`select * from medico_user_links`).toHaveLength(0);
  });

  it("só o owner convida; owner forjado é barrado pela RLS e nada é gravado", async () => {
    (requireOfficeStaff as jest.Mock).mockResolvedValue(staff);
    const denied = await inviteMedicoUserAction(M.coord, {
      userId: "doctor",
      reason: REASON,
    });
    expect(!denied.ok && denied.error.code).toBe("FORBIDDEN");
    (requireOfficeStaff as jest.Mock).mockResolvedValue({ ...staff, role: "owner" });
    const forged = await inviteMedicoUserAction(M.coord, {
      userId: "doctor",
      reason: REASON,
    });
    expect(!forged.ok && forged.error.code).toBe("FORBIDDEN");
    expect(await admin`select * from medico_link_invitations`).toHaveLength(0);
  });

  it("app_runtime não apaga nem troca a conta de um vínculo (42501)", async () => {
    const created = await link(owner, M.coord, { userId: "doctor", reason: REASON });
    await expect(
      asRuntime(
        "owner",
        (tx) => tx`delete from medico_user_links where id=${created.id}`,
      ),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      asRuntime(
        "owner",
        (tx) => tx`update medico_user_links set user_id='staff' where id=${created.id}`,
      ),
    ).rejects.toMatchObject({ code: "42501" });
  });

  it("isolamento: outro tenant não vê nem convida profissionais de org_a", async () => {
    (requireOfficeStaff as jest.Mock).mockResolvedValue(ownerB);
    const list = await listMedicoUserLinksAction(M.coord);
    expect(!list.ok && list.error.code).toBe("NOT_FOUND");
    const invited = await inviteMedicoUserAction(M.coord, {
      userId: "owner-b",
      reason: REASON,
    });
    expect(!invited.ok && invited.error.code).toBe("NOT_FOUND");
    expect(await isActorCompanyCoordinator(ownerB, I.companyA)).toBe(false);
  });

  it("REST: convidar (201), aceitar pela conta, listar, revogar, perfil da sessão e papéis", async () => {
    const id = { params: Promise.resolve({ id: M.coord }) };
    const created = await INVITE(
      req(owner, "POST", { userId: "doctor", reason: REASON }),
      id,
    );
    expect(created.status).toBe(201);
    const invitation = await created.json();
    expect(
      (await INVITE(req(staff, "POST", { userId: "staff", reason: REASON }), id)).status,
    ).toBe(403);
    expect((await LIST_INVITATIONS(req(staff), id)).status).toBe(200);
    const mine = await MY_INVITATIONS(req(doctor));
    expect((await mine.json()).map((i: { id: string }) => i.id)).toEqual([invitation.id]);
    const act = (ctx: TenantContext, action: string) =>
      ACT(req(ctx, "POST"), {
        params: Promise.resolve({ id: M.coord, invitationId: invitation.id, action }),
      });
    expect((await act(owner, "accept")).status).toBe(403);
    expect((await act(doctor, "bogus")).status).toBe(404);
    expect((await act(doctor, "accept")).status).toBe(200);
    const links = await LIST(req(staff), id);
    expect(links.status).toBe(200);
    const [linked] = await links.json();
    expect((await LIST(req({ ...owner, role: "client" }), id)).status).toBe(403);
    expect((await LIST(req(ownerB), id)).status).toBe(404);
    const me = await ME(req(doctor));
    expect(me.status).toBe(200);
    expect((await me.json()).medicoId).toBe(M.coord);
    const revoked = await REVOKE(
      req(owner, "PUT", { reason: "Revogação fictícia via REST." }),
      { params: Promise.resolve({ id: M.coord, linkId: linked.id }) },
    );
    expect(revoked.status).toBe(200);
    expect(await (await ME(req(doctor))).json()).toBeNull();
    (requireOfficeStaff as jest.Mock).mockResolvedValue(doctor);
    const profile = await getMyProfessionalProfileAction();
    expect(profile.ok && profile.data).toBeNull();
    const rev = await revokeMedicoUserLinkAction(M.coord, linked.id, {
      reason: "Outra revogação fictícia.",
    });
    expect(!rev.ok && rev.error.code).toBe("FORBIDDEN");
  });
});
