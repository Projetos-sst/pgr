import { z } from "zod";

import { requiredUuid } from "./form-fields";
import { epiQuantitySchema, type EpiSignatureStatus } from "./validation";

// Data da entrega no formato ISO `YYYY-MM-DD` (coluna `date`, sem hora).
const deliveryDateSchema = z
  .string({ error: "Data da entrega é obrigatória" })
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida (use AAAA-MM-DD)");

// quantity sempre > 0 (coerce de string do form); espelha o CHECK do banco.
const deliveryItemSchema = z.object({
  stockId: requiredUuid("Item de estoque é obrigatório"),
  quantity: z.coerce
    .number({ error: "Quantidade é obrigatória" })
    .pipe(epiQuantitySchema),
});

/**
 * Criação de entrega (R8): a UI seleciona itens da lista de estoque com saldo,
 * então o input carrega `stockId`; o `catalogId` é derivado da linha travada no
 * repositório. A recusa por saldo insuficiente é da transação, não daqui.
 */
export const createDeliverySchema = z.object({
  employeeId: requiredUuid("Funcionário é obrigatório"),
  deliveryDate: deliveryDateSchema,
  items: z.array(deliveryItemSchema).min(1, "Selecione ao menos um item"),
});

export type CreateDeliveryInput = z.input<typeof createDeliverySchema>;
export type CreateDeliveryValues = z.output<typeof createDeliverySchema>;

/** Assinatura manual não tem payload (o id da entrega vem da rota/argumento). */
export const signManualSchema = z.object({});

/** Devolução de item (US4): só o item; a entrega vem da rota/argumento. */
export const returnSchema = z.object({
  itemId: requiredUuid("Item da entrega é obrigatório"),
});

export type ReturnInput = z.input<typeof returnSchema>;

/**
 * Guard de devolução: one-shot — `returned_at IS NULL` = em uso (pode devolver);
 * preenchido → `ALREADY_RETURNED`. Independe do status de assinatura.
 */
export function canReturn(returnedAt: Date | null): boolean {
  return returnedAt === null;
}

/**
 * Máquina de estados da assinatura: transição só a partir de `pending`; qualquer
 * `signed_*` é terminal (one-shot — reassinar → `ALREADY_SIGNED`).
 */
export function canSign(status: EpiSignatureStatus): boolean {
  return status === "pending";
}

/** Rótulos pt-BR do status de assinatura (enum em inglês no banco → UI em pt-BR). */
const SIGNATURE_LABELS: Record<EpiSignatureStatus, string> = {
  pending: "Pendente de assinatura",
  signed_qr: "Assinada (QR Code)",
  signed_link: "Assinada (link)",
  signed_manual: "Assinada (manual)",
};

export function signatureStatusLabel(status: EpiSignatureStatus): string {
  return SIGNATURE_LABELS[status];
}

/** Linha da listagem de entregas (join com funcionário + contagem de itens). */
export type DeliveryRow = {
  id: string;
  employeeId: string;
  employeeName: string;
  deliveryDate: string;
  signatureStatus: EpiSignatureStatus;
  signatureLabel: string;
  itemCount: number;
};

export type DeliveryDetailItem = {
  id: string;
  catalogId: string;
  name: string;
  ca: string | null;
  size: string | null;
  unitOfMeasure: string | null;
  quantity: number;
  returnedAt: Date | null;
};

/**
 * Detalhe da entrega. `signedAt` é o `updated_at` da transição de assinatura —
 * timestamp legal válido porque a linha não sofre outro UPDATE após `signed_*`
 * (sem PUT, delete barrado, devolução escreve só em `epi_delivery_items`).
 */
export type DeliveryDetail = {
  id: string;
  employeeId: string;
  employeeName: string;
  deliveryDate: string;
  signatureStatus: EpiSignatureStatus;
  signatureLabel: string;
  signedAt: Date | null;
  items: DeliveryDetailItem[];
};

export type DeliveryListFilters = { employeeId?: string; search?: string };

/** Retorno da criação: id + saldo novo por item (a UI mostra a baixa aplicada). */
export type CreateDeliveryResult = {
  id: string;
  signatureStatus: EpiSignatureStatus;
  items: {
    stockId: string;
    catalogId: string;
    quantity: number;
    newBalance: number;
  }[];
};
