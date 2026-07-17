import { z } from "zod";

import {
  MAX_ITEM_DESCRIPTION,
  MAX_ITEMS_PER_ORDER,
} from "@/shared/domains/safety/service-order";

/**
 * Payload público do consumidor `target_type: 'service_order'` (fase 06 / US3). É o **snapshot
 * mínimo** exibido ao trabalhador na rota pública — congelado na criação da solicitação (mudanças
 * posteriores na OS, no funcionário, na empresa, no risco ou no EPI não o alteram). Server-safe
 * (sem React): validado pelo core genérico via registry.
 *
 * **Estrito de propósito**: é a superfície inteira de exposição pública, então **NÃO** admite
 * nenhum campo além dos seis abaixo — nada de `orgId`/`serviceOrderId`/`employeeId`/`companyId`/
 * `sourceId`/`sourceType`/CPF/RG/dados médicos/dados de risco completos/token/hash. O item público
 * carrega apenas o texto do checklist: a procedência (`source_type`/`source_id`) fica no banco, não
 * na tela pública. Datas como `AAAA-MM-DD` (coluna `date`).
 */
export const serviceOrderSignatureItemSchema = z
  .object({
    description: z.string().trim().min(1).max(MAX_ITEM_DESCRIPTION),
  })
  .strict();

export const serviceOrderSignaturePayloadSchema = z
  .object({
    documentTitle: z.string().trim().min(1).max(200),
    serviceOrderNumber: z.number().int().positive(),
    companyName: z.string().trim().min(1).max(200),
    employeeName: z.string().trim().min(1).max(200),
    issuedAt: z.iso.date(),
    items: z.array(serviceOrderSignatureItemSchema).min(1).max(MAX_ITEMS_PER_ORDER),
  })
  .strict();

export type ServiceOrderSignatureItem = z.infer<typeof serviceOrderSignatureItemSchema>;
export type ServiceOrderSignaturePayload = z.infer<
  typeof serviceOrderSignaturePayloadSchema
>;
