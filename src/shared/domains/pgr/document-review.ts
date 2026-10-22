import { z } from "zod";
import { professionalIdentitySchema } from "@/shared/domains/professional-identity";
const required = (max: number) => z.string().trim().min(1).max(max);
export const pgrReviewSampleSchema = z
  .object({
    reason: required(1000),
    supersedesSampleId: z.uuid().nullable().default(null),
  })
  .strict();
export const pgrReviewFindingSchema = z
  .object({
    key: required(100),
    location: required(500),
    description: required(5000),
    severity: z.enum(["blocking", "observation"]),
    resolution: z.enum(["open", "resolved"]),
    correctionReference: z.string().trim().max(2000).nullable(),
  })
  .strict()
  .superRefine((f, c) => {
    if (f.resolution === "resolved" && !f.correctionReference)
      c.addIssue({
        code: "custom",
        path: ["correctionReference"],
        message: "Informe a referência da correção para encerrar um achado.",
      });
  });
export const pgrReviewDecisionSchema = z
  .object({
    expectedLatestDecisionId: z.uuid().nullable(),
    status: z.enum(["accepted", "changes_requested"]),
    reviewer: professionalIdentitySchema,
    reviewedAt: z.iso.datetime({ offset: true }),
    evidenceReference: required(2000),
    reason: required(5000),
    findings: z.array(pgrReviewFindingSchema).max(100),
  })
  .strict()
  .superRefine((d, c) => {
    if (new Set(d.findings.map((f) => f.key)).size !== d.findings.length)
      c.addIssue({
        code: "custom",
        path: ["findings"],
        message: "As identificações dos achados devem ser únicas.",
      });
    if (
      d.status === "accepted" &&
      d.findings.some((f) => f.severity === "blocking" && f.resolution === "open")
    )
      c.addIssue({
        code: "custom",
        path: ["findings"],
        message: "Há achados impeditivos abertos; registre correções e revalidação.",
      });
    if (
      d.status === "changes_requested" &&
      !d.findings.some((f) => f.resolution === "open")
    )
      c.addIssue({
        code: "custom",
        path: ["findings"],
        message: "Descreva ao menos um achado aberto no parecer de correção.",
      });
  });
export type PgrReviewDecisionInput = z.infer<typeof pgrReviewDecisionSchema>;
export type PgrReviewSampleInput = z.infer<typeof pgrReviewSampleSchema>;
