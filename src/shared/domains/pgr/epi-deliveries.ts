import { z } from "zod";

import { requiredUuid } from "./form-fields";
import { epiQuantitySchema, type EpiSignatureStatus } from "./validation";

export type { EpiDelivery, EpiDeliveryItem } from "@/shared/db/schema/epis";
export type { EpiSignatureStatus } from "./validation";

// Data da entrega no formato ISO `YYYY-MM-DD` (coluna `date`, sem hora). O movimento
// de baixa (`employee_delivery`) herda esta data como `movement_date`.
const deliveryDateSchema = z
  .string({ error: "Data da entrega é obrigatória" })
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida (use AAAA-MM-DD)");

// Item da entrega: `stockId` é a linha de `epi_stock` selecionada (a baixa é sobre ela);
// o item gravado guarda o `catalog_id` resolvido. `quantity` sempre inteiro > 0.
const deliveryItemSchema = z.object({
  stockId: requiredUuid("Item de estoque é obrigatório"),
  quantity: z.coerce.number({ error: "Quantidade é obrigatória" }).pipe(epiQuantitySchema),
});

/**
 * Criação de entrega: funcionário + data + itens (não vazio, sem `stockId` duplicado).
 * A disponibilidade (`balance >= quantity`) é validada no repositório; aqui só a forma.
 */
export const deliveryCreateSchema = z.object({
  employeeId: requiredUuid("Funcionário é obrigatório"),
  deliveryDate: deliveryDateSchema,
  items: z
    .array(deliveryItemSchema)
    .min(1, "Selecione ao menos um item para entregar")
    .refine(
      (items) => new Set(items.map((i) => i.stockId)).size === items.length,
      { message: "Há item de estoque repetido na entrega" },
    ),
});

export type DeliveryCreateInput = z.input<typeof deliveryCreateSchema>;
export type DeliveryCreateValues = z.output<typeof deliveryCreateSchema>;
export type DeliveryItemValues = z.output<typeof deliveryItemSchema>;

// Métodos de assinatura da rota PÚBLICA (QR / link). `manual` é uma action interna
// dedicada (gestor assina presencialmente), fora deste enum.
export const SIGN_METHODS = ["qr", "link"] as const;
export const signMethodSchema = z.enum(SIGN_METHODS, {
  error: "Método de assinatura inválido",
});
export type SignMethod = (typeof SIGN_METHODS)[number];

/** Janela fixa de expiração do token, ancorada em `created_at` (FR-017). */
export const TOKEN_EXPIRY_HOURS = 72;

/**
 * Gera o token de capacidade da rota pública: 256 bits de entropia (32 bytes) em hex,
 * via Web Crypto (isomórfico — funciona no runtime Node do Next e no Edge). Uso único +
 * único global por índice parcial (008).
 */
export function generateAuthToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Token expirado? Derivado de `created_at + janela`, sem coluna (FR-017). Expira quando
 * `created_at + window < now` — no instante exato do limite ainda é válido. Função pura,
 * testável (recebe `now` explícito).
 */
export function isTokenExpired(
  createdAt: Date,
  now: Date,
  windowHours: number = TOKEN_EXPIRY_HOURS,
): boolean {
  const expiresAt = createdAt.getTime() + windowHours * 60 * 60 * 1000;
  return now.getTime() > expiresAt;
}

/** Status resultante da confirmação pela rota pública (QR → `signed_qr`; link → `signed_link`). */
export function nextSignatureStatus(method: SignMethod): EpiSignatureStatus {
  return method === "qr" ? "signed_qr" : "signed_link";
}

/**
 * Efeito de um item entregue no saldo: sempre subtrai (a baixa é uma saída
 * `employee_delivery`; `quantity` é positivo, o sinal vem do tipo). Espelha
 * `signedQuantity('employee_delivery', q)` da fatia 010.
 */
export function signedQuantityForDelivery(quantity: number): number {
  return -quantity;
}

/** Rótulos pt-BR do status de assinatura (enum em inglês no banco → UI em pt-BR). */
const SIGNATURE_STATUS_LABELS: Record<EpiSignatureStatus, string> = {
  pending: "Aguardando assinatura",
  signed_qr: "Assinada (QR Code)",
  signed_link: "Assinada (link)",
  signed_manual: "Assinada (manual)",
};

export function signatureStatusLabel(status: EpiSignatureStatus): string {
  return SIGNATURE_STATUS_LABELS[status];
}

/** Está pendente (ainda pode ser assinada)? */
export function isPending(status: EpiSignatureStatus): boolean {
  return status === "pending";
}

/**
 * "Enviar Link" só está disponível se o funcionário tem algum contato (e-mail ou
 * telefone). Sem contato, a UI orienta completar o cadastro (FR-018/US3). No MVP o link
 * é apenas gerado/exibido — sem disparo real.
 */
export function canSendLink(employee: {
  email?: string | null;
  phone?: string | null;
}): boolean {
  return Boolean(employee.email?.trim() || employee.phone?.trim());
}

// ---- DTOs (vocabulário pt-BR / forma do retorno) ----

/** Retorno da criação: id da entrega + token de capacidade da rota pública. */
export type CreatedDelivery = { deliveryId: string; authToken: string };

/** Item exibido na visualização da entrega (catálogo + quantidade). */
export type DeliveryItemView = {
  catalogId: string;
  name: string;
  ca: string | null;
  quantity: number;
};

/** Detalhe da entrega (cabeçalho + itens) para a visualização interna. */
export type DeliveryDetail = {
  id: string;
  employeeId: string;
  employeeName: string;
  deliveryDate: string;
  signatureStatus: EpiSignatureStatus;
  signatureStatusLabel: string;
  items: DeliveryItemView[];
};

/** Leitura leve para o polling do painel "Aguardando confirmação…". */
export type DeliveryStatus = {
  signatureStatus: EpiSignatureStatus;
  signatureStatusLabel: string;
};

/** Saldo novo de um item após a baixa. */
export type NewBalance = {
  stockId: string;
  catalogId: string;
  name: string;
  balance: number;
};

/** Aviso (não bloqueante) de item que ficou abaixo da quantidade mínima após a baixa. */
export type LowStockWarning = {
  stockId: string;
  name: string;
  balance: number;
  minQuantity: number;
};

/** Retorno das confirmações (manual/pública): entrega assinada + saldos novos + avisos. */
export type DeliveryResult = {
  delivery: { id: string; signatureStatus: EpiSignatureStatus };
  newBalances: NewBalance[];
  lowStockWarnings: LowStockWarning[];
};
