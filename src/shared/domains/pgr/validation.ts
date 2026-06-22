import { z } from "zod";

export const categoryTypeSchema = z.enum(["epi", "machine"]);
export const employeeSexSchema = z.enum(["male", "female", "not_informed"]);
export const maritalStatusSchema = z.enum([
  "single",
  "married",
  "divorced",
  "widowed",
  "stable_union",
]);
export const employeeStatusSchema = z.enum(["active", "on_leave", "dismissed"]);

export const riskGradeSchema = z.number().int().min(1).max(4);
export const workerCountSchema = z.number().int().positive();

function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

export const cpfSchema = z
  .string({ error: "CPF é obrigatório" })
  .transform(onlyDigits)
  .refine((digits) => digits.length === 11, {
    message: "CPF deve ter 11 dígitos",
  });

export const cnpjSchema = z
  .string({ error: "CNPJ inválido" })
  .transform(onlyDigits)
  .refine((digits) => digits.length === 14, {
    message: "CNPJ deve ter 14 dígitos",
  });

export type CategoryType = z.infer<typeof categoryTypeSchema>;
export type EmployeeSex = z.infer<typeof employeeSexSchema>;
export type MaritalStatus = z.infer<typeof maritalStatusSchema>;
export type EmployeeStatus = z.infer<typeof employeeStatusSchema>;
