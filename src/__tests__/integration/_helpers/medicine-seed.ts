import type postgres from "postgres";

import { PGR_IDS } from "./pgr-seed";

/**
 * Fixtures da Medicina Ocupacional (Lote 01 / NOB-108) — SOMENTE dados fictícios.
 * Chamar DEPOIS de `seedPgrBase` (que já deixa `companyA`/`companyB` com PGR e
 * Medicina ligados). Acrescenta em `org_a`:
 *   - `companyA2`: Medicina LIGADA, PGR DESLIGADO; funcionário `employeeA2`.
 *   - `companyA3`: Medicina DESLIGADA, PGR ligado; funcionário `employeeA3`.
 *   - dois médicos fictícios.
 *   - exames: `employeeA` (um antigo vencido + um recente vigente), `employeeA2`
 *     (sem validade informada), `employeeA3` (inserido como admin, invisível para o
 *     runtime porque a empresa não tem Medicina).
 * Em `org_b`: um exame de `employeeB`.
 * Todo exame leva `notes`/`certificate_path` com marcadores para provar que nenhum
 * contrato novo os devolve.
 */
export const MEDICINE_IDS = {
  companyA2: "11111111-1111-1111-1111-1111111111f1",
  companyA3: "11111111-1111-1111-1111-1111111111f2",
  employeeA2: "11111111-1111-1111-1111-1111111111f3",
  employeeA3: "11111111-1111-1111-1111-1111111111f4",
  doctorA1: "11111111-1111-1111-1111-1111111111f5",
  doctorA2: "11111111-1111-1111-1111-1111111111f6",
  examAOld: "11111111-1111-1111-1111-1111111111f7",
  examARecent: "11111111-1111-1111-1111-1111111111f8",
  examA2: "11111111-1111-1111-1111-1111111111f9",
  examA3: "11111111-1111-1111-1111-1111111111fa",
  examB: "22222222-2222-2222-2222-2222222222f1",
} as const;

/** Marcadores gravados em `notes`/`certificate_path`; nunca podem aparecer em payload. */
export const SENSITIVE_MARKERS = {
  notes: "EXEMPLO-NOTA-CLINICA-SIGILOSA",
  certificatePath: "exemplo/aso-sigiloso.pdf",
} as const;

/** Validade "vigente" estável no tempo (fora de qualquer janela de 30 dias). */
export const FAR_FUTURE = "2099-12-31";

const I = PGR_IDS;
const M = MEDICINE_IDS;
const N = SENSITIVE_MARKERS;

export async function seedMedicine(admin: ReturnType<typeof postgres>): Promise<void> {
  await admin.unsafe(`
    insert into public.companies (id, org_id, razao_social) values
      ('${M.companyA2}','org_a','EXEMPLO Empresa A2'),
      ('${M.companyA3}','org_a','EXEMPLO Empresa A3');

    insert into public.company_modules (org_id, company_id, module, enabled) values
      ('org_a','${M.companyA2}','medicine',true),
      ('org_a','${M.companyA2}','pgr',false),
      ('org_a','${M.companyA3}','medicine',false),
      ('org_a','${M.companyA3}','pgr',true);

    -- CPFs claramente fictícios (o schema não valida dígito; só UNIQUE por org).
    insert into public.employees (id, org_id, company_id, full_name, cpf, created_at) values
      ('${M.employeeA2}','org_a','${M.companyA2}','EXEMPLO Funcionário A2','00000000002', now() - interval '2 days'),
      ('${M.employeeA3}','org_a','${M.companyA3}','EXEMPLO Funcionário A3','00000000003', now() - interval '2 days');

    insert into public.medicos (id, org_id, name, crm) values
      ('${M.doctorA1}','org_a','EXEMPLO Dra. Médica 1','CRM-EX 0001/XX'),
      ('${M.doctorA2}','org_a','EXEMPLO Dr. Médico 2','CRM-EX 0002/XX');

    insert into public.health_exams
      (id, org_id, employee_id, doctor_id, exam_type, performed_at, valid_until, aptitude, notes, certificate_path) values
      ('${M.examAOld}','org_a','${I.employeeA}','${M.doctorA1}','admissional','2024-01-10','2025-01-10','fit','${N.notes}','${N.certificatePath}'),
      ('${M.examARecent}','org_a','${I.employeeA}','${M.doctorA2}','periodic','2026-01-10','${FAR_FUTURE}','fit_with_restrictions','${N.notes}','${N.certificatePath}'),
      ('${M.examA2}','org_a','${M.employeeA2}',null,'admissional','2026-02-10',null,'fit','${N.notes}','${N.certificatePath}'),
      ('${M.examA3}','org_a','${M.employeeA3}',null,'admissional','2026-03-10','${FAR_FUTURE}','fit','${N.notes}','${N.certificatePath}'),
      ('${M.examB}','org_b','${I.employeeB}',null,'periodic','2026-01-20','${FAR_FUTURE}','unfit','${N.notes}','${N.certificatePath}');
  `);
}

/**
 * Lote 02A (NOB-112): exame LEGADO de `employeeA2` com vencimento anterior à
 * realização, inserido como admin (o banco não tem CHECK; a regra é da
 * aplicação). Prova que a edição exige corrigir as datas e que nada é alterado
 * automaticamente. Separado de `seedMedicine` para não mudar as contagens do Lote 01.
 */
export const LOTE02A_IDS = {
  examA2LegacyInvalidDates: "11111111-1111-1111-1111-1111111111fb",
} as const;

export async function seedLegacyInvalidDateExam(
  admin: ReturnType<typeof postgres>,
): Promise<void> {
  await admin.unsafe(`
    insert into public.health_exams
      (id, org_id, employee_id, doctor_id, exam_type, performed_at, valid_until, aptitude, notes, certificate_path) values
      ('${LOTE02A_IDS.examA2LegacyInvalidDates}','org_a','${M.employeeA2}',null,'periodic','2026-03-10','2026-03-01','fit','${N.notes}','${N.certificatePath}');
  `);
}

/** Garante que nenhum campo sensível (chave ou valor-marcador) aparece no payload. */
export function expectNoSensitiveFields(payload: unknown): void {
  const json = JSON.stringify(payload);
  expect(json).not.toMatch(/"notes"\s*:/);
  expect(json).not.toMatch(/"certificatePath"\s*:/);
  expect(json).not.toMatch(/"cpf"\s*:/);
  expect(json).not.toContain(N.notes);
  expect(json).not.toContain(N.certificatePath);
}

/** "Hoje" + n dias no fuso de São Paulo (mesma base do `todayInSaoPaulo`). */
export function saoPauloDatePlus(days: number, today: string): string {
  const [y, m, d] = today.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}
