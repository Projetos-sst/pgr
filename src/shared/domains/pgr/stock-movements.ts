import { z } from "zod";

import type { StockMovement } from "@/shared/db/schema/epis";

import { requiredUuid, optionalString } from "./form-fields";
import { epiQuantitySchema, type StockMovementType } from "./validation";

export type { StockMovement } from "@/shared/db/schema/epis";

// Data do movimento no formato ISO `YYYY-MM-DD` (coluna `date`, sem hora).
const movementDateSchema = z
  .string({ error: "Data do movimento é obrigatória" })
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida (use AAAA-MM-DD)");

// quantity sempre > 0 (coerce de string do form); o sinal vem do `type`.
const quantitySchema = z.coerce
  .number({ error: "Quantidade é obrigatória" })
  .pipe(epiQuantitySchema);

/**
 * Entrada (compra): incrementa o saldo. `type` é sempre `purchase` (implícito);
 * `invoiceNumber` é opcional (Nº da nota fiscal).
 */
export const stockEntrySchema = z.object({
  stockId: requiredUuid("Item de estoque é obrigatório"),
  quantity: quantitySchema,
  movementDate: movementDateSchema,
  invoiceNumber: optionalString,
  // Lote de rastreabilidade (issue #23) — opcional, mesmo padrão de `invoiceNumber`.
  batch: optionalString,
});

export type StockEntryInput = z.input<typeof stockEntrySchema>;
export type StockEntryValues = z.output<typeof stockEntrySchema>;

// Tipos de saída manual aceitos (sem ajuste bidirecional; sem `employee_delivery`, que é #19).
export const STOCK_EXIT_TYPES = ["adjustment", "discard"] as const;
export const stockExitTypeSchema = z.enum(STOCK_EXIT_TYPES, {
  error: "Tipo de saída inválido",
});
export type StockExitType = (typeof STOCK_EXIT_TYPES)[number];

/**
 * Saída manual: decrementa o saldo. `type` ∈ {adjustment, discard}. A recusa por
 * saldo insuficiente é feita na camada de repositório (transação), não aqui.
 */
export const stockExitSchema = z.object({
  stockId: requiredUuid("Item de estoque é obrigatório"),
  quantity: quantitySchema,
  movementDate: movementDateSchema,
  type: stockExitTypeSchema,
});

export type StockExitInput = z.input<typeof stockExitSchema>;
export type StockExitValues = z.output<typeof stockExitSchema>;

/** Rótulos pt-BR dos tipos de movimento (enum em inglês no banco → UI em pt-BR). */
const TYPE_LABELS: Record<StockMovementType, string> = {
  purchase: "Entrada (compra)",
  employee_delivery: "Entrega a funcionário",
  adjustment: "Ajuste",
  discard: "Descarte",
  employee_return: "Devolução de funcionário",
};

export function stockMovementTypeLabel(type: StockMovementType): string {
  return TYPE_LABELS[type];
}

// Tipos que SOMAM ao saldo; os demais (entrega/ajuste/descarte) subtraem.
const ENTRY_TYPES: ReadonlySet<StockMovementType> = new Set([
  "purchase",
  "employee_return",
]);

/**
 * Efeito do movimento no saldo. `quantity` é sempre positivo — o sinal vem
 * exclusivamente do `type`.
 */
export function signedQuantity(type: StockMovementType, quantity: number): number {
  return ENTRY_TYPES.has(type) ? quantity : -quantity;
}

/** Movimento mínimo para o cálculo do saldo acumulado (ordem cronológica ascendente). */
export type RunningBalanceInput = { type: StockMovementType; quantity: number };

/**
 * Saldo resultante acumulado por linha — função pura que espelha a window function do
 * repositório (D3). Recebe os movimentos em ordem cronológica **ascendente** e devolve,
 * para cada um, o saldo após aplicá-lo. Sem coluna `balance_after` no banco.
 */
export function computeRunningBalance(movements: RunningBalanceInput[]): number[] {
  let running = 0;
  return movements.map((m) => {
    running += signedQuantity(m.type, m.quantity);
    return running;
  });
}

/** Linha do histórico exibida na UI/REST (vocabulário pt-BR + saldo derivado). */
export type StockMovementRow = {
  id: string;
  type: StockMovementType;
  typeLabel: string;
  quantity: number;
  signedQuantity: number;
  movementDate: string;
  invoiceNumber: string | null;
  batch: string | null;
  employeeName: string | null;
  runningBalance: number;
  createdAt: Date;
};

/** Retorno das escritas (entrada/saída): o movimento gravado + o saldo materializado novo. */
export type StockMovementResult = { movement: StockMovement; newBalance: number };
