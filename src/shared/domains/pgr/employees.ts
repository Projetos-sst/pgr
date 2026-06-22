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
};

export function toEmployeeListItem(row: EmployeeListItem): EmployeeListItem {
  return {
    id: row.id,
    fullName: row.fullName,
    status: row.status,
    companyName: row.companyName,
    gesName: row.gesName,
  };
}
