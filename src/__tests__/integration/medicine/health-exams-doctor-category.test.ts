/**
 * D1 (auditoria E2E de 14/11): o médico responsável pelo exame ocupacional precisa ser médico (CRM).
 * Psicólogo é recusado no servidor, pelo repositório e pela REST, mesmo com o formulário contornado,
 * e não aparece nas opções do formulário. Dados fictícios, Postgres efêmero.
 */
import type postgres from "postgres";
import { NextRequest } from "next/server";

jest.mock("@/shared/db/env", () => ({
  getDatabaseUrl: () => process.env.INTEGRATION_APP_RUNTIME_URL,
}));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));

import {
  createHealthExam,
  EXAM_DOCTOR_NOT_PHYSICIAN_MESSAGE,
  updateHealthExam,
} from "@/shared/db/repositories/health-exams";
import { listMedicoOptions } from "@/shared/db/repositories/medicos";
import { POST as CREATE } from "@/app/api/v1/health-exams/route";
import { adminClient, applyMigrations } from "../_helpers/db";
import { seedPgrBase, PGR_IDS as I } from "../_helpers/pgr-seed";

const enabled =
  !!process.env.INTEGRATION_APP_RUNTIME_URL && !!process.env.INTEGRATION_DATABASE_URL;

const PHYSICIAN = "aaaaaaaa-0000-4000-8000-0000000000d1";
const PSYCHOLOGIST = "aaaaaaaa-0000-4000-8000-0000000000d2";
const INACTIVE_PHYSICIAN = "aaaaaaaa-0000-4000-8000-0000000000d3";

const exam = (doctorId: string | null) =>
  ({
    employeeId: I.employeeA,
    doctorId,
    examType: "admissional",
    performedAt: "2026-11-10",
    aptitude: "fit",
  }) as Parameters<typeof createHealthExam>[1];

const post = (body: unknown) =>
  new NextRequest("http://localhost/api/v1/health-exams", {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      "x-dev-tenant": "org_a",
      "x-dev-user": "staff",
      "x-dev-role": "collaborator",
    },
  });

(enabled ? describe : describe.skip)(
  "Exame: médico responsável precisa ser médico (D1)",
  () => {
    let admin: ReturnType<typeof postgres>;
    const originalEnv = { ...process.env };

    beforeAll(async () => {
      admin = adminClient();
      await admin`set client_min_messages = warning`;
      await applyMigrations(admin);
    });
    afterAll(async () => {
      process.env = originalEnv;
      await admin?.end({ timeout: 5 });
    });
    beforeEach(async () => {
      await seedPgrBase(admin);
      await admin`insert into medicos (id, org_id, name, crm, profession, registration_uf, rqe, affiliation, status) values
      (${PHYSICIAN}, 'org_a', 'Médico Fictício D1', '70001', 'physician', 'SP', null, 'internal', 'active'),
      (${PSYCHOLOGIST}, 'org_a', 'Psicóloga Fictícia D1', '06/70002', 'psychologist', 'SP', null, 'external', 'active'),
      (${INACTIVE_PHYSICIAN}, 'org_a', 'Médico Inativo Fictício D1', '70003', 'physician', 'SP', null, 'internal', 'inactive')`;
    });

    it("cria o exame com médico", async () => {
      const created = await createHealthExam("org_a", exam(PHYSICIAN));
      expect(created.doctorId).toBe(PHYSICIAN);
    });

    it("recusa psicólogo como responsável ao criar, sem gravar nada", async () => {
      await expect(createHealthExam("org_a", exam(PSYCHOLOGIST))).rejects.toMatchObject({
        message: EXAM_DOCTOR_NOT_PHYSICIAN_MESSAGE,
      });
      const [{ n }] =
        await admin`select count(*)::int as n from health_exams where doctor_id = ${PSYCHOLOGIST}`;
      expect(n).toBe(0);
    });

    it("recusa trocar o responsável para psicólogo ao editar", async () => {
      const created = await createHealthExam("org_a", exam(PHYSICIAN));
      await expect(
        updateHealthExam("org_a", created.id, exam(PSYCHOLOGIST)),
      ).rejects.toMatchObject({ message: EXAM_DOCTOR_NOT_PHYSICIAN_MESSAGE });
      const [row] =
        await admin`select doctor_id from health_exams where id = ${created.id}`;
      expect(row.doctor_id).toBe(PHYSICIAN);
    });

    it("exame sem médico informado continua permitido (rascunho, MED-08)", async () => {
      const created = await createHealthExam("org_a", exam(null));
      expect(created.doctorId).toBeNull();
    });

    it("a REST recusa psicólogo com 422 mesmo contornando o formulário", async () => {
      process.env.APP_ENV = "local";
      process.env.DEV_API_AUTH_BYPASS = "true";
      const res = await CREATE(post(exam(PSYCHOLOGIST)));
      expect(res.status).toBe(422);
      const ok = await CREATE(post(exam(PHYSICIAN)));
      expect(ok.status).toBe(201);
    });

    it("as opções do formulário trazem só médicos ativos", async () => {
      const options = await listMedicoOptions("org_a");
      const ids = options.map((o) => o.id);
      expect(ids).toContain(PHYSICIAN);
      expect(ids).not.toContain(PSYCHOLOGIST);
      expect(ids).not.toContain(INACTIVE_PHYSICIAN);
    });
  },
);
