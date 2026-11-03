/**
 * Afastamentos (NOB-139) contra Postgres efêmero:
 * - registro administrativo com empresa do servidor, período, conflitos, previsão, retorno,
 *   cancelamento e histórico;
 * - alerta de retorno (NR-7 7.5.9) e sinalização da 7.5.19.5 c;
 * - área clínica (atestado e CID) só para o coordenador vinculado;
 * - isolamento, módulo, SQL direto, ausência de dado clínico no REST e regressão do prontuário
 *   (NOB-155) e do vínculo (NOB-157).
 * Dados fictícios.
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
import { createHealthExam } from "@/shared/db/repositories/health-exams";
import { deleteEmployee } from "@/shared/db/repositories/employees";
import {
  addClinicalNote,
  cancelAbsence,
  confirmReturn,
  createAbsence,
  getAbsence,
  listAbsences,
  readClinicalNotes,
  updateAbsenceEnd,
} from "@/shared/server/medicine/absence-core";
import { readClinicalRecord } from "@/shared/server/medicine/clinical-record-core";
import {
  createAbsenceAction,
  readAbsenceClinicalNotesAction,
} from "@/shared/server/actions/medicine/absences";
import { GET as LIST, POST as CREATE } from "@/app/api/v1/employees/[id]/absences/route";
import { GET as SHOW, PUT as UPDATE_END } from "@/app/api/v1/absences/[id]/route";
import { POST as RETURN } from "@/app/api/v1/absences/[id]/return/route";
import { POST as CANCEL } from "@/app/api/v1/absences/[id]/cancel/route";
import {
  GET as CLINICAL_GET,
  POST as CLINICAL_POST,
} from "@/app/api/v1/absences/[id]/clinical-notes/route";
import { adminClient, applyMigrations } from "../_helpers/db";
import { seedPgrBase, PGR_IDS as I } from "../_helpers/pgr-seed";
import { linkByInvitation } from "../_helpers/professional-link";

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
const other: TenantContext = { ...owner, userId: "other-doc", role: "collaborator" };
const client: TenantContext = { ...owner, userId: "client", role: "client" };
const ownerB: TenantContext = {
  tenantId: "org_b",
  userId: "owner-b",
  role: "owner",
  plan: "pro",
};
const COORDINATOR = "aaaaaaaa-0000-4000-8000-000000000071";
const OTHER_DOCTOR = "aaaaaaaa-0000-4000-8000-000000000072";
const CID_MARK = "Z00.0";
const NOTE_MARK = "EXEMPLO-ATESTADO-SIGILOSO";

const req = (ctx: TenantContext, method = "GET", body?: unknown) =>
  new NextRequest("http://localhost/api/v1/absences", {
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

(enabled ? describe : describe.skip)("Afastamentos (NOB-139)", () => {
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
    await admin`insert into users (id,email) values ('owner','o@example.test'),('staff','s@example.test'),('coord','c@example.test'),('other-doc','x@example.test'),('client','cl@example.test'),('owner-b','ob@example.test')`;
    await admin`insert into org_memberships (org_id,user_id,role) values ('org_a','owner','owner'),('org_a','staff','collaborator'),('org_a','coord','collaborator'),('org_a','other-doc','collaborator'),('org_a','client','client'),('org_b','owner-b','owner')`;
    await admin`insert into medicos (id, org_id, name, crm, profession, status) values
      (${COORDINATOR}, 'org_a', 'Dra. Coordenadora Fictícia', '80001', 'physician', 'active'),
      (${OTHER_DOCTOR}, 'org_a', 'Dr. Outro Fictício', '80002', 'physician', 'active')`;
    await admin`insert into pcmso_coordinator_assignments (org_id, company_id, medico_id, starts_on, created_by)
      values ('org_a', ${I.companyA}, ${COORDINATOR}, '2026-01-01', 'owner')`;
    await linkByInvitation(owner, COORDINATOR, {
      userId: "coord",
      reason: "Coordenadora fictícia.",
    });
    await linkByInvitation(owner, OTHER_DOCTOR, {
      userId: "other-doc",
      reason: "Médico sem designação.",
    });
    process.env.APP_ENV = "local";
    process.env.DEV_API_AUTH_BYPASS = "true";
    (requireOfficeStaff as jest.Mock).mockResolvedValue(staff);
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

  it("registro com empresa do servidor, alertas 29/30 dias, retorno confirmado e histórico", async () => {
    const short = await createAbsence(staff, I.employeeA, {
      cause: "illness",
      startsOn: "2026-01-01",
      endsOn: "2026-01-29",
    });
    expect(short).toMatchObject({ companyId: I.companyA, endsOn: "2026-01-29" });
    expect(short.assessment.returnExam.state).toBe("not_required");
    const long = await createAbsence(staff, I.employeeA, {
      cause: "accident",
      workRelation: "occupational",
      startsOn: "2026-02-01",
      endsOn: "2026-03-02",
    });
    expect(long.assessment.returnExam).toMatchObject({
      state: "required",
      mustBeDoneBefore: "2026-03-03",
      recordedOn: null,
      requiresMedicalConfirmation: true,
    });
    expect(long.assessment.socialSecurityReferral?.flagged).toBe(true);
    // Retorno ainda não confirmado → em andamento; confirmar fecha o período.
    expect((await getAbsence(staff, long.id)).assessment.status).toBe("ongoing");
    // Exame de retorno registrado é reconhecido (sem emitir ASO nem decidir aptidão).
    await createHealthExam("org_a", {
      employeeId: I.employeeA,
      examType: "return_to_work",
      performedAt: "2026-03-03",
      aptitude: "fit",
    });
    const returned = await confirmReturn(staff, long.id, { returnedOn: "2026-03-03" });
    expect(returned).toMatchObject({ returnedOn: "2026-03-03", endsOn: "2026-03-02" });
    expect(returned.assessment.status).toBe("returned");
    expect(returned.assessment.returnExam.recordedOn).toBe("2026-03-03");
    expect(returned.events.map((e) => e.kind)).toEqual(["created", "returned"]);
    // Retorno confirmado não muda mais.
    await expect(
      updateAbsenceEnd(staff, long.id, { endsOn: "2026-03-10" }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    const list = await listAbsences(staff, I.employeeA);
    expect(list.map((a) => a.id)).toEqual([long.id, short.id]);
  });

  it("em andamento sem fim, previsão, conflitos, outro motivo e cancelamento com histórico", async () => {
    const open = await createAbsence(staff, I.employeeA, {
      cause: "illness",
      startsOn: "2026-01-01",
    });
    expect(open.endsOn).toBeNull();
    expect(open.assessment.returnExam.state).toBe("required"); // já soma mais de 30 dias até hoje
    // Período aberto conflita com qualquer outro posterior.
    await expect(
      createAbsence(staff, I.employeeA, { cause: "other", startsOn: "2026-05-01" }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(
      createAbsence(staff, I.employeeA, {
        cause: "illness",
        startsOn: "2026-01-10",
        endsOn: "2026-01-05",
      }),
    ).rejects.toThrow();
    const updated = await updateAbsenceEnd(staff, open.id, { endsOn: "2026-01-29" });
    expect(updated.assessment.returnExam.state).toBe("not_required");
    const other = await createAbsence(staff, I.employeeA, {
      cause: "other",
      startsOn: "2026-02-01",
      endsOn: "2026-04-01",
    });
    expect(other.assessment.returnExam.state).toBe("not_applicable");
    // Previsão que passaria a conflitar → recusada.
    await expect(
      updateAbsenceEnd(staff, open.id, { endsOn: "2026-02-05" }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    const cancelled = await cancelAbsence(staff, other.id, {
      reason: "Registro fictício feito por engano.",
    });
    expect(cancelled.cancelledAt).not.toBeNull();
    expect(cancelled.events.map((e) => e.kind)).toEqual(["created", "cancelled"]);
    await expect(
      cancelAbsence(staff, other.id, { reason: "Segundo cancelamento fictício." }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    // Cancelado sai da checagem de conflito; o histórico continua listado.
    await createAbsence(staff, I.employeeA, { cause: "illness", startsOn: "2026-02-10" });
    expect(await listAbsences(staff, I.employeeA)).toHaveLength(3);
  });

  it("área clínica: só o coordenador vinculado lê e grava; CID só com autorização; trilha sem conteúdo", async () => {
    const absence = await createAbsence(staff, I.employeeA, {
      cause: "illness",
      startsOn: "2026-01-01",
      endsOn: "2026-01-10",
    });
    await expect(
      addClinicalNote(coordinator, absence.id, { cid: CID_MARK }),
    ).rejects.toThrow();
    const note = await addClinicalNote(coordinator, absence.id, {
      cid: CID_MARK,
      workerAuthorization: "Termo fictício assinado",
      content: NOTE_MARK,
    });
    expect(note).toMatchObject({
      cid: CID_MARK,
      authorName: "Dra. Coordenadora Fictícia",
    });
    expect((await readClinicalNotes(coordinator, absence.id)).map((n) => n.cid)).toEqual([
      CID_MARK,
    ]);
    for (const ctx of [owner, staff, other]) {
      await expect(readClinicalNotes(ctx, absence.id)).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
      await expect(
        addClinicalNote(ctx, absence.id, { content: "Tentativa fictícia." }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
    await expect(readClinicalNotes(ownerB, absence.id)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    const trail =
      await admin`select action, actor_user_id from absence_clinical_access_events where absence_id=${absence.id} order by occurred_at, action`;
    expect(trail.map((t) => `${t.actor_user_id}:${t.action}`).sort()).toEqual(
      ["coord:note_added", "coord:read"].sort(),
    );
    expect(JSON.stringify(trail)).not.toContain(NOTE_MARK);
    // Designação encerrada → perde o acesso.
    await admin`update pcmso_coordinator_assignments set ends_on='2026-10-30', end_reason='Troca fictícia.' where medico_id=${COORDINATOR}`;
    await expect(readClinicalNotes(coordinator, absence.id)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    // Action com sessão do owner: erro sem conteúdo.
    (requireOfficeStaff as jest.Mock).mockResolvedValue(owner);
    const denied = await readAbsenceClinicalNotesAction(absence.id);
    expect(denied).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    expect(JSON.stringify(denied)).not.toContain(NOTE_MARK);
    // Funcionário com área clínica de afastamento não é apagado.
    await expect(deleteEmployee("org_a", I.employeeA)).rejects.toMatchObject({
      code: "IN_USE",
    });
  });

  it("SQL direto com app_runtime: área clínica, autoria e histórico protegidos; tenant isolado", async () => {
    const absence = await createAbsence(staff, I.employeeA, {
      cause: "illness",
      startsOn: "2026-01-01",
      endsOn: "2026-01-10",
    });
    await addClinicalNote(coordinator, absence.id, { content: NOTE_MARK });
    const count = (actor: string, table: string, org = "org_a") =>
      asRuntime(
        actor,
        (tx) => tx.unsafe(`select count(*)::int as n from ${table}`),
        org,
      ).then((rows) => (rows as unknown as { n: number }[])[0].n);
    expect(await count("coord", "employee_absence_clinical_notes")).toBe(1);
    for (const actor of ["owner", "staff", "other-doc", "client", ""])
      expect(await count(actor, "employee_absence_clinical_notes")).toBe(0);
    expect(await count("owner-b", "employee_absences", "org_b")).toBe(0);
    // Gravação clínica forjada pelo owner → recusada.
    await expect(
      asRuntime(
        "owner",
        (tx) =>
          tx`insert into employee_absence_clinical_notes (org_id, company_id, absence_id, content, authored_by_medico_id, recorded_by)
            values ('org_a', ${I.companyA}, ${absence.id}, 'Forjado.', ${COORDINATOR}, 'owner')`,
      ),
    ).rejects.toMatchObject({ code: "42501" });
    // Afastamento em nome de outra conta → recusado; sem DELETE; colunas imutáveis.
    await expect(
      asRuntime(
        "staff",
        (tx) =>
          tx`insert into employee_absences (org_id, company_id, employee_id, cause, starts_on, created_by, last_changed_by)
            values ('org_a', ${I.companyA}, ${I.employeeA}, 'illness', '2026-06-01', 'owner', 'owner')`,
      ),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      asRuntime("staff", (tx) => tx`delete from employee_absences`),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      asRuntime(
        "staff",
        (tx) =>
          tx`update employee_absences set starts_on='2025-01-01', last_changed_by='staff'`,
      ),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      asRuntime("staff", (tx) => tx`delete from employee_absence_events`),
    ).rejects.toMatchObject({ code: "42501" });
    // Módulo Medicina desligado: nada visível.
    await admin`update company_modules set enabled=false where company_id=${I.companyA} and module='medicine'`;
    expect(await count("staff", "employee_absences")).toBe(0);
    await expect(listAbsences(staff, I.employeeA)).rejects.toMatchObject({
      code: expect.stringMatching(/FORBIDDEN|NOT_FOUND/),
    });
  });

  it("REST e Actions: sem CID nem atestado nas respostas administrativas; códigos HTTP", async () => {
    const p = params(I.employeeA);
    const created = await CREATE(
      req(staff, "POST", {
        cause: "illness",
        startsOn: "2026-01-01",
        endsOn: "2026-01-30",
      }),
      p,
    );
    expect(created.status).toBe(201);
    const absence = await created.json();
    await addClinicalNote(coordinator, absence.id, {
      cid: CID_MARK,
      workerAuthorization: "Termo fictício",
      content: NOTE_MARK,
    });
    for (const res of [
      await LIST(req(owner), p),
      await SHOW(req(owner), params(absence.id)),
    ]) {
      expect(res.status).toBe(200);
      const json = JSON.stringify(await res.json());
      expect(json).not.toContain(CID_MARK);
      expect(json).not.toContain(NOTE_MARK);
      expect(json).not.toMatch(/"cid"\s*:/);
    }
    expect(
      (
        await CREATE(
          req(staff, "POST", { cause: "illness", startsOn: "2026-01-05", cid: "M54" }),
          p,
        )
      ).status,
    ).toBe(422);
    expect(
      (await CREATE(req(staff, "POST", { cause: "illness", startsOn: "2026-01-20" }), p))
        .status,
    ).toBe(422); // conflito de período
    expect((await LIST(req(client), p)).status).toBe(403);
    expect((await LIST(req(ownerB), p)).status).toBe(404);
    expect((await SHOW(req(ownerB), params(absence.id))).status).toBe(404);
    expect(
      (await UPDATE_END(req(staff, "PUT", { endsOn: "2026-02-05" }), params(absence.id)))
        .status,
    ).toBe(200);
    expect(
      (await RETURN(req(staff, "POST", { returnedOn: "2999-01-01" }), params(absence.id)))
        .status,
    ).toBe(422);
    expect(
      (await RETURN(req(staff, "POST", { returnedOn: "2026-02-06" }), params(absence.id)))
        .status,
    ).toBe(200);
    expect(
      (
        await CANCEL(
          req(staff, "POST", { reason: "Cancelamento fictício." }),
          params(absence.id),
        )
      ).status,
    ).toBe(422); // já retornou
    expect((await CLINICAL_GET(req(owner), params(absence.id))).status).toBe(403);
    expect((await CLINICAL_GET(req(coordinator), params(absence.id))).status).toBe(200);
    expect(
      (await CLINICAL_POST(req(staff, "POST", { content: "x" }), params(absence.id)))
        .status,
    ).toBe(403);
    const action = await createAbsenceAction(I.employeeA, {
      cause: "illness",
      startsOn: "2026-06-01",
    });
    expect(action.ok).toBe(true);
    expect(JSON.stringify(action)).not.toContain(CID_MARK);
  });

  it("regressão: prontuário do exame (NOB-155) segue restrito ao médico vinculado", async () => {
    const exam = await createHealthExam("org_a", {
      employeeId: I.employeeA,
      examType: "periodic",
      performedAt: "2026-02-01",
      aptitude: "fit",
    });
    await expect(readClinicalRecord(owner, exam.id)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect((await readClinicalRecord(coordinator, exam.id)).basis).toBe("coordinator");
    await expect(readClinicalRecord(other, exam.id)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});
