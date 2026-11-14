/**
 * Categorias e vínculos de profissionais de saúde (NOB-121) contra Postgres efêmero:
 * - médico interno ou externo, vinculado pela própria conta e com identidade verificada, entra no
 *   predicado clínico `actor_clinical_medico_ids` (o vínculo interno/externo não muda a regra);
 * - psicólogo (CRP), interno ou externo, nunca entra no predicado de competência médica, nem com
 *   uma verificação gravada fora do fluxo, e o operador não consegue verificá-lo;
 * - mudar a UF ou a categoria do cadastro depois da verificação corta o acesso na hora.
 * Dados fictícios.
 */
import type postgres from "postgres";
jest.mock("@/shared/db/env", () => ({
  getDatabaseUrl: () => process.env.INTEGRATION_APP_RUNTIME_URL,
}));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
import type { TenantContext } from "@/shared/auth/require-tenant-context";
import { closeVerifierConnection } from "@/shared/db/identity-verifier-db";
import { currentChallengeCode } from "@/shared/server/medicine/identity-challenge";
import {
  approveVerification,
  myProfessionalIdentity,
  requestVerification,
} from "@/shared/server/medicine/identity-verification-core";
import { adminClient, applyMigrations } from "../_helpers/db";
import { seedPgrBase } from "../_helpers/pgr-seed";
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
const VERIFIER = "verifier";
const REASON = "Profissional fictício com acesso próprio.";
const PHYS_INT = "bbbbbbbb-0000-4000-8000-000000000121";
const PHYS_EXT = "bbbbbbbb-0000-4000-8000-000000000122";
const PSY_INT = "bbbbbbbb-0000-4000-8000-000000000123";
const PSY_EXT = "bbbbbbbb-0000-4000-8000-000000000124";
const CHECKLIST = {
  identityDocument: true,
  professionalDocument: true,
  registryStatus: true,
  personMatches: true,
  accountControl: true,
};

(enabled ? describe : describe.skip)("Categorias de profissionais (NOB-121)", () => {
  let admin: ReturnType<typeof postgres>;
  let runtime: ReturnType<typeof postgres>;
  const originalEnv = { ...process.env };

  beforeAll(async () => {
    admin = adminClient();
    await admin`set client_min_messages = warning`;
    await applyMigrations(admin);
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
    await admin`insert into users (id, email) values ('owner','o@example.test'),('u-phys-int','a@example.test'),('u-phys-ext','b@example.test'),('u-psy-int','c@example.test'),('u-psy-ext','d@example.test'),('verifier','v@example.test')`;
    await admin`insert into org_memberships (org_id, user_id, role) values ('org_a','owner','owner'),('org_a','u-phys-int','collaborator'),('org_a','u-phys-ext','collaborator'),('org_a','u-psy-int','collaborator'),('org_a','u-psy-ext','collaborator')`;
    await admin`insert into identity_verifiers (user_id, designated_by) values ('verifier','ops-provisioning')`;
    await admin`insert into medicos (id, org_id, name, crm, profession, registration_uf, affiliation, status) values
      (${PHYS_INT}, 'org_a', 'Dra. Interna Fictícia', '70121', 'physician', 'MA', 'internal', 'active'),
      (${PHYS_EXT}, 'org_a', 'Dr. Externo Fictício', '70122', 'physician', 'PI', 'external', 'active'),
      (${PSY_INT}, 'org_a', 'Psicóloga Interna Fictícia', '06/70123', 'psychologist', 'SP', 'internal', 'active'),
      (${PSY_EXT}, 'org_a', 'Psicólogo Externo Fictício', '05/70124', 'psychologist', 'RJ', 'external', 'active')`;
  });

  /** Profissionais com competência clínica médica para a conta, pela função do banco (RLS). */
  const clinicalIds = (actor: string) =>
    runtime.begin(async (tx) => {
      await tx`select set_config('app.current_org', 'org_a', true)`;
      await tx`select set_config('app.current_actor', ${actor}, true)`;
      const rows = await tx`select public.actor_clinical_medico_ids('org_a') as id`;
      return rows.map((r) => r.id as string);
    }) as Promise<string[]>;

  it("médico interno e externo verificados entram no predicado; psicólogo interno e externo nunca", async () => {
    // Vínculo por convite + aceite da própria conta; a verificação de teste é gravada como admin,
    // inclusive para os psicólogos (verificação fora do fluxo, que o operador nem conseguiria gravar).
    for (const [medicoId, userId] of [
      [PHYS_INT, "u-phys-int"],
      [PHYS_EXT, "u-phys-ext"],
      [PSY_INT, "u-psy-int"],
      [PSY_EXT, "u-psy-ext"],
    ]) {
      await linkByInvitation(owner, medicoId, { userId, reason: REASON });
    }
    expect(await clinicalIds("u-phys-int")).toEqual([PHYS_INT]);
    expect(await clinicalIds("u-phys-ext")).toEqual([PHYS_EXT]);
    expect(await clinicalIds("u-psy-int")).toEqual([]);
    expect(await clinicalIds("u-psy-ext")).toEqual([]);
    // O owner não ganha competência clínica pelo papel.
    expect(await clinicalIds("owner")).toEqual([]);
    // A tela do profissional mostra o mesmo: psicólogo sem acesso clínico médico.
    const [psy] = await myProfessionalIdentity(ctxOf("u-psy-int"));
    expect(psy.clinicalAccess).toBe(false);
    const [phys] = await myProfessionalIdentity(ctxOf("u-phys-ext"));
    expect(phys.clinicalAccess).toBe(true);
  });

  it("o operador designado não consegue verificar psicólogo (o banco recusa) e nada é gravado", async () => {
    await linkByInvitation(
      owner,
      PSY_EXT,
      { userId: "u-psy-ext", reason: REASON },
      undefined,
      { verify: false },
    );
    const { id: requestId } = await requestVerification(ctxOf("u-psy-ext"), {
      medicoId: PSY_EXT,
    });
    await expect(
      approveVerification(VERIFIER, {
        requestId,
        method: "live_video",
        crm: "05/70124",
        registrationUf: "RJ",
        registrySource: "Consulta pública fictícia do CFP",
        challengeCode: currentChallengeCode(requestId, "u-psy-ext"),
        checklist: CHECKLIST,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    const [{ n }] =
      await admin`select count(*)::int as n from professional_identity_verifications where medico_id = ${PSY_EXT}`;
    expect(n).toBe(0);
    expect(await clinicalIds("u-psy-ext")).toEqual([]);
  });

  it("mudar a UF ou a categoria do cadastro depois da verificação corta o acesso na hora", async () => {
    await linkByInvitation(owner, PHYS_INT, { userId: "u-phys-int", reason: REASON });
    await linkByInvitation(owner, PHYS_EXT, { userId: "u-phys-ext", reason: REASON });
    expect(await clinicalIds("u-phys-int")).toEqual([PHYS_INT]);
    expect(await clinicalIds("u-phys-ext")).toEqual([PHYS_EXT]);
    // UF do conselho trocada: a verificação conferiu MA, o cadastro agora diz CE.
    await admin`update medicos set registration_uf = 'CE' where id = ${PHYS_INT}`;
    expect(await clinicalIds("u-phys-int")).toEqual([]);
    // Categoria trocada para psicólogo: sai da competência médica.
    await admin`update medicos set profession = 'psychologist', rqe = null where id = ${PHYS_EXT}`;
    expect(await clinicalIds("u-phys-ext")).toEqual([]);
  });
});
