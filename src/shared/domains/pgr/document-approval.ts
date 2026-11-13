import { z } from "zod";
import {
  professionalIdentitySchema,
  type ProfessionalIdentity,
} from "@/shared/domains/professional-identity";

const text = (max: number, required: string) =>
  z
    .string({ error: required })
    .trim()
    .min(1, required)
    .max(max, `Máximo de ${max.toLocaleString("pt-BR")} caracteres.`);
const versionHash = z
  .string({ error: "Informe a versão do documento analisada." })
  .regex(/^[a-f0-9]{64}$/, "Versão do documento inválida.");

export const approvalEventKindSchema = z.enum([
  "required",
  "assigned",
  "revoked",
  "approved",
  "rejected",
  "issued",
  "issue_cancelled",
]);
export type ApprovalEventKind = z.infer<typeof approvalEventKindSchema>;

export type ApprovalEvent = {
  id: string;
  seq: number;
  kind: ApprovalEventKind;
  assignmentId: string | null;
  decisionId: string | null;
  supersedesIssueId: string | null;
  cancelledIssueId: string | null;
  authorUserId: string | null;
  reviewerUserId: string | null;
  reviewerIdentity: ProfessionalIdentity | null;
  snapshotSha256: string | null;
  templateSha256: string | null;
  fileSha256: string | null;
  documentId: string | null;
  actor: string;
  reason: string | null;
  createdAt: Date;
};

export type DocumentVersion = { snapshotSha256: string; templateSha256: string };

export type ApprovalState =
  | { status: "not_required" }
  | { status: "awaiting_reviewer" }
  | { status: "awaiting_review"; assignment: ApprovalEvent }
  | { status: "rejected"; assignment: ApprovalEvent; decision: ApprovalEvent }
  | { status: "approved"; assignment: ApprovalEvent; decision: ApprovalEvent }
  | { status: "stale"; assignment: ApprovalEvent; decision: ApprovalEvent };
export type ApprovalStatus = ApprovalState["status"];

type Review = {
  required: boolean;
  assignment: ApprovalEvent | null;
  decision: ApprovalEvent | null;
};
type Reducer = (review: Review, event: ApprovalEvent) => Review;

const keep: Reducer = (review) => review;
const decide: Reducer = (review, event) =>
  review.assignment && event.assignmentId === review.assignment.id
    ? { ...review, decision: event }
    : review;
const REDUCERS: Record<ApprovalEventKind, Reducer> = {
  required: (review) => ({ ...review, required: true }),
  assigned: (review, event) => ({ ...review, assignment: event, decision: null }),
  revoked: (review, event) =>
    review.assignment?.id === event.assignmentId
      ? { ...review, assignment: null, decision: null }
      : review,
  approved: decide,
  rejected: decide,
  issued: keep,
  issue_cancelled: keep,
};

const bySeq = (a: ApprovalEvent, b: ApprovalEvent) => a.seq - b.seq;

export function deriveApprovalState(
  events: readonly ApprovalEvent[],
  current: DocumentVersion,
): ApprovalState {
  const { required, assignment, decision } = [...events]
    .sort(bySeq)
    .reduce<Review>((review, event) => REDUCERS[event.kind](review, event), {
      required: false,
      assignment: null,
      decision: null,
    });
  if (!required) return { status: "not_required" };
  if (!assignment) return { status: "awaiting_reviewer" };
  if (!decision) return { status: "awaiting_review", assignment };
  if (decision.kind === "rejected") return { status: "rejected", assignment, decision };
  const sameVersion =
    decision.snapshotSha256 === current.snapshotSha256 &&
    decision.templateSha256 === current.templateSha256;
  return { status: sameVersion ? "approved" : "stale", assignment, decision };
}

const WITH_REVIEWER: readonly ApprovalEventKind[] = [
  "assigned",
  "revoked",
  "approved",
  "rejected",
  "issue_cancelled",
];
const ALLOWED_EVENTS: Record<ApprovalStatus, readonly ApprovalEventKind[]> = {
  not_required: ["required"],
  awaiting_reviewer: ["assigned", "issue_cancelled"],
  awaiting_review: WITH_REVIEWER,
  rejected: WITH_REVIEWER,
  stale: WITH_REVIEWER,
  approved: [...WITH_REVIEWER, "issued"],
};
const NO_REVIEWER = "Não há revisor designado neste PGR.";
const TRANSITION_BLOCK: Record<ApprovalEventKind, string> = {
  required: "A revisão obrigatória já está ativa neste PGR.",
  assigned: "Ative a revisão obrigatória deste PGR antes de designar o revisor.",
  revoked: NO_REVIEWER,
  approved: NO_REVIEWER,
  rejected: NO_REVIEWER,
  issued: "A emissão final exige parecer favorável vigente do revisor designado.",
  issue_cancelled: "Este PGR não tem revisão obrigatória ativa.",
};

export function transitionBlock(
  state: ApprovalState,
  kind: ApprovalEventKind,
): string | null {
  return ALLOWED_EVENTS[state.status].includes(kind) ? null : TRANSITION_BLOCK[kind];
}

const FINAL_ISSUE_BLOCK: Record<ApprovalStatus, string | null> = {
  not_required: null,
  approved: null,
  awaiting_reviewer:
    "Este PGR exige revisão. Designe um revisor diferente do elaborador antes de continuar.",
  awaiting_review: "Este PGR aguarda o parecer do revisor designado.",
  rejected:
    "O revisor designado rejeitou este PGR. Corrija os apontamentos e peça novo parecer.",
  stale:
    "Os dados ou o modelo mudaram depois do parecer. A nova versão precisa de revisão.",
};

export function finalIssueBlock(state: ApprovalState): string | null {
  return FINAL_ISSUE_BLOCK[state.status];
}

export type FinalIssue = {
  id: string;
  status: "current" | "superseded" | "cancelled";
  issuedAt: Date;
  issuedBy: string;
  documentId: string | null;
  fileSha256: string | null;
  snapshotSha256: string | null;
  templateSha256: string | null;
  decisionId: string | null;
  authorUserId: string | null;
  reviewerUserId: string | null;
  reviewerIdentity: ProfessionalIdentity | null;
  reviewedAt: Date | null;
  reviewReason: string | null;
  supersedesIssueId: string | null;
  supersededByIssueId: string | null;
  cancellation: { actor: string; reason: string | null; cancelledAt: Date } | null;
};

function issueStatus(cancelled: boolean, superseded: boolean): FinalIssue["status"] {
  if (cancelled) return "cancelled";
  return superseded ? "superseded" : "current";
}

export function listFinalIssues(events: readonly ApprovalEvent[]): FinalIssue[] {
  const byId = new Map(events.map((event) => [event.id, event]));
  const linked = (id: string | null) => (id ? (byId.get(id) ?? null) : null);
  const cancellations = new Map(events.map((event) => [event.cancelledIssueId, event]));
  const replacements = new Map(
    events.map((event) => [event.supersedesIssueId, event.id]),
  );
  return events
    .filter((event) => event.kind === "issued")
    .sort((a, b) => b.seq - a.seq)
    .map((issue) => {
      const decision = linked(issue.decisionId);
      const assignment = linked(issue.assignmentId);
      const cancellation = cancellations.get(issue.id) ?? null;
      const supersededByIssueId = replacements.get(issue.id) ?? null;
      return {
        id: issue.id,
        status: issueStatus(cancellation !== null, supersededByIssueId !== null),
        issuedAt: issue.createdAt,
        issuedBy: issue.actor,
        documentId: issue.documentId,
        fileSha256: issue.fileSha256,
        snapshotSha256: issue.snapshotSha256,
        templateSha256: issue.templateSha256,
        decisionId: issue.decisionId,
        authorUserId: assignment?.authorUserId ?? null,
        reviewerUserId: assignment?.reviewerUserId ?? null,
        reviewerIdentity: assignment?.reviewerIdentity ?? null,
        reviewedAt: decision?.createdAt ?? null,
        reviewReason: decision?.reason ?? null,
        supersedesIssueId: issue.supersedesIssueId,
        supersededByIssueId,
        cancellation: cancellation && {
          actor: cancellation.actor,
          reason: cancellation.reason,
          cancelledAt: cancellation.createdAt,
        },
      };
    });
}

export const reviewRequirementSchema = z
  .object({ reason: text(1000, "Informe o motivo da adoção da revisão obrigatória.") })
  .strict();
export const reviewerAssignmentSchema = z
  .object({
    reviewerUserId: text(200, "Selecione o revisor."),
    authorUserId: text(200, "Selecione o elaborador.").optional(),
    reviewer: professionalIdentitySchema,
    reason: text(1000, "Informe o motivo da designação."),
  })
  .strict()
  .refine((value) => value.authorUserId !== value.reviewerUserId, {
    path: ["reviewerUserId"],
    message: "Elaborador e revisor devem ser pessoas diferentes.",
  });
export const reviewerRevocationSchema = z
  .object({ reason: text(1000, "Informe o motivo da revogação.") })
  .strict();
export const approvalDecisionSchema = z
  .object({
    assignmentId: z.uuid("Designação inválida."),
    snapshotSha256: versionHash,
    verdict: z.enum(["approved", "rejected"], { error: "Informe o parecer." }),
    reason: z.string().trim().max(5000, "Máximo de 5.000 caracteres.").optional(),
  })
  .strict()
  .refine((value) => value.verdict === "approved" || Boolean(value.reason), {
    path: ["reason"],
    message: "Informe o motivo da rejeição.",
  });
export const issueCancellationSchema = z
  .object({ reason: text(1000, "Informe o motivo do cancelamento.") })
  .strict();

export type ReviewRequirementInput = z.infer<typeof reviewRequirementSchema>;
export type ReviewerAssignmentInput = z.infer<typeof reviewerAssignmentSchema>;
export type ReviewerRevocationInput = z.infer<typeof reviewerRevocationSchema>;
export type ApprovalDecisionInput = z.infer<typeof approvalDecisionSchema>;
export type IssueCancellationInput = z.infer<typeof issueCancellationSchema>;
