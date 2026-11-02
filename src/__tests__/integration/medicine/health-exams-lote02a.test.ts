/**
 * Lote 02A (NOB-112) contra Postgres efêmero — Server Actions E REST mirror:
 * vencimento × realização, tipo de exame, identidade do exame (sem troca de
 * funcionário), limites de `notes`/`certificatePath`, permissões (módulo, papel,
 * tenant) e ausência das observações nos logs. Só dados fictícios; nenhuma
 * migration nova (o schema é o mesmo do Lote 01).
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
import { ForbiddenError } from "@/shared/auth/errors";
import { GET, POST } from "@/app/api/v1/health-exams/route";
import { GET as GET_ID, PUT as PUT_ID } from "@/app/api/v1/health-exams/[id]/route";
import {
  createHealthExamAction,
  listHealthExamsAction,
  updateHealthExamAction,
} from "@/shared/server/actions/pgr/health-exams";
import type { HealthExamInput } from "@/shared/domains/pgr/health-exams";

import { adminClient, applyMigrations } from "../_helpers/db";
import {
  LOTE02A_IDS as L,
  MEDICINE_IDS as M,
  SENSITIVE_MARKERS,
  seedLegacyInvalidDateExam,
  seedMedicine,
} from "../_helpers/medicine-seed";
import { seedPgrBase, PGR_IDS as I } from "../_helpers/pgr-seed";

const APP_RUNTIME_URL = process.env.INTEGRATION_APP_RUNTIME_URL;
const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!APP_RUNTIME_URL && !!ADMIN_URL;

const mockedGate = requireOfficeStaff as jest.MockedFunction<typeof requireOfficeStaff>;
const asOwner = (tenantId = "org_a") =>
  mockedGate.mockResolvedValue({ userId: "u", tenantId, plan: "free", role: "owner" });

const URL_BASE = "http://localhost/api/v1/health-exams";

function req(opts: {
  method: string;
  body?: string;
  role?: string;
  tenant?: string;
  path?: string;
}) {
  const { method, body, role = "owner", tenant = "org_a", path = "" } = opts;
  return new NextRequest(`${URL_BASE}${path}`, {
    method,
    body,
    headers: {
      "content-type": "application/json",
      "x-dev-tenant": tenant,
      "x-dev-role": role,
    },
  });
}
const idParams = (id: string) => ({ params: Promise.resolve({ id }) });

// Exame recente de employeeA (companyA, Medicina ligada) — mesmos dados da seed.
const EXAM_A_INPUT: HealthExamInput = {
  employeeId: I.employeeA,
  doctorId: M.doctorA2,
  examType: "periodic",
  performedAt: "2026-01-10",
  validUntil: "2099-12-31",
  aptitude: "fit_with_restrictions",
};

const NEW_INPUT: HealthExamInput = {
  employeeId: M.employeeA2,
  examType: "admissional",
  performedAt: "2026-04-01",
  aptitude: "fit",
};

async function postJson(body: unknown, opts: { role?: string; tenant?: string } = {}) {
  const res = await POST(req({ method: "POST", body: JSON.stringify(body), ...opts }));
  return { status: res.status, body: await res.json() };
}
async function putJson(
  id: string,
  body: unknown,
  opts: { role?: string; tenant?: string } = {},
) {
  const res = await PUT_ID(
    req({ method: "PUT", body: JSON.stringify(body), path: `/${id}`, ...opts }),
    idParams(id),
  );
  return { status: res.status, body: await res.json() };
}

(shouldRun ? describe : describe.skip)(
  "Medicina — Lote 02A (validações de exames)",
  () => {
    let admin: ReturnType<typeof postgres>;

    beforeAll(async () => {
      admin = adminClient();
      await applyMigrations(admin);
      process.env.APP_ENV = "local";
      process.env.DEV_API_AUTH_BYPASS = "true";
    });
    afterAll(async () => {
      await admin.end({ timeout: 5 });
      delete process.env.DEV_API_AUTH_BYPASS;
    });
    beforeEach(async () => {
      await seedPgrBase(admin);
      await seedMedicine(admin);
      mockedGate.mockReset();
      asOwner();
    });

    async function examRow(id: string) {
      const [row] = await admin`
      select employee_id, exam_type, performed_at::text as performed_at,
             valid_until::text as valid_until, notes
      from health_exams where id = ${id}`;
      return row;
    }

    // ── Datas ──────────────────────────────────────────────────────────────────

    describe("vencimento × realização", () => {
      it.each([
        ["posterior", "2027-04-01"],
        ["igual", "2026-04-01"],
      ])("criação com vencimento %s → ok (Action e REST)", async (_label, validUntil) => {
        const action = await createHealthExamAction({ ...NEW_INPUT, validUntil });
        expect(action.ok).toBe(true);
        if (action.ok) expect(action.data.validUntil).toBe(validUntil);

        const rest = await postJson({ ...NEW_INPUT, validUntil });
        expect(rest.status).toBe(201);
        expect(rest.body.validUntil).toBe(validUntil);
      });

      it("criação sem vencimento → ok, grava null (Action e REST)", async () => {
        const action = await createHealthExamAction(NEW_INPUT);
        expect(action.ok && action.data.validUntil).toBeNull();
        const rest = await postJson({ ...NEW_INPUT, validUntil: "" });
        expect(rest.status).toBe(201);
        expect(rest.body.validUntil).toBeNull();
      });

      it("criação com vencimento anterior → VALIDATION no campo, nada gravado", async () => {
        const before = await admin`select count(*)::int as n from health_exams`;

        const action = await createHealthExamAction({
          ...NEW_INPUT,
          validUntil: "2026-03-31",
        });
        expect(action.ok).toBe(false);
        if (!action.ok) {
          expect(action.error.code).toBe("VALIDATION");
          expect(action.error.fields).toEqual({
            validUntil: "Vencimento anterior à realização.",
          });
        }

        const rest = await postJson({ ...NEW_INPUT, validUntil: "2026-03-31" });
        expect(rest.status).toBe(422);
        expect(rest.body.error.code).toBe("VALIDATION");
        expect(rest.body.error.fields.validUntil).toBe(
          "Vencimento anterior à realização.",
        );

        const after = await admin`select count(*)::int as n from health_exams`;
        expect(after[0].n).toBe(before[0].n);
      });

      it("edição com vencimento anterior → VALIDATION, exame intacto (Action e REST)", async () => {
        const invalid = { ...EXAM_A_INPUT, validUntil: "2026-01-09" };
        const action = await updateHealthExamAction(M.examARecent, invalid);
        expect(action.ok).toBe(false);
        if (!action.ok)
          expect(action.error.fields?.validUntil).toBe(
            "Vencimento anterior à realização.",
          );

        const rest = await putJson(M.examARecent, invalid);
        expect(rest.status).toBe(422);
        expect(rest.body.error.fields.validUntil).toBe(
          "Vencimento anterior à realização.",
        );

        expect((await examRow(M.examARecent)).valid_until).toBe("2099-12-31");
      });

      it("edição com vencimento igual → ok", async () => {
        const rest = await putJson(M.examARecent, {
          ...EXAM_A_INPUT,
          validUntil: "2026-01-10",
        });
        expect(rest.status).toBe(200);
        expect(rest.body.validUntil).toBe("2026-01-10");
      });

      it("formato inválido → VALIDATION com mensagem de data", async () => {
        const action = await createHealthExamAction({
          ...NEW_INPUT,
          validUntil: "01/04/2027",
        });
        expect(!action.ok && action.error.fields?.validUntil).toBe(
          "Data inválida (use AAAA-MM-DD)",
        );
        const rest = await putJson(M.examARecent, {
          ...EXAM_A_INPUT,
          performedAt: "2026-02-30",
        });
        expect(rest.status).toBe(422);
        expect(rest.body.error.fields.performedAt).toBe("Data inválida (use AAAA-MM-DD)");
      });

      it("exame legado com datas invertidas: lido sem alteração; editar exige corrigir", async () => {
        await seedLegacyInvalidDateExam(admin);
        const id = L.examA2LegacyInvalidDates;

        const got = await GET_ID(req({ method: "GET", path: `/${id}` }), idParams(id));
        expect(got.status).toBe(200);
        expect((await got.json()).validUntil).toBe("2026-03-01");

        const legacy = {
          employeeId: M.employeeA2,
          examType: "periodic",
          performedAt: "2026-03-10",
          validUntil: "2026-03-01",
          aptitude: "fit",
        };
        const blocked = await putJson(id, legacy);
        expect(blocked.status).toBe(422);
        expect((await examRow(id)).valid_until).toBe("2026-03-01");

        const fixed = await putJson(id, { ...legacy, validUntil: "2027-03-10" });
        expect(fixed.status).toBe(200);
        expect(fixed.body.validUntil).toBe("2027-03-10");
      });
    });

    // ── Tipo de exame ──────────────────────────────────────────────────────────

    describe("tipo de exame", () => {
      it("tipo válido → aceito como enviado", async () => {
        const rest = await postJson({ ...NEW_INPUT, examType: "return_to_work" });
        expect(rest.status).toBe(201);
        expect(rest.body.examType).toBe("return_to_work");
      });

      it("tipo inválido na criação/edição → 422 com mensagem, sem valor padrão", async () => {
        const created = await postJson({ ...NEW_INPUT, examType: "annual" });
        expect(created.status).toBe(422);
        expect(created.body.error.code).toBe("VALIDATION");
        expect(created.body.error.fields.examType).toBe("Tipo de exame inválido");

        const updated = await putJson(M.examARecent, { ...EXAM_A_INPUT, examType: "" });
        expect(updated.status).toBe(422);
        expect(updated.body.error.fields.examType).toBe("Tipo de exame inválido");
        expect((await examRow(M.examARecent)).exam_type).toBe("periodic");

        const action = await createHealthExamAction({
          ...NEW_INPUT,
          examType: "annual" as HealthExamInput["examType"],
        });
        expect(!action.ok && action.error.fields?.examType).toBe(
          "Tipo de exame inválido",
        );
      });

      it("filtro ?examType inválido → 422 (antes era ignorado); válido filtra", async () => {
        const bad = await GET(req({ method: "GET", path: "?examType=annual" }));
        expect(bad.status).toBe(422);
        const body = await bad.json();
        expect(body.error.code).toBe("VALIDATION");
        expect(body.error.fields.examType).toBe("Tipo de exame inválido");

        const good = await GET(req({ method: "GET", path: "?examType=periodic" }));
        expect(good.status).toBe(200);
        const list = await good.json();
        expect(list.rows.map((r: { id: string }) => r.id)).toEqual([M.examARecent]);

        const action = await listHealthExamsAction({ examType: "annual" });
        expect(!action.ok && action.error.code).toBe("VALIDATION");
      });

      it("corpo JSON malformado → 422 VALIDATION (não 500)", async () => {
        const res = await POST(req({ method: "POST", body: "{ não é json" }));
        expect(res.status).toBe(422);
        expect((await res.json()).error.code).toBe("VALIDATION");
      });
    });

    // ── Identidade ─────────────────────────────────────────────────────────────

    describe("identidade do exame", () => {
      it("edição normal preserva id e funcionário", async () => {
        const action = await updateHealthExamAction(M.examARecent, {
          ...EXAM_A_INPUT,
          aptitude: "fit",
        });
        expect(action.ok).toBe(true);
        if (action.ok) {
          expect(action.data.id).toBe(M.examARecent);
          expect(action.data.employeeId).toBe(I.employeeA);
          expect(action.data.aptitude).toBe("fit");
        }
      });

      it("troca de funcionário no mesmo escritório → VALIDATION, nada muda (Action e REST)", async () => {
        const swap = { ...EXAM_A_INPUT, employeeId: M.employeeA2 };
        const action = await updateHealthExamAction(M.examARecent, swap);
        expect(action.ok).toBe(false);
        if (!action.ok) {
          expect(action.error.code).toBe("VALIDATION");
          expect(action.error.message).toBe(
            "O funcionário de um exame já registrado não pode ser alterado.",
          );
        }
        const rest = await putJson(M.examARecent, swap);
        expect(rest.status).toBe(422);
        expect(rest.body.error.code).toBe("VALIDATION");
        expect((await examRow(M.examARecent)).employee_id).toBe(I.employeeA);
      });

      it("troca para funcionário de OUTRO escritório → mesma recusa, sem revelar nada", async () => {
        const rest = await putJson(M.examARecent, {
          ...EXAM_A_INPUT,
          employeeId: I.employeeB,
        });
        expect(rest.status).toBe(422);
        expect(rest.body.error.code).toBe("VALIDATION");
        expect(JSON.stringify(rest.body)).not.toContain(I.employeeB);
        expect((await examRow(M.examARecent)).employee_id).toBe(I.employeeA);
      });

      it("exame de outra organização → 404 em GET e PUT; dado do outro tenant intacto", async () => {
        const got = await GET_ID(
          req({ method: "GET", path: `/${M.examB}` }),
          idParams(M.examB),
        );
        expect(got.status).toBe(404);

        const put = await putJson(M.examB, {
          ...EXAM_A_INPUT,
          employeeId: I.employeeB,
        });
        expect(put.status).toBe(404);

        const action = await updateHealthExamAction(M.examB, {
          ...EXAM_A_INPUT,
          employeeId: I.employeeB,
        });
        expect(!action.ok && action.error.code).toBe("NOT_FOUND");
        expect((await examRow(M.examB)).exam_type).toBe("periodic");
      });

      it("funcionário de outra organização na criação → 422 FK_NOT_FOUND com frase legível", async () => {
        const rest = await postJson({ ...NEW_INPUT, employeeId: I.employeeB });
        expect(rest.status).toBe(422);
        expect(rest.body.error).toEqual({
          code: "FK_NOT_FOUND",
          message: "Funcionário não encontrado neste escritório.",
        });
      });
    });

    // ── Campos administrativos ─────────────────────────────────────────────────

    describe("limites de notes e certificatePath", () => {
      it("notes com 2.000 caracteres → ok; 2.001 → 422 sem ecoar o texto", async () => {
        const atLimit = "n".repeat(2000);
        const ok = await postJson({ ...NEW_INPUT, notes: atLimit });
        expect(ok.status).toBe(201);
        expect(ok.body.notes).toHaveLength(2000);

        const over = `${SENSITIVE_MARKERS.notes}${"n".repeat(2000)}`;
        const rejected = await postJson({ ...NEW_INPUT, notes: over });
        expect(rejected.status).toBe(422);
        expect(rejected.body.error.fields.notes).toBe(
          "Observações: máximo de 2.000 caracteres.",
        );
        expect(JSON.stringify(rejected.body)).not.toContain(SENSITIVE_MARKERS.notes);
      });

      it("certificatePath com 500 caracteres → ok; 501 → 422", async () => {
        const ok = await createHealthExamAction({
          ...NEW_INPUT,
          certificatePath: "c".repeat(500),
        });
        expect(ok.ok).toBe(true);
        const rejected = await putJson(M.examARecent, {
          ...EXAM_A_INPUT,
          certificatePath: "c".repeat(501),
        });
        expect(rejected.status).toBe(422);
        expect(rejected.body.error.fields.certificatePath).toBe(
          "Caminho do ASO: máximo de 500 caracteres.",
        );
      });

      it("observações não aparecem nos logs (sucesso, rejeição e bloqueio)", async () => {
        const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
        const errSpy = jest.spyOn(console, "error").mockImplementation(() => {});
        try {
          const marker = SENSITIVE_MARKERS.notes;
          await createHealthExamAction({ ...NEW_INPUT, notes: marker });
          await createHealthExamAction({
            ...NEW_INPUT,
            notes: marker,
            validUntil: "2020-01-01",
          });
          await postJson({ ...NEW_INPUT, notes: marker });
          await postJson({ ...NEW_INPUT, notes: `${marker}${"x".repeat(2000)}` });
          await putJson(M.examARecent, {
            ...EXAM_A_INPUT,
            employeeId: M.employeeA2,
            notes: marker,
          });
          await postJson({ ...NEW_INPUT, notes: marker }, { role: "client" });

          const logged = [...logSpy.mock.calls, ...errSpy.mock.calls]
            .map((args) => args.map(String).join(" "))
            .join("\n");
          expect(logged.length).toBeGreaterThan(0);
          expect(logged).not.toContain(marker);
        } finally {
          logSpy.mockRestore();
          errSpy.mockRestore();
        }
      });
    });

    // ── Permissões ─────────────────────────────────────────────────────────────

    describe("permissões e módulo", () => {
      it("Medicina habilitada → cria; desabilitada → FORBIDDEN (Action e REST)", async () => {
        expect((await createHealthExamAction(NEW_INPUT)).ok).toBe(true);

        const action = await createHealthExamAction({
          ...NEW_INPUT,
          employeeId: M.employeeA3,
        });
        expect(!action.ok && action.error.code).toBe("FORBIDDEN");

        const rest = await postJson({ ...NEW_INPUT, employeeId: M.employeeA3 });
        expect(rest.status).toBe(403);
        expect(rest.body.error.code).toBe("FORBIDDEN");
      });

      it("exame de empresa sem Medicina → editar dá 404 (invisível), nada muda", async () => {
        const rest = await putJson(M.examA3, {
          employeeId: M.employeeA3,
          examType: "periodic",
          performedAt: "2026-03-10",
          aptitude: "unfit",
        });
        expect(rest.status).toBe(404);
        const [row] =
          await admin`select aptitude from health_exams where id = ${M.examA3}`;
        expect(row.aptitude).toBe("fit");
      });

      it("papel sem permissão (client) → 403 no REST e FORBIDDEN na Action", async () => {
        const post = await postJson(NEW_INPUT, { role: "client" });
        expect(post.status).toBe(403);
        const put = await putJson(M.examARecent, EXAM_A_INPUT, { role: "client" });
        expect(put.status).toBe(403);

        mockedGate.mockRejectedValue(new ForbiddenError());
        const action = await updateHealthExamAction(M.examARecent, EXAM_A_INPUT);
        expect(!action.ok && action.error.code).toBe("FORBIDDEN");
      });

      it("isolamento: org_b não lê nem edita exames de org_a", async () => {
        const list = await GET(req({ method: "GET", tenant: "org_b" }));
        const body = await list.json();
        expect(body.rows.map((r: { id: string }) => r.id)).toEqual([M.examB]);

        const put = await putJson(M.examARecent, EXAM_A_INPUT, { tenant: "org_b" });
        expect(put.status).toBe(404);
        expect((await examRow(M.examARecent)).employee_id).toBe(I.employeeA);
      });
    });
  },
);
