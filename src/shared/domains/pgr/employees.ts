import { z } from "zod";

import {
  optionalString,
  requiredString,
  requiredUuid,
  optionalUuid,
} from "./form-fields";

export type { Employee } from "@/shared/db/schema/employees";
import {
  cpfSchema,
  employeeSexSchema,
  employeeStatusSchema,
  maritalStatusSchema,
} from "./validation";

function optionalEnum<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    schema.optional(),
  );
}

export const employeeInputSchema = z.object({
  companyId: requiredUuid("Empresa é obrigatória"),
  fullName: requiredString("Nome completo é obrigatório"),
  cpf: cpfSchema,
  gesId: optionalUuid,
  jobRoleId: optionalUuid,
  birthDate: optionalString,
  sex: optionalEnum(employeeSexSchema),
  maritalStatus: optionalEnum(maritalStatusSchema),
  status: optionalEnum(employeeStatusSchema),
  phone: optionalString,
  email: optionalString,
  rg: optionalString,
  badgeNumber: optionalString,
  badgeValidUntil: optionalString,
  registration: optionalString,
  bloodType: optionalString,
  admissionDate: optionalString,
  dismissalDate: optionalString,
  zipCode: optionalString,
  street: optionalString,
  number: optionalString,
  complement: optionalString,
  district: optionalString,
  city: optionalString,
  state: optionalString,
  photoPath: optionalString,
});

export type EmployeeInput = z.input<typeof employeeInputSchema>;
export type EmployeeValues = z.output<typeof employeeInputSchema>;

export type EmployeeListItem = {
  id: string;
  fullName: string;
  status: string;
  companyName: string;
  gesName: string | null;
  /** Função (subtítulo do Nome no #195) — join `job_roles.title`. */
  jobRoleTitle: string | null;
  /** Nº de OS emitidas para o funcionário — derivado (COUNT), sem coluna. */
  serviceOrderCount: number;
};

export function toEmployeeListItem(row: EmployeeListItem): EmployeeListItem {
  return {
    id: row.id,
    fullName: row.fullName,
    status: row.status,
    companyName: row.companyName,
    gesName: row.gesName,
    jobRoleTitle: row.jobRoleTitle,
    serviceOrderCount: row.serviceOrderCount,
  };
}

/**
 * Aplica máscara de digitação progressiva ao CPF.
 * Remove tudo que não for dígito, trunca para 11 dígitos máximo,
 * e aplica a máscara 000.000.000-00 conforme a quantidade de dígitos.
 * Funciona com qualquer quantidade de dígitos de 0 a 11 (idempotente).
 */
export function maskCpfInput(value: string): string {
  // Remove tudo que não for dígito
  const digits = value.replace(/\D/g, "");

  // Trunca para máximo 11 dígitos
  if (digits.length === 0) return "";
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9)
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  // 10 ou 11 dígitos
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
}
