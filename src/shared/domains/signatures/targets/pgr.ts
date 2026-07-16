import { z } from "zod";

/**
 * Payload público do consumidor `target_type: 'pgr'` (fatia 022). É o **snapshot mínimo**
 * exibido ao signatário na rota pública — congelado na criação da solicitação. Server-safe
 * (sem React): validado pela Server Action/core.
 *
 * **Estrito de propósito**: é a superfície inteira de exposição pública, então **NÃO** admite
 * nenhum campo além dos sete abaixo — nada de `orgId`/`pgrId`/ids de GES-risco/`employees`/CPF/
 * e-mail/telefone/matrícula/listas de riscos-medidas-EPIs/plano/token. `documentTitle` é composto
 * no servidor (não existe coluna de título no `pgr`). Datas como `AAAA-MM-DD` (colunas `date`).
 */
export const pgrSignaturePayloadSchema = z
  .object({
    documentTitle: z.string().trim().min(1).max(200),
    companyName: z.string().trim().min(1).max(200),
    workUnitName: z.string().trim().max(200).nullable(),
    responsibleName: z.string().trim().max(200).nullable(),
    issuedAt: z.iso.date().nullable(),
    validUntil: z.iso.date().nullable(),
    revisionNumber: z.number().int().min(1).nullable(),
  })
  .strict();

export type PgrSignaturePayload = z.infer<typeof pgrSignaturePayloadSchema>;
