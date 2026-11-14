/**
 * Prontuário segregado (NOB-155, DT-21, MED-10/17) contra Postgres efêmero. Quem lê e grava:
 * - só a conta vinculada ao médico examinador do exame ou ao coordenador com designação aberta da
 *   empresa onde o exame foi realizado.
 * Quem não acessa: owner, colaborador, cliente, outro tenant, vínculo revogado, designação
 * encerrada e profissional inativo — no servidor e direto no banco (papel `app_runtime`).
 * O RH lê só a comunicação de restrição (sem CID). Trilha de acesso sem conteúdo. Nenhum vazamento
 * no CRUD de exames, no REST e no ASO. Dados fictícios.
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
import {
  createHealthExam,
  deleteHealthExam,
  getHealthExamById,
  listHealthExams,
} from "@/shared/db/repositories/health-exams";
import { deleteEmployee } from "@/shared/db/repositories/employees";
import { isActorCompanyCoordinator } from "@/shared/db/repositories/medico-user-links";
import { linkByInvitation as link } from "../_helpers/professional-link";
import {
  addClinicalNote,
  getClinicalAccess,
  listClinicalAccessEvents,
  listWorkRestrictions,
  readClinicalRecord,
  recordWorkRestriction,
} from "@/shared/server/medicine/clinical-record-core";
import {
  addClinicalNoteAction,
  readClinicalRecordAction,
} from "@/shared/server/actions/medicine/clinical-record";
import {
  createHealthExamAction,
  getHealthExamAction,
} from "@/shared/server/actions/pgr/health-exams";
import {
  GET as READ_NOTES,
  POST as ADD_NOTE,
} from "@/app/api/v1/health-exams/[id]/clinical-notes/route";
import {
  GET as LIST_RESTRICTIONS,
  POST as RECORD_RESTRICTION,
} from "@/app/api/v1/health-exams/[id]/work-restrictions/route";
import { GET as ACCESS_EVENTS } from "@/app/api/v1/health-exams/[id]/clinical-access-events/route";
import {
  GET as SHOW_EXAM,
  PUT as UPDATE_EXAM,
} from "@/app/api/v1/health-exams/[id]/route";
import { GET as LIST_EXAMS, POST as CREATE_EXAM } from "@/app/api/v1/health-exams/route";
import { CLINICAL_NOTES_MOVED_MESSAGE } from "@/shared/domains/medicine/clinical-record";
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
const coordinator: TenantContext = { ...owner, userId: "coord", role: "collaborator" };
const examiner: TenantContext = { ...owner, userId: "examiner", role: "collaborator" };
const other: TenantContext = { ...owner, userId: "other-doc", role: "collaborator" };
const client: TenantContext = { ...owner, userId: "client", role: "client" };
const ownerB: TenantContext = {
  tenantId: "org_b",
  userId: "owner-b",
  role: "owner",
  plan: "pro",
};
const COORDINATOR = "aaaaaaaa-0000-4000-8000-000000000051";
const EXAMINER = "aaaaaaaa-0000-4000-8000-000000000052";
const OTHER_DOCTOR = "aaaaaaaa-0000-4000-8000-000000000053";
const NOTE = "EXEMPLO-PRONTUARIO-SIGILOSO observação clínica fictícia";

const req = (ctx: TenantContext, method = "GET", body?: unknown) =>
  new NextRequest("http://localhost/api/v1/health-exams", {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      "x-dev-tenant": ctx.tenantId,
      "x-dev-user": ctx.userId,
      "x-dev-role": ctx.role,
    },
  });
const params = (id: string) => ({ params: Promise.resolve({ id }) });

(enabled ? describe : describe.skip)("Prontuário segregado (NOB-155)", () => {
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
    await admin`insert into users (id,email) values ('owner','o@example.test'),('staff','s@example.test'),('coord','c@example.test'),('examiner','e@example.test'),('other-doc','x@example.test'),('client','cl@example.test'),('owner-b','ob@example.test')`;
    await admin`insert into org_memberships (org_id,user_id,role) values ('org_a','owner','owner'),('org_a','staff','collaborator'),('org_a','coord','collaborator'),('org_a','examiner','collaborator'),('org_a','other-doc','collaborator'),('org_a','client','client'),('org_b','owner-b','owner')`;
    await admin`insert into medicos (id, org_id, name, crm, profession, status) values
      (${COORDINATOR}, 'org_a', 'Dra. Coordenadora Fictícia', '70001', 'physician', 'active'),
      (${EXAMINER}, 'org_a', 'Dr. Examinador Fictício', '70002', 'physician', 'active'),
      (${OTHER_DOCTOR}, 'org_a', 'Dra. Outra Fictícia', '70003', 'physician', 'active')`;
    await admin`insert into pcmso_coordinator_assignments (org_id, company_id, medico_id, starts_on, created_by)
      values ('org_a', ${I.companyA}, ${COORDINATOR}, '2026-01-01', 'owner')`;
    await link(owner, COORDINATOR, { userId: "coord", reason: "Coordenadora fictícia." });
    await link(owner, EXAMINER, { userId: "examiner", reason: "Examinador fictício." });
    await link(owner, OTHER_DOCTOR, {
      userId: "other-doc",
      reason: "Médica sem relação.",
    });
    process.env.APP_ENV = "local";
    process.env.DEV_API_AUTH_BYPASS = "true";
    (requireOfficeStaff as jest.Mock).mockResolvedValue(staff);
  });

  const newExam = () =>
    createHealthExam("org_a", {
      employeeId: I.employeeA,
      doctorId: EXAMINER,
      examType: "periodic",
      performedAt: "2026-10-20",
      aptitude: "fit_with_restrictions",
    });

  /** Executa SQL como `app_runtime`, no tenant e com o ator informados (sem a aplicação). */
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

  it("examinador e coordenador vinculados leem e gravam; leitura e escrita auditadas sem conteúdo", async () => {
    const exam = await newExam();
    const added = await addClinicalNote(examiner, exam.id, { content: NOTE });
    expect(added).toMatchObject({
      origin: "clinician",
      content: NOTE,
      authorName: "Dr. Examinador Fictício",
    });
    expect(await getClinicalAccess(examiner, exam.id)).toEqual({
      allowed: true,
      basis: "examiner",
    });
    const byCoordinator = await readClinicalRecord(coordinator, exam.id);
    expect(byCoordinator.basis).toBe("coordinator");
    expect(byCoordinator.notes.map((n) => n.content)).toEqual([NOTE]);
    await addClinicalNote(coordinator, exam.id, { content: "Complemento fictício." });
    expect((await readClinicalRecord(examiner, exam.id)).notes).toHaveLength(2);

    const events =
      await admin`select action, basis, actor_user_id, medico_id from clinical_record_access_events where health_exam_id=${exam.id} order by occurred_at, action`;
    expect(events.map((e) => `${e.actor_user_id}:${e.action}:${e.basis}`).sort()).toEqual(
      [
        "coord:note_added:coordinator",
        "coord:read:coordinator",
        "examiner:note_added:examiner",
        "examiner:read:examiner",
      ].sort(),
    );
    // A trilha não tem coluna de conteúdo nem copia o texto.
    const columns =
      await admin`select column_name from information_schema.columns where table_name='clinical_record_access_events'`;
    expect(columns.map((c) => c.column_name)).not.toContain("content");
    expect(JSON.stringify(events)).not.toContain("EXEMPLO-PRONTUARIO");
    // Owner consulta a trilha; colaborador não.
    const trail = await listClinicalAccessEvents(owner, exam.id);
    expect(trail).toHaveLength(4);
    expect(JSON.stringify(trail)).not.toContain("EXEMPLO-PRONTUARIO");
    await expect(listClinicalAccessEvents(staff, exam.id)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    // Só inclusão: o app_runtime não altera nem apaga o prontuário.
    await expect(
      asRuntime(
        "examiner",
        (tx) => tx`update health_exam_clinical_notes set content='x'`,
      ),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      asRuntime("examiner", (tx) => tx`delete from health_exam_clinical_notes`),
    ).rejects.toMatchObject({ code: "42501" });
  });

  it("owner, colaborador, médico sem relação, cliente e outro tenant não acessam (servidor, action e REST)", async () => {
    const exam = await newExam();
    await addClinicalNote(examiner, exam.id, { content: NOTE });
    for (const ctx of [owner, staff, other]) {
      await expect(readClinicalRecord(ctx, exam.id)).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
      await expect(
        addClinicalNote(ctx, exam.id, { content: "Tentativa fictícia." }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(await getClinicalAccess(ctx, exam.id)).toEqual({
        allowed: false,
        basis: null,
      });
    }
    await expect(readClinicalRecord(ownerB, exam.id)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    // Server Action com a sessão do owner: erro sem conteúdo.
    (requireOfficeStaff as jest.Mock).mockResolvedValue(owner);
    const denied = await readClinicalRecordAction(exam.id);
    expect(denied).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    expect(JSON.stringify(denied)).not.toContain("EXEMPLO-PRONTUARIO");
    (requireOfficeStaff as jest.Mock).mockResolvedValue(examiner);
    expect((await readClinicalRecordAction(exam.id)).ok).toBe(true);
    expect(
      (await addClinicalNoteAction(exam.id, { content: "Pela action, fictício." })).ok,
    ).toBe(true);
    // REST.
    const p = params(exam.id);
    for (const ctx of [owner, staff, other]) {
      const res = await READ_NOTES(req(ctx), p);
      expect(res.status).toBe(403);
      expect(JSON.stringify(await res.json())).not.toContain("EXEMPLO-PRONTUARIO");
      expect((await ADD_NOTE(req(ctx, "POST", { content: "x" }), p)).status).toBe(403);
    }
    expect((await READ_NOTES(req(client), p)).status).toBe(403);
    expect((await READ_NOTES(req(ownerB), p)).status).toBe(404);
    expect((await ACCESS_EVENTS(req(staff), p)).status).toBe(403);
    expect((await ACCESS_EVENTS(req(owner), p)).status).toBe(200);
    const ok = await READ_NOTES(req(examiner), p);
    expect(ok.status).toBe(200);
    expect(JSON.stringify(await ok.json())).toContain("EXEMPLO-PRONTUARIO");
    expect(
      (await ADD_NOTE(req(coordinator, "POST", { content: "Pelo REST, fictício." }), p))
        .status,
    ).toBe(201);
    expect((await ADD_NOTE(req(examiner, "POST", { content: "  " }), p)).status).toBe(
      422,
    );
  });

  it("vínculo revogado, designação encerrada e profissional inativo perdem o acesso", async () => {
    const exam = await newExam();
    await addClinicalNote(examiner, exam.id, { content: NOTE });
    // Designação encerrada.
    await admin`update pcmso_coordinator_assignments set ends_on='2026-10-30', end_reason='Troca fictícia.' where medico_id=${COORDINATOR}`;
    await expect(readClinicalRecord(coordinator, exam.id)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    // Profissional inativo.
    await admin`update medicos set status='inactive' where id=${EXAMINER}`;
    await expect(readClinicalRecord(examiner, exam.id)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await admin`update medicos set status='active' where id=${EXAMINER}`;
    expect((await readClinicalRecord(examiner, exam.id)).notes).toHaveLength(1);
    // Vínculo revogado.
    await admin`update medico_user_links set revoked_at=now(), revoked_by='owner', revoke_reason='Saída fictícia.' where medico_id=${EXAMINER}`;
    await expect(readClinicalRecord(examiner, exam.id)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    // A conta sai do escritório (vínculo aberto, associação apagada).
    await admin`update medico_user_links set revoked_at=null, revoked_by=null, revoke_reason=null where medico_id=${EXAMINER}`;
    await admin`delete from org_memberships where org_id='org_a' and user_id='examiner'`;
    await expect(readClinicalRecord(examiner, exam.id)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    // O banco repete a regra para cada caso, mesmo sem a aplicação.
    const visible = (actor: string) =>
      asRuntime(
        actor,
        (tx) =>
          tx`select count(*)::int as n from health_exam_clinical_notes where health_exam_id=${exam.id}`,
      ).then((rows) => (rows as unknown as { n: number }[])[0].n);
    expect(await visible("examiner")).toBe(0);
    expect(await visible("coord")).toBe(0);
  });

  it("verificação anterior à 0083 com validade original longa vale no máximo 12 meses desde a conferência (app e SQL)", async () => {
    const exam = await newExam();
    await addClinicalNote(examiner, exam.id, { content: NOTE });
    // Simula a linha legada (validade de 24 ou 36 meses, permitida pela 0071): a 0083 usa NOT VALID,
    // e o CHECK novo recusaria criar ou alterar uma linha assim. Datas preservadas; nada apagado.
    const legacy = (account: string, verifiedAgo: string, original: string) =>
      admin.begin(async (tx) => {
        await tx`alter table professional_identity_verifications drop constraint ck_identity_verifications_validity`;
        await tx`update professional_identity_verifications
          set verified_at = now() - ${verifiedAgo}::interval,
              expires_at = now() - ${verifiedAgo}::interval + ${original}::interval
          where user_id = ${account}`;
        await tx.unsafe(`alter table professional_identity_verifications add constraint ck_identity_verifications_validity
          check (expires_at > verified_at and expires_at <= verified_at + interval '12 months') not valid`);
      });
    const visible = (actor: string) =>
      asRuntime(
        actor,
        (tx) =>
          tx`select count(*)::int as n from health_exam_clinical_notes where health_exam_id=${exam.id}`,
      ).then((rows) => (rows as unknown as { n: number }[])[0].n);
    // D: conferida há 6 meses com validade original de 36 → ainda dentro dos 12 meses: acesso mantido.
    await legacy("examiner", "6 months", "36 months");
    expect((await readClinicalRecord(examiner, exam.id)).notes).toHaveLength(1);
    expect(await visible("examiner")).toBe(1);
    // C: conferida há 13 meses com validade original de 24 (expires_at ainda no futuro) → sem acesso.
    await legacy("examiner", "13 months", "24 months");
    await expect(readClinicalRecord(examiner, exam.id)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(
      addClinicalNote(examiner, exam.id, { content: "Tentativa fictícia." }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(await visible("examiner")).toBe(0);
    // Coordenador (ato de coordenador) pelo mesmo predicado: 13 meses com validade original de 36.
    expect(await isActorCompanyCoordinator(coordinator, I.companyA)).toBe(true);
    await legacy("coord", "13 months", "36 months");
    expect(await isActorCompanyCoordinator(coordinator, I.companyA)).toBe(false);
    expect(await visible("coord")).toBe(0);
    // Histórico preservado: as datas originais continuam gravadas.
    const rows =
      await admin`select count(*)::int as n from professional_identity_verifications
      where expires_at > verified_at + interval '12 months'`;
    expect(rows[0].n).toBe(2);
  });

  it("acesso direto via SQL com o papel do app: só o médico autorizado lê e grava; campo antigo vazio e travado", async () => {
    const exam = await newExam();
    await addClinicalNote(examiner, exam.id, { content: NOTE });
    const count = (actor: string, org = "org_a") =>
      asRuntime(
        actor,
        (tx) => tx`select count(*)::int as n from health_exam_clinical_notes`,
        org,
      ).then((rows) => (rows as unknown as { n: number }[])[0].n);
    expect(await count("examiner")).toBe(1);
    expect(await count("coord")).toBe(1);
    for (const actor of ["owner", "staff", "client", "other-doc", ""]) {
      expect(await count(actor)).toBe(0);
    }
    expect(await count("owner-b", "org_b")).toBe(0);
    // Gravar em nome de outro médico ou como owner → recusado pela RLS.
    for (const [actor, medico] of [
      ["owner", EXAMINER],
      ["staff", EXAMINER],
      ["other-doc", OTHER_DOCTOR],
      ["examiner", COORDINATOR],
    ] as const) {
      await expect(
        asRuntime(
          actor,
          (tx) =>
            tx`insert into health_exam_clinical_notes (org_id, health_exam_id, origin, content, authored_by_medico_id, recorded_by)
              values ('org_a', ${exam.id}, 'clinician', 'Forjada fictícia.', ${medico}, ${actor})`,
        ),
      ).rejects.toMatchObject({ code: "42501" });
    }
    // Registro "migrado" forjado pelo app → recusado.
    await expect(
      asRuntime(
        "examiner",
        (tx) =>
          tx`insert into health_exam_clinical_notes (org_id, health_exam_id, origin, content)
            values ('org_a', ${exam.id}, 'legacy_exam_notes', 'Forjada fictícia.')`,
      ),
    ).rejects.toMatchObject({ code: expect.stringMatching(/42501|23514/) });
    // Trilha forjada em nome de outra conta → recusada.
    await expect(
      asRuntime(
        "staff",
        (tx) =>
          tx`insert into clinical_record_access_events (org_id, health_exam_id, medico_id, basis, action, actor_user_id)
            values ('org_a', ${exam.id}, ${EXAMINER}, 'examiner', 'read', 'examiner')`,
      ),
    ).rejects.toMatchObject({ code: "42501" });
    // O RH não lê a trilha de outra conta pelo banco; o owner lê.
    const trail = (actor: string) =>
      asRuntime(
        actor,
        (tx) => tx`select count(*)::int as n from clinical_record_access_events`,
      ).then((rows) => (rows as unknown as { n: number }[])[0].n);
    expect(await trail("staff")).toBe(0);
    expect(await trail("owner")).toBeGreaterThan(0);
    // Campo antigo: sempre vazio e não aceita texto, nem pelo app_runtime.
    const [{ filled }] =
      await admin`select count(*)::int as filled from health_exams where notes is not null`;
    expect(filled).toBe(0);
    await expect(
      asRuntime(
        "owner",
        (tx) => tx`update health_exams set notes='x' where id=${exam.id}`,
      ),
    ).rejects.toMatchObject({ code: "23514" });
  });

  it("RH lê só a comunicação de restrição; CID recusado; histórico preservado", async () => {
    const exam = await newExam();
    await expect(
      recordWorkRestriction(staff, exam.id, {
        kind: "restriction",
        restriction: "Não levantar peso.",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      recordWorkRestriction(examiner, exam.id, {
        kind: "restriction",
        restriction: "Lombalgia M54.5: evitar carga.",
      }),
    ).rejects.toMatchObject({
      issues: [expect.objectContaining({ path: ["restriction"] })],
    });
    await expect(
      recordWorkRestriction(examiner, exam.id, {
        kind: "restriction",
        restriction: "CID informado: evitar carga.",
      }),
    ).rejects.toMatchObject({
      issues: [expect.objectContaining({ path: ["restriction"] })],
    });
    await recordWorkRestriction(examiner, exam.id, {
      kind: "restriction",
      restriction: "Não levantar cargas acima de 10 kg por 30 dias.",
    });
    const forHr = await listWorkRestrictions(staff, exam.id);
    expect(forHr).toEqual([
      expect.objectContaining({
        kind: "restriction",
        restriction: "Não levantar cargas acima de 10 kg por 30 dias.",
        authorName: "Dr. Examinador Fictício",
      }),
    ]);
    expect(Object.keys(forHr[0]).sort()).toEqual(
      ["authorName", "id", "kind", "recordedAt", "restriction"].sort(),
    );
    await recordWorkRestriction(coordinator, exam.id, { kind: "withdrawal" });
    const history = await listWorkRestrictions(owner, exam.id);
    expect(history.map((r) => r.kind)).toEqual(["withdrawal", "restriction"]);
    // REST: RH lê (200), não grava (403); cliente e outro tenant fora.
    const p = params(exam.id);
    expect((await LIST_RESTRICTIONS(req(staff), p)).status).toBe(200);
    expect(
      (
        await RECORD_RESTRICTION(
          req(owner, "POST", { kind: "restriction", restriction: "x" }),
          p,
        )
      ).status,
    ).toBe(403);
    expect(
      (await RECORD_RESTRICTION(req(examiner, "POST", { kind: "withdrawal" }), p)).status,
    ).toBe(201);
    expect((await LIST_RESTRICTIONS(req(client), p)).status).toBe(403);
    expect((await LIST_RESTRICTIONS(req(ownerB), p)).status).toBe(404);
    // Banco: RH não grava a comunicação, nem como owner.
    await expect(
      asRuntime(
        "owner",
        (tx) =>
          tx`insert into health_exam_work_restrictions (org_id, health_exam_id, kind, restriction, authored_by_medico_id, recorded_by)
            values ('org_a', ${exam.id}, 'restriction', 'Forjada.', ${EXAMINER}, 'owner')`,
      ),
    ).rejects.toMatchObject({ code: "42501" });
  });

  it("CRUD de exames, REST e listagens não expõem nem aceitam observações clínicas; exclusão preserva o histórico", async () => {
    const exam = await newExam();
    await addClinicalNote(examiner, exam.id, { content: NOTE });
    const read = await getHealthExamById("org_a", exam.id);
    expect(read).not.toHaveProperty("notes");
    expect(exam).not.toHaveProperty("notes");
    const listed = await listHealthExams("org_a", {});
    expect(JSON.stringify(listed)).not.toContain("EXEMPLO-PRONTUARIO");
    expect(JSON.stringify(listed)).not.toMatch(/"notes"\s*:/);
    (requireOfficeStaff as jest.Mock).mockResolvedValue(owner);
    const viaAction = await getHealthExamAction(exam.id);
    expect(JSON.stringify(viaAction)).not.toMatch(/"notes"\s*:/);
    const rejected = await createHealthExamAction({
      employeeId: I.employeeA,
      examType: "periodic",
      performedAt: "2026-10-21",
      aptitude: "fit",
      notes: "EXEMPLO-PRONTUARIO no cadastro",
    });
    expect(rejected).toMatchObject({
      ok: false,
      error: { code: "VALIDATION", fields: { notes: CLINICAL_NOTES_MOVED_MESSAGE } },
    });
    expect(JSON.stringify(rejected)).not.toContain("EXEMPLO-PRONTUARIO");
    const p = params(exam.id);
    const shown = await SHOW_EXAM(req(owner), p);
    expect(shown.status).toBe(200);
    const shownJson = JSON.stringify(await shown.json());
    expect(shownJson).not.toMatch(/"notes"\s*:/);
    expect(shownJson).not.toContain("EXEMPLO-PRONTUARIO");
    const list = await LIST_EXAMS(req(owner));
    expect(JSON.stringify(await list.json())).not.toContain("EXEMPLO-PRONTUARIO");
    const body = {
      employeeId: I.employeeA,
      doctorId: EXAMINER,
      examType: "periodic",
      performedAt: "2026-10-20",
      aptitude: "fit_with_restrictions",
      notes: "EXEMPLO-PRONTUARIO pelo REST",
    };
    expect((await UPDATE_EXAM(req(owner, "PUT", body), p)).status).toBe(422);
    expect((await CREATE_EXAM(req(owner, "POST", body))).status).toBe(422);
    const updated = await UPDATE_EXAM(req(owner, "PUT", { ...body, notes: "" }), p);
    expect(updated.status).toBe(200);
    expect(JSON.stringify(await updated.json())).not.toMatch(/"notes"\s*:/);
    // Exame e funcionário com prontuário não são apagados; o prontuário fica íntegro.
    await expect(deleteHealthExam("org_a", exam.id)).rejects.toMatchObject({
      code: "IN_USE",
    });
    await expect(deleteEmployee("org_a", I.employeeA)).rejects.toMatchObject({
      code: "IN_USE",
    });
    const [{ kept }] =
      await admin`select count(*)::int as kept from health_exam_clinical_notes where health_exam_id=${exam.id}`;
    expect(kept).toBe(1);
  });
});
