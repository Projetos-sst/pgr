import { z } from "zod";

import type { EpiSignatureStatus } from "./validation";

// Data ISO `YYYY-MM-DD` (mesmo formato das colunas `date`).
const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida");

/** Filtro de status da ficha (vocabulário pt-BR da UI, não o enum do banco). */
export const EPI_RECORD_STATUSES = ["pendente", "devolvido", "todos"] as const;
export type EpiRecordStatus = (typeof EPI_RECORD_STATUSES)[number];

/**
 * Query da ficha de EPI (US5): `status` mapeia para `returned_at`
 * (`pendente` ⇒ NULL, `devolvido` ⇒ NOT NULL, `todos` ⇒ sem filtro); período
 * filtra `delivery_date BETWEEN from AND to` (ambos opcionais).
 */
export const epiRecordQuerySchema = z.object({
  status: z.enum(EPI_RECORD_STATUSES).default("todos"),
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
});

export type EpiRecordQueryInput = z.input<typeof epiRecordQuerySchema>;
export type EpiRecordQuery = z.output<typeof epiRecordQuerySchema>;

/**
 * Mapeamento status → filtro de `returned_at`: `true` = exige devolvido,
 * `false` = exige em uso, `null` = sem filtro. Função pura testável que o
 * repositório traduz para SQL.
 */
export function returnedFilterFor(status: EpiRecordStatus): boolean | null {
  if (status === "pendente") return false;
  if (status === "devolvido") return true;
  return null;
}

/** Linha da ficha (join entregas × itens × catálogo — read model, sem tabela nova). */
export type EpiRecordRow = {
  itemId: string;
  deliveryId: string;
  ca: string | null;
  epiName: string;
  size: string | null;
  quantity: number;
  deliveryDate: string;
  returnedAt: Date | null;
  signatureStatus: EpiSignatureStatus;
  signatureLabel: string;
};
