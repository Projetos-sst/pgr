/**
 * Exclusão de profissional que examinou: excluir não pode apagar em silêncio o examinador dos
 * exames (antes a FK `health_exams.doctor_id` era SET NULL). Contra Postgres efêmero:
 * - examinador de exame registrado → IN_USE com a mensagem própria; o exame mantém o médico;
 * - exame que a RLS esconde (empresa sem o módulo de Medicina) também bloqueia (FK NO ACTION);
 * - confirmação de conclusão do ASO com o profissional como examinador → IN_USE;
 * - profissional sem exames continua excluível.
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

import { requireOfficeStaff } from "@/shared/auth/require-office-staff";
import { createHealthExamAction } from "@/shared/server/actions/pgr/health-exams";
import {
  createMedicoAction,
  deleteMedicoAction,
} from "@/shared/server/actions/pgr/medicos";
import { MEDICO_EXAMINER_IN_USE_MESSAGE } from "@/shared/domains/pgr/medicos";

import { adminClient, applyMigrations } from "../_helpers/db";
import { seedPgrBase, PGR_IDS } from "../_helpers/pgr-seed";

const APP_RUNTIME_URL = process.env.INTEGRATION_APP_RUNTIME_URL;
const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!APP_RUNTIME_URL && !!ADMIN_URL;

const mockedGate = requireOfficeStaff as jest.MockedFunction<typeof requireOfficeStaff>;
const asOwner = (tenantId: string) =>
  mockedGate.mockResolvedValue({ userId: "u", tenantId, plan: "free", role: "owner" });

(shouldRun ? describe : describe.skip)("Médicos — exclusão de examinador", () => {
  let admin: ReturnType<typeof postgres>;

  beforeAll(async () => {
    admin = adminClient();
    await applyMigrations(admin);
  });
  afterAll(async () => {
    await admin.end({ timeout: 5 });
  });
  beforeEach(async () => {
    await seedPgrBase(admin);
    mockedGate.mockReset();
    asOwner("org_a");
  });

  const newDoctor = async (crm: string) => {
    const doctor = await createMedicoAction({
      name: "Dra. Examinadora Fictícia",
      crm,
      registrationUf: "SP",
    });
    if (!doctor.ok) throw new Error("médico de teste não criado");
    return doctor.data.id;
  };

  const newExam = async (doctorId: string | undefined) => {
    const created = await createHealthExamAction({
      employeeId: PGR_IDS.employeeA,
      doctorId,
      examType: "admissional",
      performedAt: "2026-01-14",
      validUntil: "2027-01-14",
      aptitude: "fit",
    });
    if (!created.ok) throw new Error("exame de teste não criado");
    return created.data.id;
  };

  const doctorOf = async (examId: string) => {
    const [row] = await admin<{ doctor_id: string | null }[]>`
      select doctor_id from health_exams where id = ${examId}`;
    return row.doctor_id;
  };

  const medicoExists = async (id: string) => {
    const [{ total }] = await admin<{ total: number }[]>`
      select count(*)::int as total from medicos where id = ${id}`;
    return total === 1;
  };

  it("examinador de exame registrado → IN_USE; o exame mantém o médico", async () => {
    const doctorId = await newDoctor("71.001");
    const examId = await newExam(doctorId);

    const res = await deleteMedicoAction(doctorId);
    expect(res).toMatchObject({
      ok: false,
      error: { code: "IN_USE", message: MEDICO_EXAMINER_IN_USE_MESSAGE },
    });
    expect(await medicoExists(doctorId)).toBe(true);
    expect(await doctorOf(examId)).toBe(doctorId);
  });

  it("exame escondido pela RLS (empresa sem Medicina) também bloqueia a exclusão", async () => {
    const doctorId = await newDoctor("71.002");
    const examId = await newExam(doctorId);
    await admin`
      update company_modules set enabled = false
      where org_id = 'org_a' and company_id = ${PGR_IDS.companyA} and module = 'medicine'`;

    const res = await deleteMedicoAction(doctorId);
    expect(res).toMatchObject({
      ok: false,
      error: { code: "IN_USE", message: MEDICO_EXAMINER_IN_USE_MESSAGE },
    });
    expect(await medicoExists(doctorId)).toBe(true);
    expect(await doctorOf(examId)).toBe(doctorId);
  });

  it("examinador numa confirmação de conclusão do ASO → IN_USE", async () => {
    const doctorId = await newDoctor("71.003");
    const examId = await newExam(undefined);
    await admin`
      insert into aso_examiner_conclusions
        (org_id, company_id, health_exam_id, conclusion, recorded_aptitude, examiner_medico_id, confirmed_by)
      values ('org_a', ${PGR_IDS.companyA}, ${examId}, 'fit', 'fit_with_restrictions', ${doctorId}, 'u')`;

    const res = await deleteMedicoAction(doctorId);
    expect(res).toMatchObject({
      ok: false,
      error: { code: "IN_USE", message: MEDICO_EXAMINER_IN_USE_MESSAGE },
    });
    expect(await medicoExists(doctorId)).toBe(true);
  });

  it("profissional sem exames continua excluível", async () => {
    const doctorId = await newDoctor("71.004");
    await newExam(undefined);

    expect(await deleteMedicoAction(doctorId)).toMatchObject({ ok: true });
    expect(await medicoExists(doctorId)).toBe(false);
  });
});
