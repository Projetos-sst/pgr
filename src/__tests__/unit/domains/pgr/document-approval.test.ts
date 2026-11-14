import {
  approvalDecisionSchema,
  deriveApprovalState,
  finalIssueBlock,
  listFinalIssues,
  reviewerAssignmentSchema,
  transitionBlock,
  type ApprovalEvent,
  type ApprovalEventKind,
} from "@/shared/domains/pgr/document-approval";

const current = { snapshotSha256: "a".repeat(64), templateSha256: "b".repeat(64) };
const changedData = { ...current, snapshotSha256: "c".repeat(64) };
const changedTemplate = { ...current, templateSha256: "d".repeat(64) };

function event(
  seq: number,
  kind: ApprovalEventKind,
  patch: Partial<ApprovalEvent> = {},
): ApprovalEvent {
  return {
    id: `event-${seq}`,
    seq,
    kind,
    assignmentId: null,
    decisionId: null,
    supersedesIssueId: null,
    cancelledIssueId: null,
    authorUserId: null,
    reviewerUserId: null,
    reviewerIdentity: null,
    snapshotSha256: null,
    templateSha256: null,
    fileSha256: null,
    documentId: null,
    actor: "owner",
    reason: null,
    createdAt: new Date(Date.UTC(2026, 10, 1, 12, seq)),
    ...patch,
  };
}

const required = event(1, "required", { reason: "Adoção da revisão" });
const assigned = event(2, "assigned", {
  authorUserId: "author",
  reviewerUserId: "reviewer",
});
const decision = (seq: number, kind: "approved" | "rejected", assignmentId = "event-2") =>
  event(seq, kind, {
    assignmentId,
    authorUserId: "author",
    reviewerUserId: "reviewer",
    actor: "reviewer",
    ...current,
  });

describe("deriveApprovalState", () => {
  it("keeps a PGR without the explicit requirement outside the flow", () => {
    expect(deriveApprovalState([], current)).toEqual({ status: "not_required" });
    expect(finalIssueBlock(deriveApprovalState([], current))).toBeNull();
  });

  it("waits for a reviewer once the requirement is active", () => {
    const state = deriveApprovalState([required], current);
    expect(state.status).toBe("awaiting_reviewer");
    expect(finalIssueBlock(state)).toMatch(/revisor/i);
  });

  it("waits for the opinion of the designated reviewer", () => {
    const state = deriveApprovalState([required, assigned], current);
    expect(state).toMatchObject({ status: "awaiting_review", assignment: assigned });
    expect(finalIssueBlock(state)).not.toBeNull();
  });

  it("is approved only while data and template match the reviewed version", () => {
    const events = [required, assigned, decision(3, "approved")];
    expect(deriveApprovalState(events, current).status).toBe("approved");
    expect(finalIssueBlock(deriveApprovalState(events, current))).toBeNull();
    expect(deriveApprovalState(events, changedData).status).toBe("stale");
    expect(deriveApprovalState(events, changedTemplate).status).toBe("stale");
    expect(finalIssueBlock(deriveApprovalState(events, changedData))).toMatch(/mudaram/);
  });

  it("keeps the rejection until the same reviewer approves a later version", () => {
    const rejected = [required, assigned, decision(3, "rejected")];
    expect(deriveApprovalState(rejected, current).status).toBe("rejected");
    expect(
      deriveApprovalState([...rejected, decision(4, "approved")], current).status,
    ).toBe("approved");
  });

  it("drops the previous opinion on reassignment and on revocation", () => {
    const approved = [required, assigned, decision(3, "approved")];
    const reassigned = event(4, "assigned", {
      authorUserId: "author",
      reviewerUserId: "other",
    });
    expect(deriveApprovalState([...approved, reassigned], current)).toMatchObject({
      status: "awaiting_review",
      assignment: reassigned,
    });
    const revoked = event(4, "revoked", { assignmentId: "event-2" });
    expect(deriveApprovalState([...approved, revoked], current).status).toBe(
      "awaiting_reviewer",
    );
  });

  it("ignores an opinion that cites a replaced assignment", () => {
    const reassigned = event(3, "assigned", {
      authorUserId: "author",
      reviewerUserId: "other",
    });
    const late = decision(4, "approved", "event-2");
    expect(deriveApprovalState([required, assigned, reassigned, late], current)).toEqual({
      status: "awaiting_review",
      assignment: reassigned,
    });
  });

  it("does not depend on the order in which the events are read", () => {
    const events = [decision(3, "approved"), assigned, required];
    expect(deriveApprovalState(events, current).status).toBe("approved");
  });
});

describe("transitionBlock", () => {
  const state = (events: ApprovalEvent[]) => deriveApprovalState(events, current);

  it("allows each event only from the states of the machine", () => {
    expect(transitionBlock(state([]), "required")).toBeNull();
    expect(transitionBlock(state([]), "assigned")).not.toBeNull();
    expect(transitionBlock(state([required]), "required")).not.toBeNull();
    expect(transitionBlock(state([required]), "assigned")).toBeNull();
    expect(transitionBlock(state([required]), "approved")).not.toBeNull();
    expect(transitionBlock(state([required]), "revoked")).not.toBeNull();
    const waiting = state([required, assigned]);
    const reviewerEvents: ApprovalEventKind[] = [
      "assigned",
      "revoked",
      "approved",
      "rejected",
    ];
    for (const kind of reviewerEvents) expect(transitionBlock(waiting, kind)).toBeNull();
    expect(transitionBlock(waiting, "issued")).not.toBeNull();
    const approved = state([required, assigned, decision(3, "approved")]);
    expect(transitionBlock(approved, "issued")).toBeNull();
    const stale = deriveApprovalState(
      [required, assigned, decision(3, "approved")],
      changedData,
    );
    expect(transitionBlock(stale, "issued")).not.toBeNull();
    expect(transitionBlock(stale, "approved")).toBeNull();
  });
});

describe("listFinalIssues", () => {
  const approval = decision(3, "approved");
  const first = event(4, "issued", {
    assignmentId: "event-2",
    decisionId: "event-3",
    documentId: "doc-1",
    fileSha256: "f".repeat(64),
    actor: "author",
    ...current,
  });
  const second = event(6, "issued", {
    assignmentId: "event-2",
    decisionId: "event-5",
    supersedesIssueId: "event-4",
    documentId: "doc-2",
    fileSha256: "e".repeat(64),
    actor: "author",
    ...changedData,
  });

  it("carries authorship, review and origin evidence for each issue", () => {
    const [issue] = listFinalIssues([required, assigned, approval, first]);
    expect(issue).toMatchObject({
      id: "event-4",
      status: "current",
      issuedBy: "author",
      authorUserId: "author",
      reviewerUserId: "reviewer",
      decisionId: "event-3",
      documentId: "doc-1",
      fileSha256: "f".repeat(64),
      ...current,
    });
    expect(issue.reviewedAt).toEqual(approval.createdAt);
  });

  it("marks replaced and cancelled issues without dropping them", () => {
    const cancelled = event(7, "issue_cancelled", {
      cancelledIssueId: "event-6",
      reason: "Emitido com a obra errada",
    });
    const issues = listFinalIssues([
      required,
      assigned,
      approval,
      first,
      { ...decision(5, "approved"), ...changedData },
      second,
      cancelled,
    ]);
    expect(issues.map((issue) => [issue.id, issue.status])).toEqual([
      ["event-6", "cancelled"],
      ["event-4", "superseded"],
    ]);
    expect(issues[0].cancellation).toMatchObject({
      actor: "owner",
      reason: "Emitido com a obra errada",
    });
    expect(issues[1].supersededByIssueId).toBe("event-6");
  });
});

describe("approval schemas", () => {
  const reviewer = {
    fullName: "Revisora Fictícia",
    profession: "Engenheira de segurança",
    registration: { kind: "registered", council: "CREA", number: "123" },
  };

  it("requires a reason to reject and accepts an approval without one", () => {
    const base = {
      assignmentId: "3f2b8c1e-5d4a-4b6f-9a1c-2e7d8f9a0b1c",
      snapshotSha256: "a".repeat(64),
    };
    expect(
      approvalDecisionSchema.safeParse({ ...base, verdict: "rejected" }).success,
    ).toBe(false);
    expect(
      approvalDecisionSchema.safeParse({ ...base, verdict: "rejected", reason: "  " })
        .success,
    ).toBe(false);
    expect(
      approvalDecisionSchema.safeParse({ ...base, verdict: "approved" }).success,
    ).toBe(true);
    expect(
      approvalDecisionSchema.safeParse({ ...base, verdict: "approved", extra: 1 })
        .success,
    ).toBe(false);
  });

  it("rejects the author as reviewer already at the input", () => {
    const input = { reviewer, reason: "Designação", reviewerUserId: "u1" };
    expect(reviewerAssignmentSchema.safeParse(input).success).toBe(true);
    expect(
      reviewerAssignmentSchema.safeParse({ ...input, authorUserId: "u1" }).success,
    ).toBe(false);
    expect(
      reviewerAssignmentSchema.safeParse({ ...input, authorUserId: "u2" }).success,
    ).toBe(true);
  });
});
