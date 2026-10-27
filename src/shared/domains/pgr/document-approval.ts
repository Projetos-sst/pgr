import { z } from "zod";
import { professionalIdentitySchema } from "../professional-identity";
import { ValidationError } from "@/shared/errors/validation-error";
const text = (max: number) => z.string().trim().min(1).max(max);
export const documentReviewerSchema = z
  .object({
    authorUserId: text(200),
    reviewerUserId: text(200),
    reviewer: professionalIdentitySchema,
    reason: text(1000),
    expectedAssignmentId: z.uuid().nullable(),
  })
  .strict()
  .refine((v) => v.authorUserId !== v.reviewerUserId, {
    path: ["reviewerUserId"],
    message: "Elaborador e revisor devem ser pessoas diferentes.",
  });
export const documentApprovalSchema = z
  .object({
    assignmentId: z.uuid(),
    sampleId: z.uuid(),
    expectedDecisionId: z.uuid().nullable(),
    status: z.enum(["accepted", "changes_requested"]),
    reason: text(5000),
  })
  .strict();
export type DocumentReviewerInput = z.infer<typeof documentReviewerSchema>;
export type DocumentApprovalInput = z.infer<typeof documentApprovalSchema>;

export type DocumentApprovalSnapshot = {
  required?: boolean;
  assignment: { id: string } | null;
  decision: {
    status: string;
    assignmentId: string | null;
    sourceSha256: string | null;
    templateSha256: string | null;
  } | null;
};
/** Legacy migration is explicit: assigning a reviewer activates this gate for a PGR. */
export function checkDocumentApproval(
  approval: DocumentApprovalSnapshot | undefined,
  sourceSha256: string,
  templateSha256: string,
) {
  if (!approval?.assignment) {
    if (approval?.required)
      throw new ValidationError(
        "Designe um revisor diferente do elaborador e conclua a revisão técnica antes de emitir ou assinar este novo PGR.",
      );
    return;
  }
  const decision = approval.decision;
  if (
    !decision ||
    decision.status !== "accepted" ||
    decision.assignmentId !== approval.assignment.id ||
    decision.sourceSha256 !== sourceSha256 ||
    decision.templateSha256 !== templateSha256
  )
    throw new ValidationError(
      "Este PGR exige parecer favorável do revisor designado sobre os dados e o modelo atuais. Gere uma amostra e conclua a revisão antes de emitir ou assinar.",
    );
}
