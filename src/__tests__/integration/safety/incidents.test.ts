/**
 * Integração das Server Actions + repositório de Incidentes/Acidentes (Fase 06, US4/US5)
 * contra Postgres efêmero. Mocka o gate de papel, a URL do banco (app runtime → efêmero)
 * e next/cache. Dado de saúde é P0: nenhum payload sensível é impresso; a ausência de
 * conteúdo médico no log de auditoria é verificada por espião de console.
 */
import type postgres from "postgres";

jest.mock("@/shared/db/env", () => ({
  getDatabaseUrl: () => process.env.INTEGRATION_APP_RUNTIME_URL,
}));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("@/shared/auth/require-office-staff", () => ({
  requireOfficeStaff: jest.fn(),
}));

import { requireOfficeStaff } from "@/shared/auth/require-office-staff";
import { ForbiddenError } from "@/shared/auth/errors";
import type { AccidentCreateInput } from "@/shared/domains/safety/accident";
import {
  createAccidentAction,
  deleteAccidentAction,
  getAccidentAction,
  listAccidentsAction,
  setAccidentStatusAction,
  updateAccidentAction,
} from "@/shared/server/actions/safety/accidents";

import { adminClient, appRuntimeClient, applyMigrations } from "../_helpers/db";
import { seedPgrBase, PGR_IDS } from "../_helpers/pgr-seed";

const APP_RUNTIME_URL = process.env.INTEGRATION_APP_RUNTIME_URL;
const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!APP_RUNTIME_URL && !!ADMIN_URL;

const mockedGate = requireOfficeStaff as jest.MockedFunction<typeof requireOfficeStaff>;

function asOwner(tenantId: string) {
  mockedGate.mockResolvedValue({ userId: "u", tenantId, plan: "free", role: "owner" });
}

const MIN: AccidentCreateInput = {
  companyId: PGR_IDS.companyA,
  occurredAt: "2026-07-10T14:30:00Z",
  type: "typical",
  category: "without_leave",
  severity: "minor",
};

async function createOk(input = MIN): Promise<string> {
  const r = await createAccidentAction(input);
  if (!r.ok) throw new Error(`create falhou: ${r.error.code}`);
  return r.data.id;
}

/** Avança até `awaiting_completion` para permitir testar a conclusão. */
async function advanceToAwaitingCompletion(id: string): Promise<void> {
  await setAccidentStatusAction(id, { status: "awaiting_planning" });
  await setAccidentStatusAction(id, { status: "awaiting_completion" });
}

(shouldRun ? describe : describe.skip)(
  "Server Actions — accidents/incidents (US4/US5)",
  () => {
    let admin: ReturnType<typeof postgres>;
    let runtime: ReturnType<typeof postgres>;

    beforeAll(async () => {
      admin = adminClient();
      await applyMigrations(admin);
      runtime = appRuntimeClient();
    });

    afterAll(async () => {
      await runtime.end({ timeout: 5 });
      await admin.end({ timeout: 5 });
    });

    beforeEach(async () => {
      await seedPgrBase(admin);
      mockedGate.mockReset();
      asOwner("org_a");
    });

    it("1. cria incidente mínimo com status inicial registered", async () => {
      const r = await createAccidentAction(MIN);
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.data.status).toBe("registered");
        expect(r.data.companyId).toBe(PGR_IDS.companyA);
      }
    });

    it("2. cria incidente com campos opcionais e vínculo de funcionário", async () => {
      const r = await createAccidentAction({
        ...MIN,
        employeeId: PGR_IDS.employeeA,
        location: "Setor B",
        description: "Queda de mesmo nível",
        awayFromWork: true,
        workedHours: 6,
        hospital: "Atendimento interno",
        injuryNatureCode: "301",
        catNumber: "CAT-2026-001",
        catIssuedAt: "2026-07-11",
      });
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.data.employeeId).toBe(PGR_IDS.employeeA);
        expect(r.data.awayFromWork).toBe(true);
      }
    });

    it("5. company cross-tenant → FK_NOT_FOUND (422)", async () => {
      const r = await createAccidentAction({ ...MIN, companyId: PGR_IDS.companyB });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.code).toBe("FK_NOT_FOUND");
    });

    it("6. employee cross-tenant → FK_NOT_FOUND (422)", async () => {
      const r = await createAccidentAction({ ...MIN, employeeId: PGR_IDS.employeeB });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.code).toBe("FK_NOT_FOUND");
    });

    it("7. incidente cross-tenant → NOT_FOUND (404)", async () => {
      asOwner("org_b");
      const id = await createOk({ ...MIN, companyId: PGR_IDS.companyB });
      asOwner("org_a");
      const fetched = await getAccidentAction(id);
      expect(fetched.ok).toBe(false);
      if (!fetched.ok) expect(fetched.error.code).toBe("NOT_FOUND");
    });

    it("8/9. lista com paginação e filtros por status/tipo/categoria/severidade", async () => {
      await createOk();
      await createOk({ ...MIN, type: "commute", severity: "moderate" });
      await createOk({ ...MIN, category: "with_leave", severity: "severe" });

      const all = await listAccidentsAction({});
      expect(all.ok && all.data.total).toBe(3);

      const byType = await listAccidentsAction({ type: "commute" });
      expect(byType.ok && byType.data.rows).toHaveLength(1);

      const byCategory = await listAccidentsAction({ category: "with_leave" });
      expect(byCategory.ok && byCategory.data.rows).toHaveLength(1);

      const bySeverity = await listAccidentsAction({ severity: "severe" });
      expect(bySeverity.ok && bySeverity.data.rows).toHaveLength(1);

      const registered = await listAccidentsAction({ status: "registered" });
      expect(registered.ok && registered.data.total).toBe(3);

      const paged = await listAccidentsAction({ page: 1, pageSize: 2 });
      expect(paged.ok && paged.data.rows).toHaveLength(2);
      expect(paged.ok && paged.data.total).toBe(3);
    });

    it("10. atualiza conteúdo sem alterar o status", async () => {
      const id = await createOk();
      const upd = await updateAccidentAction(id, {
        ...MIN,
        severity: "severe",
        responsibleArea: "SESMT",
      });
      expect(upd.ok).toBe(true);
      if (upd.ok) {
        expect(upd.data.severity).toBe("severe");
        expect(upd.data.status).toBe("registered");
      }
    });

    it("11. transição válida avança o estado", async () => {
      const id = await createOk();
      const r = await setAccidentStatusAction(id, { status: "awaiting_planning" });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.data.status).toBe("awaiting_planning");
    });

    it("12. transição inválida → VALIDATION (erro de domínio)", async () => {
      const id = await createOk();
      const r = await setAccidentStatusAction(id, { status: "completed" });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.code).toBe("VALIDATION");
    });

    it("13. estado terminal não retrocede/nem transiciona", async () => {
      const id = await createOk();
      await advanceToAwaitingCompletion(id);
      const done = await setAccidentStatusAction(id, {
        status: "completed",
        justification: "Ações concluídas",
      });
      expect(done.ok).toBe(true);
      const back = await setAccidentStatusAction(id, { status: "awaiting_planning" });
      expect(back.ok).toBe(false);
      if (!back.ok) expect(back.error.code).toBe("VALIDATION");
    });

    it("14. conclusão exige justificativa; com justificativa grava completed_at", async () => {
      const id = await createOk();
      await advanceToAwaitingCompletion(id);
      const noJustif = await setAccidentStatusAction(id, { status: "completed" });
      expect(noJustif.ok).toBe(false);
      if (!noJustif.ok) expect(noJustif.error.code).toBe("VALIDATION");

      const done = await setAccidentStatusAction(id, {
        status: "completed",
        justification: "Tratado e verificado",
      });
      expect(done.ok).toBe(true);
      if (done.ok) {
        expect(done.data.status).toBe("completed");
        expect(done.data.completedAt).not.toBeNull();
        expect(done.data.completionJustification).toBe("Tratado e verificado");
      }
    });

    it("15. CAT interno (número/data) persiste como texto", async () => {
      const id = await createOk({
        ...MIN,
        catNumber: "CAT-INTERNO-42",
        catIssuedAt: "2026-07-12",
      });
      const [row] = await admin<
        { cat_number: string | null; cat_issued_at: string | null }[]
      >`select cat_number, cat_issued_at::text as cat_issued_at from public.accidents where id = ${id}`;
      expect(row.cat_number).toBe("CAT-INTERNO-42");
      expect(row.cat_issued_at).toBe("2026-07-12");
    });

    it("16. nenhum esocial_event é criado ao registrar incidente", async () => {
      await createOk({ ...MIN, catNumber: "CAT-2026-777" });
      const [{ count }] = await admin<{ count: number }[]>`
      select count(*)::int as count from public.esocial_events where org_id = 'org_a'`;
      expect(count).toBe(0);
    });

    it("17. papel client → FORBIDDEN (403) em todas as superfícies", async () => {
      mockedGate.mockRejectedValue(new ForbiddenError());
      const list = await listAccidentsAction({});
      expect(list.ok).toBe(false);
      if (!list.ok) expect(list.error.code).toBe("FORBIDDEN");
      const create = await createAccidentAction(MIN);
      expect(create.ok).toBe(false);
      if (!create.ok) expect(create.error.code).toBe("FORBIDDEN");
    });

    it("18. RLS: query bare (sem tenant) não enxerga incidentes de nenhum tenant", async () => {
      await createOk();
      const bare = await runtime<{ id: string }[]>`select id from public.accidents`;
      expect(bare).toHaveLength(0);
    });

    it("19. auditoria não registra dado de saúde/investigação", async () => {
      const logs: string[] = [];
      const logSpy = jest
        .spyOn(console, "log")
        .mockImplementation((l) => logs.push(String(l)));
      const errSpy = jest
        .spyOn(console, "error")
        .mockImplementation((l) => logs.push(String(l)));
      try {
        await createAccidentAction({
          ...MIN,
          hospital: "HOSPITAL_SENSIVEL_XYZ",
          witnesses: "TESTEMUNHA_SECRETA",
          injuryNatureDescription: "LESAO_CONFIDENCIAL",
        });
      } finally {
        logSpy.mockRestore();
        errSpy.mockRestore();
      }
      const blob = logs.join("\n");
      expect(blob).not.toContain("HOSPITAL_SENSIVEL_XYZ");
      expect(blob).not.toContain("TESTEMUNHA_SECRETA");
      expect(blob).not.toContain("LESAO_CONFIDENCIAL");
    });

    it("20. exclusão permitida no tenant; cross-tenant → NOT_FOUND", async () => {
      const id = await createOk();
      const del = await deleteAccidentAction(id);
      expect(del.ok).toBe(true);

      asOwner("org_b");
      const otherId = await createOk({ ...MIN, companyId: PGR_IDS.companyB });
      asOwner("org_a");
      const crossDelete = await deleteAccidentAction(otherId);
      expect(crossDelete.ok).toBe(false);
      if (!crossDelete.ok) expect(crossDelete.error.code).toBe("NOT_FOUND");
    });

    it("21. fotos não possuem coluna de persistência nem API de arquivos", async () => {
      const cols = await admin<{ column_name: string }[]>`
      select column_name from information_schema.columns
      where table_schema = 'public' and table_name = 'accidents'
        and (column_name ilike '%photo%' or column_name ilike '%foto%'
             or column_name ilike '%attachment%' or column_name ilike '%file%')`;
      expect(cols).toHaveLength(0);
    });
  },
);
