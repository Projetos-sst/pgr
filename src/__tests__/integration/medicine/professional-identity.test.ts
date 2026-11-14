/**
 * Verificação independente da identidade profissional (NOB-158), vínculos legados (NOB-159) e
 * único owner médico (NOB-160), contra Postgres efêmero:
 * - acesso clínico só com identidade verificada por operador designado, independente do escritório;
 * - conta alternativa do owner, segundo owner, verificação forjada e operador verificando a si mesmo
 *   são barrados (servidor e SQL);
 * - vínculo legado exige verificação E reconfirmação da própria conta;
 * - revogação, expiração e mudança de CRM/UF cortam o acesso;
 * - autovínculo do único owner é concluído só com verificação independente.
 * Dados fictícios.
 */
import type postgres from "postgres";
import { NextRequest } from "next/server";
jest.mock("@/shared/db/env", () => ({
  getDatabaseUrl: () => process.env.INTEGRATION_APP_RUNTIME_URL,
}));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
// Gate de master da fila do operador (sessão Clerk real; o bypass dev não o substitui).
jest.mock("@/shared/auth/require-master", () => ({ requireMaster: jest.fn() }));
import { ForbiddenError } from "@/shared/auth/errors";
import { requireMaster } from "@/shared/auth/require-master";
import type { TenantContext } from "@/shared/auth/require-tenant-context";
import { closeVerifierConnection } from "@/shared/db/identity-verifier-db";
import { isActorCompanyCoordinator } from "@/shared/db/repositories/medico-user-links";
import {
  challengeMatches,
  currentChallengeCode,
} from "@/shared/server/medicine/identity-challenge";
import {
  approveVerification,
  myProfessionalIdentity,
  reconfirmLink,
  rejectRequest,
  requestVerification,
  revokeVerification,
  verificationQueue,
} from "@/shared/server/medicine/identity-verification-core";
import {
  actOnInvitation,
  invite,
} from "@/shared/server/medicine/professional-links-core";
import { GET as MY_IDENTITY } from "@/app/api/v1/me/professional-identity/route";
import { POST as REQUEST } from "@/app/api/v1/me/professional-identity/requests/route";
import {
  GET as QUEUE,
  POST as APPROVE,
} from "@/app/api/v1/admin/identity-verifications/route";
import { POST as REJECT } from "@/app/api/v1/admin/identity-verifications/requests/[id]/reject/route";
import { POST as REVOKE } from "@/app/api/v1/admin/identity-verifications/[id]/revoke/route";
import { adminClient, applyMigrations } from "../_helpers/db";
import { seedPgrBase, PGR_IDS as I } from "../_helpers/pgr-seed";
import { linkByInvitation } from "../_helpers/professional-link";

const enabled =
  !!process.env.INTEGRATION_APP_RUNTIME_URL && !!process.env.INTEGRATION_DATABASE_URL;
const ctxOf = (
  userId: string,
  role: TenantContext["role"] = "collaborator",
): TenantContext => ({
  tenantId: "org_a",
  userId,
  role,
  plan: "free",
});
const owner = ctxOf("owner", "owner");
const owner2 = ctxOf("owner2", "owner");
const doctor = ctxOf("doctor");
const alt = ctxOf("owner-alt");
const staff = ctxOf("staff");
const VERIFIER = "verifier";
const VERIFIER_MEMBER = "verifier-member";
const UNDESIGNATED = "master-nd";
const VERIFIER_2 = "verifier-2";
const M1 = "aaaaaaaa-0000-4000-8000-000000000081";
const M2 = "aaaaaaaa-0000-4000-8000-000000000082";
const REASON = "Profissional fictício com acesso próprio.";
const CHECKLIST = {
  identityDocument: true,
  professionalDocument: true,
  registryStatus: true,
  personMatches: true,
  accountControl: true,
};

const req = (
  userId: string,
  role: string,
  method = "GET",
  body?: unknown,
  tenant = "org_a",
) =>
  new NextRequest("http://localhost/api/v1/me", {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      "x-dev-tenant": tenant,
      "x-dev-user": userId,
      "x-dev-role": role,
    },
  });

(enabled ? describe : describe.skip)("Identidade profissional (NOB-158/159/160)", () => {
  let admin: ReturnType<typeof postgres>;
  let runtime: ReturnType<typeof postgres>;
  const originalEnv = { ...process.env };
  beforeAll(async () => {
    admin = adminClient();
    await admin`set client_min_messages = warning`;
    await applyMigrations(admin);
    // Conta de login do operador (membro do papel identity_verifier), como a infraestrutura faria.
    await admin.unsafe(`DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'identity_verifier_test') THEN
        CREATE ROLE identity_verifier_test LOGIN PASSWORD 'identity_verifier_test' IN ROLE identity_verifier;
      END IF; END $$;`);
    const url = new URL(process.env.INTEGRATION_APP_RUNTIME_URL!);
    url.username = "identity_verifier_test";
    url.password = "identity_verifier_test";
    process.env.IDENTITY_VERIFIER_DATABASE_URL = url.toString();
    process.env.IDENTITY_CHALLENGE_SECRET = "segredo-ficticio-de-teste";
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
    await closeVerifierConnection();
    await runtime?.end({ timeout: 5 });
    await admin?.end({ timeout: 5 });
  });
  beforeEach(async () => {
    await seedPgrBase(admin);
    await admin`delete from identity_verifiers`;
    await admin`insert into users (id,email) values ('owner','o@example.test'),('owner2','o2@example.test'),('doctor','d@example.test'),('owner-alt','oa@example.test'),('staff','s@example.test'),('verifier','v@example.test'),('verifier-member','vm@example.test'),('master-nd','m@example.test'),('verifier-2','v2@example.test'),('owner-b','ob@example.test')`;
    await admin`insert into org_memberships (org_id,user_id,role) values ('org_a','owner','owner'),('org_a','owner2','owner'),('org_a','doctor','collaborator'),('org_a','owner-alt','collaborator'),('org_a','staff','collaborator'),('org_a','verifier-member','collaborator'),('org_b','owner-b','owner')`;
    await admin`insert into identity_verifiers (user_id, designated_by) values ('verifier','ops-provisioning'),('verifier-member','ops-provisioning'),('verifier-2','ops-provisioning')`;
    await admin`insert into medicos (id, org_id, name, crm, profession, registration_uf, status) values
      (${M1}, 'org_a', 'Dra. Coordenadora Fictícia', '90001', 'physician', 'MA', 'active'),
      (${M2}, 'org_a', 'Dr. Segundo Fictício', '90002', 'physician', 'MA', 'active')`;
    await admin`insert into pcmso_coordinator_assignments (org_id, company_id, medico_id, starts_on, created_by)
      values ('org_a', ${I.companyA}, ${M1}, '2026-01-01', 'owner')`;
    process.env.APP_ENV = "local";
    process.env.DEV_API_AUTH_BYPASS = "true";
    (requireMaster as jest.Mock).mockReset();
    (requireMaster as jest.Mock).mockRejectedValue(
      new ForbiddenError("Acesso restrito a administradores da plataforma."),
    );
  });

  const asRuntime = <T>(
    actor: string,
    fn: (tx: postgres.TransactionSql) => Promise<T>,
    org = "org_a",
  ) =>
    runtime.begin(async (tx) => {
      await tx`select set_config('app.current_org', ${org}, true)`;
      await tx`select set_config('app.current_actor', ${actor}, true)`;
      return fn(tx);
    }) as Promise<T>;
  const approval = (
    requestId: string,
    userId: string,
    overrides: Record<string, unknown> = {},
  ) => ({
    requestId,
    method: "live_video",
    crm: "90001",
    registrationUf: "MA",
    registrySource: "Consulta pública fictícia do CFM",
    challengeCode: currentChallengeCode(requestId, userId),
    checklist: CHECKLIST,
    ...overrides,
  });
  /** Código de 6 dígitos que não confere em nenhuma das duas janelas válidas. */
  const wrongCode = (requestId: string, userId: string) => {
    for (let n = 0; ; n += 1) {
      const code = String(n).padStart(6, "0");
      if (!challengeMatches(requestId, userId, code)) return code;
    }
  };
  const linkDoctor = () =>
    linkByInvitation(owner, M1, { userId: "doctor", reason: REASON }, undefined, {
      verify: false,
    });

  it("vínculo sem verificação não dá acesso; pedido, desafio e aprovação independente liberam", async () => {
    await linkDoctor();
    expect(await isActorCompanyCoordinator(doctor, I.companyA)).toBe(false);
    const { id: requestId } = await requestVerification(doctor, { medicoId: M1 });
    const [mine] = await myProfessionalIdentity(doctor);
    expect(mine).toMatchObject({
      status: "in_review",
      clinicalAccess: false,
      openRequestId: requestId,
    });
    expect(mine.challengeCode).toMatch(/^\d{6}$/);
    await expect(requestVerification(doctor, { medicoId: M1 })).rejects.toMatchObject({
      code: "VALIDATION",
    });
    // Código errado, checklist incompleto e CRM divergente → recusados.
    await expect(
      approveVerification(
        VERIFIER,
        approval(requestId, "doctor", { challengeCode: wrongCode(requestId, "doctor") }),
      ),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(
      approveVerification(
        VERIFIER,
        approval(requestId, "doctor", {
          checklist: { ...CHECKLIST, personMatches: false },
        }),
      ),
    ).rejects.toThrow();
    await expect(
      approveVerification(VERIFIER, approval(requestId, "doctor", { crm: "99999" })),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await approveVerification(VERIFIER, approval(requestId, "doctor"));
    expect(await isActorCompanyCoordinator(doctor, I.companyA)).toBe(true);
    const [after] = await myProfessionalIdentity(doctor);
    expect(after).toMatchObject({ status: "verified", clinicalAccess: true });
    const queue = await verificationQueue(VERIFIER);
    expect(queue.pending).toHaveLength(0);
    expect(queue.active).toHaveLength(1);
    expect(JSON.stringify(queue)).not.toMatch(/cid|diagn/i);
  });

  it("conta alternativa do owner e segundo owner sob controle não obtêm acesso clínico sem verificação", async () => {
    // Owner convida um e-mail próprio adicional: a conta aceita sozinha, mas sem verificação não há acesso.
    await linkByInvitation(
      owner,
      M1,
      { userId: "owner-alt", reason: REASON },
      undefined,
      {
        verify: false,
      },
    );
    expect(await isActorCompanyCoordinator(alt, I.companyA)).toBe(false);
    // Autovínculo aprovado por um segundo owner: o vínculo nasce, mas sem verificação não há acesso.
    await linkByInvitation(owner, M2, { userId: "owner", reason: REASON }, owner2, {
      verify: false,
    });
    expect(
      (await myProfessionalIdentity(owner)).find((i) => i.medicoId === M2)
        ?.clinicalAccess,
    ).toBe(false);
    // Nem o owner nem a conta alternativa conseguem se declarar verificados ou operadores.
    for (const actor of ["owner", "owner-alt", "owner2"]) {
      await expect(
        asRuntime(
          actor,
          (tx) =>
            tx`insert into professional_identity_verifications (org_id, request_id, medico_id, user_id, crm, registration_uf, method, checklist, registry_source, verified_by, expires_at)
              select 'org_a', id, medico_id, user_id, '90001', 'MA', 'in_person', ${tx.json(CHECKLIST)}, 'Forjada', ${actor}, now() + interval '1 month'
              from professional_identity_requests limit 1`,
        ),
      ).rejects.toMatchObject({ code: "42501" });
      await expect(
        asRuntime(
          actor,
          (tx) =>
            tx`insert into identity_verifiers (user_id, designated_by) values (${actor}, ${actor})`,
        ),
      ).rejects.toMatchObject({ code: "42501" });
    }
    // Owner não é operador designado: a fila e a aprovação são recusadas.
    await expect(verificationQueue("owner")).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("operador não verifica a si mesmo nem conta de escritório do qual é membro; não designado é barrado", async () => {
    await linkByInvitation(
      owner,
      M2,
      { userId: "verifier-member", reason: REASON },
      undefined,
      {
        verify: false,
      },
    );
    const { id: ownReq } = await requestVerification(ctxOf(VERIFIER_MEMBER), {
      medicoId: M2,
    });
    await expect(
      approveVerification(
        VERIFIER_MEMBER,
        approval(ownReq, VERIFIER_MEMBER, { crm: "90002" }),
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await linkDoctor();
    const { id: docReq } = await requestVerification(doctor, { medicoId: M1 });
    // Membro do escritório, mesmo designado, não verifica.
    await expect(
      approveVerification(VERIFIER_MEMBER, approval(docReq, "doctor")),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    // Master sem designação no banco.
    await expect(verificationQueue(UNDESIGNATED)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(
      approveVerification(UNDESIGNATED, approval(docReq, "doctor")),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    // Designação revogada → perde o poder.
    await admin`update identity_verifiers set revoked_at=now(), revoked_by='ops', revoke_reason='Saída fictícia.' where user_id=${VERIFIER}`;
    await expect(
      approveVerification(VERIFIER, approval(docReq, "doctor")),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("app_runtime: sem escrita em verificações, decisões e designação; sem leitura da designação; isolamento", async () => {
    await linkDoctor();
    await requestVerification(doctor, { medicoId: M1 });
    for (const stmt of [
      "update professional_identity_verifications set expires_at = now() + interval '10 years'",
      "delete from professional_identity_verifications",
      "insert into professional_identity_review_events (org_id, kind, verification_id, reason, actor_user_id) values ('org_a','revoked', gen_random_uuid(), 'Forjada fictícia.', 'owner')",
      "select * from identity_verifiers",
      "delete from professional_identity_requests",
      "update medico_link_reconfirmations set user_id = 'owner'",
    ])
      await expect(asRuntime("owner", (tx) => tx.unsafe(stmt))).rejects.toMatchObject({
        code: "42501",
      });
    // Pedido em nome de outra conta → recusado pela RLS.
    await expect(
      asRuntime(
        "owner",
        (tx) =>
          tx`insert into professional_identity_requests (org_id, medico_id, user_id) values ('org_a', ${M1}, 'doctor')`,
      ),
    ).rejects.toMatchObject({ code: "42501" });
    // O papel do operador não lê dado clínico.
    await expect(
      admin.begin(async (tx) => {
        await tx`set local role identity_verifier`;
        return tx`select count(*) from health_exam_clinical_notes`;
      }),
    ).rejects.toMatchObject({ code: "42501" });
    // Outro tenant não vê pedidos de org_a.
    const rows = (await asRuntime(
      "owner-b",
      (tx) => tx`select count(*)::int as n from professional_identity_requests`,
      "org_b",
    )) as unknown as { n: number }[];
    expect(rows[0].n).toBe(0);
  });

  it("revogação, expiração, CRM alterado, profissional inativo e conta fora do escritório cortam o acesso", async () => {
    await linkDoctor();
    const { id: requestId } = await requestVerification(doctor, { medicoId: M1 });
    const { id: verificationId } = await approveVerification(
      VERIFIER,
      approval(requestId, "doctor"),
    );
    expect(await isActorCompanyCoordinator(doctor, I.companyA)).toBe(true);
    await admin`update medicos set crm='90009' where id=${M1}`;
    expect(await isActorCompanyCoordinator(doctor, I.companyA)).toBe(false);
    await admin`update medicos set crm='90001' where id=${M1}`;
    await admin`update medicos set status='inactive' where id=${M1}`;
    expect(await isActorCompanyCoordinator(doctor, I.companyA)).toBe(false);
    await admin`update medicos set status='active' where id=${M1}`;
    await admin`delete from org_memberships where user_id='doctor'`;
    expect(await isActorCompanyCoordinator(doctor, I.companyA)).toBe(false);
    await admin`insert into org_memberships (org_id,user_id,role) values ('org_a','doctor','collaborator')`;
    expect(await isActorCompanyCoordinator(doctor, I.companyA)).toBe(true);
    await admin`update professional_identity_verifications set verified_at = now() - interval '13 months', expires_at = now() - interval '1 month' where id=${verificationId}`;
    expect(await isActorCompanyCoordinator(doctor, I.companyA)).toBe(false);
    expect((await myProfessionalIdentity(doctor))[0].status).toBe("expired");
    await admin`update professional_identity_verifications set verified_at = now(), expires_at = now() + interval '12 months' where id=${verificationId}`;
    await revokeVerification(VERIFIER, verificationId, {
      reason: "Revogação fictícia de teste.",
    });
    expect(await isActorCompanyCoordinator(doctor, I.companyA)).toBe(false);
    expect((await myProfessionalIdentity(doctor))[0].status).toBe("revoked");
    // Recusa de pedido novo fica registrada.
    const { id: second } = await requestVerification(doctor, { medicoId: M1 });
    await rejectRequest(VERIFIER, second, {
      reason: "Documento ilegível na sessão fictícia.",
    });
    expect((await myProfessionalIdentity(doctor))[0].status).toBe("rejected");
  });

  it("NOB-159: vínculo legado precisa de verificação E reconfirmação da própria conta", async () => {
    const [legacy] =
      await admin`insert into medico_user_links (org_id, medico_id, user_id, reason, linked_by)
      values ('org_a', ${M1}, 'doctor', 'Vínculo legado fictício', 'owner') returning id`;
    expect(await isActorCompanyCoordinator(doctor, I.companyA)).toBe(false);
    const { id: requestId } = await requestVerification(doctor, { medicoId: M1 });
    await approveVerification(VERIFIER, approval(requestId, "doctor"));
    // Verificado, mas sem reconfirmação: continua sem acesso.
    expect(await isActorCompanyCoordinator(doctor, I.companyA)).toBe(false);
    expect((await myProfessionalIdentity(doctor))[0]).toMatchObject({
      legacy: true,
      needsReconfirmation: true,
      status: "verified",
      clinicalAccess: false,
    });
    // Reconfirmação por outra conta → recusada (servidor e SQL).
    await expect(reconfirmLink(staff, legacy.id)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(
      asRuntime(
        "staff",
        (tx) =>
          tx`insert into medico_link_reconfirmations (org_id, link_id, user_id, statement) values ('org_a', ${legacy.id}, 'staff', 'Forjada')`,
      ),
    ).rejects.toMatchObject({ code: "42501" });
    await reconfirmLink(doctor, legacy.id);
    expect(await isActorCompanyCoordinator(doctor, I.companyA)).toBe(true);
    await expect(reconfirmLink(doctor, legacy.id)).rejects.toMatchObject({
      code: "VALIDATION",
    });
    // Vínculo legado de outro tipo (já por convite) não é reconfirmado.
    const viaInvite = await linkByInvitation(
      owner,
      M2,
      { userId: "staff", reason: REASON },
      undefined,
      {
        verify: false,
      },
    );
    await expect(reconfirmLink(staff, viaInvite.id)).rejects.toMatchObject({
      code: "VALIDATION",
    });
  });

  it("NOB-160: único owner médico conclui o autovínculo só com verificação independente", async () => {
    const invitation = await invite(owner, M1, { userId: "owner", reason: REASON });
    await actOnInvitation(owner, M1, invitation.id, "accept");
    await expect(
      actOnInvitation(owner, M1, invitation.id, "complete"),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    // Forjar o vínculo por SQL sem aprovação nem verificação → recusado.
    await expect(
      asRuntime(
        "owner",
        (tx) =>
          tx`insert into medico_user_links (org_id, medico_id, user_id, reason, linked_by, invitation_id)
            values ('org_a', ${M1}, 'owner', 'Forjado', 'owner', ${invitation.id})`,
      ),
    ).rejects.toMatchObject({ code: "42501" });
    const { id: requestId } = await requestVerification(owner, { medicoId: M1 });
    expect((await myProfessionalIdentity(owner))[0]).toMatchObject({
      pendingSelfInvitationId: invitation.id,
      status: "in_review",
    });
    await approveVerification(VERIFIER, approval(requestId, "owner"));
    const completed = await actOnInvitation(owner, M1, invitation.id, "complete");
    expect(completed.status).toBe("linked");
    expect(await isActorCompanyCoordinator(owner, I.companyA)).toBe(true);
  });

  const attemptsLog = async () =>
    (await admin`select verifier_user_id as v, succeeded as ok from identity_challenge_attempts order by attempted_at`) as unknown as {
      v: string;
      ok: boolean;
    }[];

  it("desafio: 5 códigos errados travam o pedido (até o código certo); recusa e novo pedido destravam", async () => {
    await linkDoctor();
    const { id: requestId } = await requestVerification(doctor, { medicoId: M1 });
    const bad = approval(requestId, "doctor", {
      challengeCode: wrongCode(requestId, "doctor"),
    });
    for (let left = 4; left >= 0; left -= 1)
      await expect(approveVerification(VERIFIER, bad)).rejects.toMatchObject({
        code: "VALIDATION",
        message: left
          ? expect.stringContaining(`Restam ${left} tentativa(s)`)
          : expect.stringContaining("tentativas deste pedido acabaram"),
      });
    // Esgotado: nem o código certo passa (por outro operador), e nada novo é conferido ou gravado.
    await expect(
      approveVerification(VERIFIER_2, approval(requestId, "doctor")),
    ).rejects.toMatchObject({
      message: expect.stringContaining("esgotadas neste pedido"),
    });
    const log = await attemptsLog();
    expect(log).toHaveLength(5);
    expect(log.every((a) => !a.ok)).toBe(true);
    const [mine] = await myProfessionalIdentity(doctor);
    expect(mine).toMatchObject({ status: "in_review", clinicalAccess: false });
    // O código nunca é gravado.
    const cols =
      (await admin`select column_name from information_schema.columns where table_name = 'identity_challenge_attempts'`) as unknown as {
        column_name: string;
      }[];
    expect(cols.map((c) => c.column_name).join(",")).not.toMatch(/code/);
    await rejectRequest(VERIFIER, requestId, {
      reason: "Tentativas do código esgotadas (fictício).",
    });
    const { id: second } = await requestVerification(doctor, { medicoId: M1 });
    await approveVerification(VERIFIER, approval(second, "doctor"));
    expect(await isActorCompanyCoordinator(doctor, I.companyA)).toBe(true);
    // Pedido já aprovado: não aceita mais conferência (sem reuso) e nada é registrado.
    await expect(
      approveVerification(VERIFIER_2, approval(second, "doctor")),
    ).rejects.toMatchObject({ message: "O pedido não está mais em aberto." });
    expect(await attemptsLog()).toHaveLength(6);
  });

  it("desafio: limite por conta (força bruta distribuída entre operadores e pedidos) e por operador", async () => {
    await linkDoctor();
    const { id: first } = await requestVerification(doctor, { medicoId: M1 });
    // Erros antigos (fora da janela de 24 h) não contam.
    await admin`insert into identity_challenge_attempts (org_id, request_id, user_id, verifier_user_id, succeeded, attempted_at)
      select 'org_a', ${first}, 'doctor', case when g % 2 = 0 then 'verifier' else 'verifier-2' end, false, now() - interval '25 hours'
      from generate_series(1, 4) g`;
    await rejectRequest(VERIFIER, first, {
      reason: "Pedido fictício encerrado no teste.",
    });
    // 9 erros da mesma conta nas últimas 24 h, por dois operadores, em dois pedidos já recusados.
    const closed: string[] = [];
    for (const [verifier, n] of [
      ["verifier", 4],
      ["verifier-2", 5],
    ] as const) {
      const { id } = await requestVerification(doctor, { medicoId: M1 });
      closed.push(id);
      await admin`insert into identity_challenge_attempts (org_id, request_id, user_id, verifier_user_id, succeeded, attempted_at)
        select 'org_a', ${id}, 'doctor', ${verifier}, false, now() - interval '2 hours'
        from generate_series(1, ${n}) g`;
      await rejectRequest(VERIFIER, id, {
        reason: "Pedido fictício encerrado no teste.",
      });
    }
    const { id: current } = await requestVerification(doctor, { medicoId: M1 });
    // O 10º erro em 24 h ainda é conferido; depois a conta trava para qualquer operador.
    await expect(
      approveVerification(
        VERIFIER,
        approval(current, "doctor", { challengeCode: wrongCode(current, "doctor") }),
      ),
    ).rejects.toMatchObject({ message: expect.stringContaining("Restam 4") });
    await expect(
      approveVerification(VERIFIER_2, approval(current, "doctor")),
    ).rejects.toMatchObject({ message: expect.stringContaining("para esta conta") });

    // Por operador: 10 erros na última hora, em contas diferentes, travam esse operador; outro segue.
    await admin`delete from identity_challenge_attempts`;
    await admin`insert into identity_challenge_attempts (org_id, request_id, user_id, verifier_user_id, succeeded)
      select 'org_a', ${closed[0]}, 'conta-ficticia-' || g, 'verifier', false from generate_series(1, 10) g`;
    await expect(
      approveVerification(VERIFIER, approval(current, "doctor")),
    ).rejects.toMatchObject({ message: expect.stringContaining("última hora") });
    await approveVerification(VERIFIER_2, approval(current, "doctor"));
    expect(await isActorCompanyCoordinator(doctor, I.companyA)).toBe(true);
  });

  it("desafio: tentativas em paralelo não furam o limite; só inclusão; app_runtime sem acesso", async () => {
    await linkDoctor();
    const { id: requestId } = await requestVerification(doctor, { medicoId: M1 });
    const bad = approval(requestId, "doctor", {
      challengeCode: wrongCode(requestId, "doctor"),
    });
    const results = await Promise.allSettled(
      Array.from({ length: 8 }, (_, i) =>
        approveVerification(i % 2 ? VERIFIER : VERIFIER_2, bad),
      ),
    );
    expect(results.every((r) => r.status === "rejected")).toBe(true);
    expect(await attemptsLog()).toHaveLength(5);
    for (const stmt of [
      "select * from identity_challenge_attempts",
      `insert into identity_challenge_attempts (org_id, request_id, user_id, verifier_user_id, succeeded) values ('org_a', '${requestId}', 'doctor', 'owner', true)`,
      "delete from identity_challenge_attempts",
    ])
      await expect(asRuntime("owner", (tx) => tx.unsafe(stmt))).rejects.toMatchObject({
        code: "42501",
      });
    for (const stmt of [
      "delete from identity_challenge_attempts",
      "update identity_challenge_attempts set succeeded = true",
    ])
      await expect(
        admin.begin(async (tx) => {
          await tx`set local role identity_verifier`;
          return tx.unsafe(stmt);
        }),
      ).rejects.toMatchObject({ code: "42501" });
  });

  it("REST: área do profissional e fila do operador com códigos HTTP", async () => {
    await linkDoctor();
    const created = await REQUEST(
      req("doctor", "collaborator", "POST", { medicoId: M1 }),
    );
    expect(created.status).toBe(201);
    const { id: requestId } = await created.json();
    const mine = await MY_IDENTITY(req("doctor", "collaborator"));
    expect(mine.status).toBe(200);
    expect((await mine.json())[0].status).toBe("in_review");
    expect((await REQUEST(req("owner", "owner", "POST", { medicoId: M1 }))).status).toBe(
      403,
    );
    expect((await QUEUE(req("owner", "owner"))).status).toBe(403);
    // Sessão real de master do operador designado: fila e aprovação liberadas.
    (requireMaster as jest.Mock).mockResolvedValue({ userId: VERIFIER });
    const queue = await QUEUE(req(VERIFIER, "owner", "GET", undefined, "org_b"));
    expect(queue.status).toBe(200);
    expect((await queue.json()).pending).toHaveLength(1);
    const approved = await APPROVE(
      req(VERIFIER, "owner", "POST", approval(requestId, "doctor"), "org_b"),
    );
    expect(approved.status).toBe(201);
    expect(await isActorCompanyCoordinator(doctor, I.companyA)).toBe(true);
  });

  it("REST do operador exige master pela sessão real: designado sem master e headers do bypass dev são barrados", async () => {
    await linkDoctor();
    const created = await REQUEST(
      req("doctor", "collaborator", "POST", { medicoId: M1 }),
    );
    const { id: requestId } = await created.json();
    // Bypass dev ligado: o código de controle da conta não sai pela REST (headers forjáveis).
    const mine = await (await MY_IDENTITY(req("doctor", "collaborator"))).json();
    expect(mine[0].challengeCode).toBeNull();
    // Designado no banco, mas sem master na sessão: 403, sem verificação gravada.
    const queue = await QUEUE(req(VERIFIER, "owner", "GET", undefined, "org_b"));
    expect(queue.status).toBe(403);
    const approved = await APPROVE(
      req(VERIFIER, "owner", "POST", approval(requestId, "doctor"), "org_b"),
    );
    expect(approved.status).toBe(403);
    const rejected = await REJECT(
      req(VERIFIER, "owner", "POST", { reason: REASON }, "org_b"),
      { params: Promise.resolve({ id: requestId }) },
    );
    expect(rejected.status).toBe(403);
    expect(await isActorCompanyCoordinator(doctor, I.companyA)).toBe(false);
    const [{ n }] =
      await admin`select count(*)::int as n from professional_identity_verifications`;
    expect(n).toBe(0);
    // A identidade do operador vem da sessão de master, nunca do header x-dev-user.
    (requireMaster as jest.Mock).mockResolvedValue({ userId: VERIFIER });
    const forged = await APPROVE(
      req("doctor", "owner", "POST", approval(requestId, "doctor"), "org_b"),
    );
    expect(forged.status).toBe(201);
    const [row] =
      await admin`select verified_by from professional_identity_verifications`;
    expect(row.verified_by).toBe(VERIFIER);
    const revoked = await REVOKE(
      req("doctor", "owner", "POST", { reason: REASON }, "org_b"),
      { params: Promise.resolve({ id: (await forged.json()).id }) },
    );
    expect(revoked.status).toBe(201);
    expect(await isActorCompanyCoordinator(doctor, I.companyA)).toBe(false);
  });
});
