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

// Módulo de EPIs (modelo de dados): enums e quantidade positiva.
export const stockMovementTypeSchema = z.enum([
  "purchase",
  "employee_delivery",
  "employee_return",
  "adjustment",
  "discard",
  "employee_return",
]);
export const epiSignatureStatusSchema = z.enum([
  "pending",
  "signed_qr",
  "signed_link",
  "signed_manual",
]);
// quantity em movimentos/itens de entrega: inteiro > 0 (espelha o CHECK do banco).
export const epiQuantitySchema = z.number().int().positive();
// quantidade mínima do estoque: inteiro >= 0 (espelha o CHECK min_quantity >= 0).
export const epiMinQuantitySchema = z.number().int().min(0);

function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

/**
 * Valida o dígito verificador de CNPJ usando o algoritmo oficial (módulo 11).
 * Rejeita CNPJs com todos os dígitos iguais e aqueles com checksum incorreto.
 */
export function isValidCnpjChecksum(digits: string): boolean {
  // Deve ter exatamente 14 dígitos
  if (digits.length !== 14) return false;

  // Rejeita CNPJs com todos os dígitos iguais (ex.: 11111111111111)
  if (/^(\d)\1{13}$/.test(digits)) return false;

  // Calcula dígito verificador
  const calcCheckDigit = (base: string): number => {
    const weights =
      base.length === 12
        ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = base
      .split("")
      .reduce((acc, digit, i) => acc + Number(digit) * weights[i], 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  const base = digits.slice(0, 12);
  const d1 = calcCheckDigit(base);
  const d2 = calcCheckDigit(base + String(d1));

  return digits === base + String(d1) + String(d2);
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
  })
  .refine((digits) => isValidCnpjChecksum(digits), {
    message: "CNPJ inválido (dígito verificador incorreto)",
  });

export type CategoryType = z.infer<typeof categoryTypeSchema>;
export type EmployeeSex = z.infer<typeof employeeSexSchema>;
export type MaritalStatus = z.infer<typeof maritalStatusSchema>;
export type EmployeeStatus = z.infer<typeof employeeStatusSchema>;
export type StockMovementType = z.infer<typeof stockMovementTypeSchema>;
export type EpiSignatureStatus = z.infer<typeof epiSignatureStatusSchema>;
