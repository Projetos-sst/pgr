import { z } from "zod";

import { requiredUuid } from "./form-fields";
import { epiMinQuantitySchema } from "./validation";

export type { EpiStock } from "@/shared/db/schema/epis";

/**
 * Status DERIVADO do estoque (sem coluna, sem trigger): comparação entre o saldo
 * atual (`balance`, somente leitura — alterado só por movimentações/#72) e a
 * quantidade mínima (`min_quantity`). Mínima 0 nunca gera alerta.
 */
export const EPI_STOCK_STATUSES = ["sem_saldo", "abaixo_minima", "acima_minima"] as const;
export const epiStockStatusSchema = z.enum(EPI_STOCK_STATUSES);
export type EpiStockStatus = (typeof EPI_STOCK_STATUSES)[number];

/** Função pura espelhada pelo CASE do SQL (ver repositório). `balance` é >= 0 (CHECK). */
export function deriveStockStatus(balance: number, minQuantity: number): EpiStockStatus {
  if (balance <= 0) return "sem_saldo";
  if (balance < minQuantity) return "abaixo_minima";
  return "acima_minima";
}

// Criar: associa um item do catálogo ao estoque e define a mínima. `balance` NUNCA entra
// aqui — é sempre derivado de `stock_movements` (ver `createEpiStock`). `initialQuantity`
// é só um atalho de UX: quando informado e > 0, o repositório lança uma movimentação
// `purchase` (via `applyStockEntry`) na mesma transação, preservando a trilha de auditoria.
export const epiStockCreateSchema = z.object({
  catalogId: requiredUuid("Item do catálogo é obrigatório"),
  minimumQuantity: z.coerce
    .number({ error: "Quantidade mínima é obrigatória" })
    .pipe(epiMinQuantitySchema),
  initialQuantity: z.coerce.number().pipe(epiMinQuantitySchema).optional(),
});

export type EpiStockCreateInput = z.input<typeof epiStockCreateSchema>;
export type EpiStockCreateValues = z.output<typeof epiStockCreateSchema>;

// Atualizar: edita APENAS a mínima (catalog_id é fixo; balance é somente leitura).
export const epiStockUpdateSchema = z.object({
  minimumQuantity: z.coerce
    .number({ error: "Quantidade mínima é obrigatória" })
    .pipe(epiMinQuantitySchema),
});

export type EpiStockUpdateInput = z.input<typeof epiStockUpdateSchema>;
export type EpiStockUpdateValues = z.output<typeof epiStockUpdateSchema>;

/**
 * Linha da listagem (vocabulário ePGR no DTO: `currentBalance`/`minimumQuantity`),
 * mapeada das colunas reais `balance`/`min_quantity` da fatia 008. Sem "Empresa":
 * `epi_catalog` não tem vínculo com empresa no modelo atual (ver briefing §3.1).
 */
export type EpiStockListItem = {
  id: string;
  catalogId: string;
  name: string;
  ca: string | null;
  size: string | null;
  unitOfMeasure: string | null;
  minimumQuantity: number;
  currentBalance: number;
  status: EpiStockStatus;
};

export type EpiStockDetail = EpiStockListItem & {
  type: "epi" | "machine";
  categoryId: string;
};

/** Opção do seletor de "Criar" — itens do catálogo ainda sem registro de estoque. */
export type EpiCatalogOption = {
  catalogId: string;
  name: string;
  ca: string | null;
};

export type EpiStockListFilters = {
  search?: string;
  withBalanceOnly?: boolean;
  status?: EpiStockStatus;
};

type EpiStockRow = {
  id: string;
  catalogId: string;
  name: string;
  ca: string | null;
  size: string | null;
  unitOfMeasure: string | null;
  minimumQuantity: number;
  currentBalance: number;
};

export function toEpiStockListItem(row: EpiStockRow): EpiStockListItem {
  return {
    ...row,
    status: deriveStockStatus(row.currentBalance, row.minimumQuantity),
  };
}
