import { z } from "zod";

/**
 * Disponibilização e entrega do ASO ao trabalhador (NOB-165; MED-13; NR-7 7.5.19: "o ASO deve ser
 * disponibilizado ao empregado, mediante recibo, [...] e fornecido em meio físico quando solicitado").
 *
 * Distinções que o sistema mantém (e nunca presume):
 * - **registrada:** o escritório informou a entrega (método, data e referência), sem comprovante;
 * - **comprovada:** há comprovante anexado e íntegro (recibo digitalizado ou confirmação do canal);
 * - **ciência confirmada:** só com o recibo assinado pelo trabalhador anexado. Um clique
 *   administrativo nunca vira "recebido pelo trabalhador".
 * A entrega vale para o documento assinado específico (hash). Substituído o ASO, a entrega da
 * versão anterior fica no histórico e a nova versão precisa de entrega própria.
 */

export const ASO_DELIVERY_METHODS = ["physical_copy", "digital_copy"] as const;
export const ASO_DELIVERY_EVIDENCE_KINDS = [
  "signed_receipt",
  "channel_confirmation",
] as const;
export type AsoDeliveryMethodValue = (typeof ASO_DELIVERY_METHODS)[number];
export type AsoDeliveryEvidenceKindValue = (typeof ASO_DELIVERY_EVIDENCE_KINDS)[number];

export const ASO_DELIVERY_METHOD_LABELS: Record<AsoDeliveryMethodValue, string> = {
  physical_copy: "Via física entregue ao trabalhador",
  digital_copy: "Cópia digital por canal informado",
};
export const ASO_DELIVERY_EVIDENCE_LABELS: Record<AsoDeliveryEvidenceKindValue, string> =
  {
    signed_receipt: "Recibo assinado pelo trabalhador (digitalizado)",
    channel_confirmation: "Comprovante do canal (ex.: confirmação de envio ou leitura)",
  };

export type AsoDeliveryState = "none" | "registered" | "proven" | "acknowledged";
export const ASO_DELIVERY_STATE_LABELS: Record<AsoDeliveryState, string> = {
  none: "Entrega ainda não registrada",
  registered: "Disponibilização registrada, sem comprovante",
  proven: "Disponibilização comprovada",
  acknowledged: "Recebimento confirmado por recibo assinado pelo trabalhador",
};

/** Comprovante: PDF ou imagem, até 10 MB. */
export const ASO_DELIVERY_EVIDENCE_MAX_BYTES = 10 * 1024 * 1024;
export const ASO_DELIVERY_EVIDENCE_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
] as const;
export type AsoDeliveryEvidenceType = (typeof ASO_DELIVERY_EVIDENCE_TYPES)[number];

const trimmedOptional = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo de ${max} caracteres.`)
    .optional()
    .transform((v) => (v ? v : null));

/** Data e hora local (America/Sao_Paulo, sem horário de verão desde 2019) → ISO com fuso. */
const localDateTime = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Informe data e hora.")
  .transform((v) => new Date(`${v}:00-03:00`))
  .refine((d) => !Number.isNaN(d.getTime()), "Data e hora inválidas.");

export const asoDeliveryInputSchema = z
  .object({
    kind: z.enum(["made_available", "physical_copy_requested"], {
      error: "Informe se é uma entrega ou um pedido de via física.",
    }),
    method: z.enum(ASO_DELIVERY_METHODS).optional(),
    channelDescription: trimmedOptional(300),
    occurredAt: localDateTime,
    evidenceReference: trimmedOptional(500),
    evidenceKind: z
      .enum(ASO_DELIVERY_EVIDENCE_KINDS)
      .optional()
      .or(z.literal("").transform(() => undefined)),
  })
  .superRefine((v, ctx) => {
    if (v.kind === "made_available") {
      if (!v.method)
        ctx.addIssue({
          code: "custom",
          path: ["method"],
          message: "Informe o método de entrega.",
        });
      if (!v.evidenceReference || v.evidenceReference.length < 5)
        ctx.addIssue({
          code: "custom",
          path: ["evidenceReference"],
          message: "Descreva a evidência da entrega (mínimo de 5 caracteres).",
        });
      if (
        v.method === "digital_copy" &&
        (!v.channelDescription || v.channelDescription.length < 5)
      )
        ctx.addIssue({
          code: "custom",
          path: ["channelDescription"],
          message: "Na cópia digital, informe o canal usado (mínimo de 5 caracteres).",
        });
    } else {
      if (v.method)
        ctx.addIssue({
          code: "custom",
          path: ["method"],
          message: "Pedido de via física não tem método.",
        });
      if (v.evidenceKind)
        ctx.addIssue({
          code: "custom",
          path: ["evidenceKind"],
          message: "Comprovante só acompanha uma entrega.",
        });
    }
  });

export type AsoDeliveryInput = z.output<typeof asoDeliveryInputSchema>;

export const asoDeliveryVoidSchema = z
  .object({
    reason: z
      .string()
      .trim()
      .min(10, "Explique a correção em pelo menos 10 caracteres.")
      .max(1000, "Máximo de 1.000 caracteres."),
  })
  .strict();

/** Tipo real do comprovante pelos primeiros bytes (o tipo informado pelo navegador não basta). */
export function evidenceTypeOf(bytes: Uint8Array): AsoDeliveryEvidenceType | null {
  const b = bytes;
  if (
    b.length >= 5 &&
    b[0] === 0x25 &&
    b[1] === 0x50 &&
    b[2] === 0x44 &&
    b[3] === 0x46 &&
    b[4] === 0x2d
  )
    return "application/pdf";
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff)
    return "image/jpeg";
  if (
    b.length >= 8 &&
    b[0] === 0x89 &&
    b[1] === 0x50 &&
    b[2] === 0x4e &&
    b[3] === 0x47 &&
    b[4] === 0x0d &&
    b[5] === 0x0a &&
    b[6] === 0x1a &&
    b[7] === 0x0a
  )
    return "image/png";
  return null;
}

export function checkDeliveryEvidence(
  bytes: Uint8Array,
): { ok: true; contentType: AsoDeliveryEvidenceType } | { ok: false; message: string } {
  if (bytes.byteLength === 0) return { ok: false, message: "O comprovante está vazio." };
  if (bytes.byteLength > ASO_DELIVERY_EVIDENCE_MAX_BYTES)
    return { ok: false, message: "O comprovante passa do limite de 10 MB." };
  const contentType = evidenceTypeOf(bytes);
  if (!contentType)
    return { ok: false, message: "O comprovante precisa ser PDF, JPEG ou PNG." };
  return { ok: true, contentType };
}

export const EVIDENCE_EXTENSIONS: Record<AsoDeliveryEvidenceType, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
};

/** Momento da entrega: não futuro (tolerância de 5 min) e não anterior à assinatura do ASO. */
export function occurredAtProblem(
  occurredAt: Date,
  signedOn: string,
  now: Date,
): string | null {
  if (occurredAt.getTime() > now.getTime() + 5 * 60 * 1000)
    return "A data da entrega não pode ser futura.";
  const localDate = new Date(occurredAt.getTime() - 3 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  if (localDate < signedOn) return "A entrega não pode ser anterior à assinatura do ASO.";
  return null;
}

export type AsoDeliveryEvent = {
  id: string;
  signedDocumentId: string;
  kind: "made_available" | "physical_copy_requested" | "voided";
  method: AsoDeliveryMethodValue | null;
  occurredAt: string;
  evidenceKind: AsoDeliveryEvidenceKindValue | null;
  hasEvidence: boolean;
  voidsId: string | null;
};

export type AsoDeliverySummary = {
  state: AsoDeliveryState;
  /** Há pedido de via física (não corrigido) ainda sem via física entregue depois dele. */
  physicalCopyPending: boolean;
  /** Versão anterior foi entregue, mas a vigente ainda não: substituição exige nova entrega. */
  previousVersionDelivered: boolean;
};

/** Situação da entrega do ASO vigente, a partir dos eventos (registros corrigidos não contam). */
export function summarizeDelivery(
  events: AsoDeliveryEvent[],
  currentDocumentId: string | null,
): AsoDeliverySummary {
  const voided = new Set(events.filter((e) => e.kind === "voided").map((e) => e.voidsId));
  const effective = events.filter((e) => e.kind !== "voided" && !voided.has(e.id));
  const current = effective.filter((e) => e.signedDocumentId === currentDocumentId);
  const deliveries = current.filter((e) => e.kind === "made_available");
  const state: AsoDeliveryState = deliveries.some(
    (e) => e.evidenceKind === "signed_receipt",
  )
    ? "acknowledged"
    : deliveries.some((e) => e.hasEvidence)
      ? "proven"
      : deliveries.length
        ? "registered"
        : "none";
  const requests = current.filter((e) => e.kind === "physical_copy_requested");
  const lastRequest = requests
    .map((e) => e.occurredAt)
    .sort()
    .at(-1);
  const physicalCopyPending = lastRequest
    ? !deliveries.some((e) => e.method === "physical_copy" && e.occurredAt >= lastRequest)
    : false;
  const previousVersionDelivered =
    state === "none" &&
    effective.some(
      (e) => e.kind === "made_available" && e.signedDocumentId !== currentDocumentId,
    );
  return { state, physicalCopyPending, previousVersionDelivered };
}
