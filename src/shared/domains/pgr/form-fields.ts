import { z } from "zod";

export const optionalString = z
  .string()
  .trim()
  .transform((value) => (value === "" ? undefined : value))
  .optional();

export function requiredString(message: string) {
  return z.string({ error: message }).trim().min(1, message);
}

const UUID_FORMAT =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export function requiredUuid(message: string) {
  return z.string({ error: message }).regex(UUID_FORMAT, message);
}

export const optionalUuid = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().regex(UUID_FORMAT).optional(),
);

// Data ISO (AAAA-MM-DD) opcional: string vazia → undefined; senão valida calendário
// (z.iso.date rejeita datas impossíveis como 2026-13-45). Para colunas `date` nullable.
export const optionalIsoDate = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.iso.date("Data inválida (use AAAA-MM-DD)").optional(),
);
