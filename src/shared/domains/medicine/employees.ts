import { z } from "zod";

import type { ExamAptitude, ExamType } from "@/shared/domains/pgr/health-exams";
import { optionalString, requiredUuid } from "@/shared/domains/pgr/form-fields";
import { PAGE_SIZE_MAX } from "@/shared/pagination";

/**
 * Lista de funcionários do painel da Medicina, sempre de UMA empresa. `companyId`
 * é só filtro: o tenant vem da sessão e o servidor confirma que a empresa é do
 * tenant (`NOT_FOUND`) e tem Medicina habilitada (`FORBIDDEN`).
 */
export const medicineEmployeesQuerySchema = z.object({
  companyId: requiredUuid("Selecione uma empresa"),
  search: optionalString,
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(PAGE_SIZE_MAX).optional(),
});

export type MedicineEmployeesQuery = z.input<typeof medicineEmployeesQuerySchema>;

/** Exame mais recente do funcionário — sem `notes` nem `certificatePath`. */
export type LatestExam = {
  examType: ExamType;
  performedAt: string;
  validUntil: string | null;
  aptitude: ExamAptitude;
};

/** Linha da lista do painel — sem CPF, sem `notes`, sem nome da empresa. */
export type MedicineEmployeeItem = {
  id: string;
  fullName: string;
  status: string;
  jobRoleTitle: string | null;
  gesName: string | null;
  latestExam: LatestExam | null;
};
