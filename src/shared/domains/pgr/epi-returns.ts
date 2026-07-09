import { z } from "zod";

import { requiredUuid } from "./form-fields";

/** Saldo novo de um item de estoque após a reposição da devolução. */
export type NewBalance = {
  stockId: string;
  catalogId: string;
  name: string;
  balance: number;
};

// Data da devolução `YYYY-MM-DD` (coluna usada como `movement_date` do retorno).
const returnDateSchema = z
  .string({ error: "Data da devolução é obrigatória" })
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida (use AAAA-MM-DD)");

/**
 * Registro de devolução de itens de UMA entrega (granularidade por item, devolução
 * total do item): `deliveryId` + `itemIds` (não vazio, sem repetidos) + `returnDate`.
 * A regra `returnDate >= deliveryDate` e "só entrega assinada" é validada no repositório
 * (depende de dados do banco).
 */
export const returnCreateSchema = z.object({
  deliveryId: requiredUuid("Entrega é obrigatória"),
  returnDate: returnDateSchema,
  itemIds: z
    .array(requiredUuid("Item inválido"))
    .min(1, "Selecione ao menos um item para devolver")
    .refine((ids) => new Set(ids).size === ids.length, {
      message: "Há item repetido na devolução",
    }),
});

export type ReturnCreateInput = z.input<typeof returnCreateSchema>;
export type ReturnCreateValues = z.output<typeof returnCreateSchema>;

/**
 * A data de devolução não pode ser anterior à data de entrega. Datas ISO `YYYY-MM-DD`
 * comparam corretamente por ordem lexicográfica. Função pura, testável.
 */
export function isReturnDateBeforeDelivery(
  returnDate: string,
  deliveryDate: string,
): boolean {
  return returnDate < deliveryDate;
}

/** Item pendente de devolução (listagem `returned_at IS NULL`). */
export type PendingReturnItem = {
  itemId: string;
  deliveryId: string;
  deliveryDate: string;
  employeeId: string;
  employeeName: string;
  catalogId: string;
  name: string;
  ca: string | null;
  quantity: number;
};

/** Retorno do registro de devolução: itens devolvidos + saldos repostos. */
export type ReturnResult = {
  deliveryId: string;
  returnedItemIds: string[];
  newBalances: NewBalance[];
};
