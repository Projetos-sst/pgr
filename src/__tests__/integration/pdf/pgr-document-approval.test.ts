import type postgres from "postgres";
import { createHash } from "node:crypto";
import { NextRequest } from "next/server";
jest.mock("@/shared/db/env", () => ({
  getDatabaseUrl: () => process.env.INTEGRATION_APP_RUNTIME_URL,
}));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
const mockStaff = jest.fn();
jest.mock("@/shared/auth/require-office-staff", () => ({
  OFFICE_STAFF_ROLES: new Set(["owner", "collaborator"]),
  requireOfficeStaff: () => mockStaff(),
}));
const mockUploaded: File[] = [];
const mockRemove = jest.fn().mockResolvedValue(undefined);
jest.mock("@/shared/integrations/storage/documents-storage", () => ({
  ...jest.requireActual("@/shared/integrations/storage/documents-storage"),
  putDocumentObject: jest.fn(
    async (orgId: string, group: string, _version: number, file: File) => {
      mockUploaded.push(file);
      return {
        storagePath: `${orgId}/documentos/${group}/${file.name}`,
        sizeBytes: file.size,
      };
    },
  ),
  removeDocumentObject: (path: string) => mockRemove(path),
}));
jest.mock("@/shared/integrations/pdf/gotenberg", () => ({
  ...jest.requireActual("@/shared/integrations/pdf/gotenberg"),
  htmlToPdf: jest.fn().mockResolvedValue(Buffer.from("%PDF-1.4")),
}));
jest.mock("@/shared/integrations/storage/company-logo-storage", () => ({
  downloadCompanyLogo: jest.fn().mockResolvedValue(null),
}));
import type { TenantContext } from "@/shared/auth/require-tenant-context";
import { adminClient, applyMigrations } from "../_helpers/db";
import { seedPgrBase, PGR_IDS as I } from "../_helpers/pgr-seed";
import {
  assignDocumentReviewer,
  cancelFinalIssue,
  decideDocumentApproval,
  getDocumentApproval,
  issuePgrDocument,
  requireDocumentReview,
  revokeDocumentReviewer,
} from "@/shared/server/pgr/document-approval-core";
import { createPgrSignature } from "@/shared/server/pgr/pgr-signature-core";
import {
  generatePgrDocx,
  type GeneratePgrDocxOptions,
} from "@/shared/server/platform/pgr-docx-core";
import { getPgrReadiness } from "@/shared/server/pgr/pgr-readiness-core";
import { deleteDocument } from "@/shared/db/repositories/documents";
import { extractDocxText } from "@/shared/integrations/docx/template-engine";
import {
  requireDocumentReviewAction,
  getDocumentApprovalAction,
} from "@/shared/server/actions/pgr/document-approval";
import { GET, POST as ACTIVATE } from "@/app/api/v1/pgr/[id]/approval/route";
import { POST as ASSIGN } from "@/app/api/v1/pgr/[id]/approval/reviewer/route";
import { POST as REVOKE } from "@/app/api/v1/pgr/[id]/approval/reviewer/revocation/route";
import { POST as DECIDE } from "@/app/api/v1/pgr/[id]/approval/decisions/route";
import { POST as CANCEL } from "@/app/api/v1/pgr/[id]/approval/issues/[issueId]/cancellation/route";
import { POST as DOCX } from "@/app/api/v1/pgr/[id]/docx/route";
import { GET as LEGACY_PDF } from "@/app/api/v1/pgr/[id]/pdf/route";
import { POST as SIGNATURE } from "@/app/api/v1/pgr/[id]/signature/route";

const enabled =
  !!process.env.INTEGRATION_APP_RUNTIME_URL && !!process.env.INTEGRATION_DATABASE_URL;
const OTHER_COMPANY = "33333333-3333-3333-3333-333333333333";
const member = (userId: string, role = "collaborator"): TenantContext => ({
  tenantId: "org_a",
  userId,
  role,
  plan: "free",
});
const owner = member("owner", "owner");
const author = member("author");
const reviewer = member("reviewer");
const other = member("other");
const scoped = member("scoped");
const identity = {
  fullName: "Revisora Fictícia",
  profession: "Engenheira de segurança do trabalho",
  registration: { kind: "registered", council: "CREA", number: "123", region: "SP" },
};
const assignment = (reviewerUserId = "reviewer") => ({
  reviewerUserId,
  reviewer: identity,
  reason: "Designação fictícia",
});
const activation = { reason: "Adoção da revisão por documento" };
type Session = { user: string; role: string };
const request = (session: Session, body: unknown = {}, method = "POST") =>
  new NextRequest(`http://localhost/api/v1/pgr/${I.pgrA}/approval`, {
    method,
    ...(method === "GET" ? {} : { body: JSON.stringify(body) }),
    headers: {
      "content-type": "application/json",
      "x-dev-tenant": "org_a",
      "x-dev-user": session.user,
      "x-dev-role": session.role,
    },
  });
const asOwner: Session = { user: "owner", role: "owner" };
const asReviewer: Session = { user: "reviewer", role: "collaborator" };
const params = { params: Promise.resolve({ id: I.pgrA }) };
const sha256 = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

(enabled ? describe : describe.skip)("PGR review per document and final issue", () => {
  let admin: ReturnType<typeof postgres>;
  let runtime: ReturnType<typeof postgres>;
  const oldEnv = { ...process.env };

  async function asActor<T>(
    actor: string,
    run: (tx: postgres.TransactionSql) => Promise<T>,
  ) {
    return runtime.begin(async (tx) => {
      await tx`select set_config('app.current_org','org_a',true), set_config('app.current_actor',${actor},true)`;
      return run(tx);
    });
  }
  const version = async () =>
    (await getDocumentApproval(reviewer, I.pgrA)).version.snapshotSha256;
  const approve = async () => {
    const view = await getDocumentApproval(reviewer, I.pgrA);
    return decideDocumentApproval(reviewer, I.pgrA, {
      assignmentId: view.assignmentId,
      snapshotSha256: view.version.snapshotSha256,
      verdict: "approved",
    });
  };
  const status = async () => (await getDocumentApproval(owner, I.pgrA)).status;
  const issueOptions = async (): Promise<GeneratePgrDocxOptions> => ({
    purpose: "issue",
    expectedSourceSha256: (await getPgrReadiness("org_a", I.pgrA)).sourceSha256,
  });
  async function reviewed() {
    await requireDocumentReview(owner, I.pgrA, activation);
    await assignDocumentReviewer(owner, I.pgrA, assignment());
    return approve();
  }

  beforeAll(async () => {
    admin = adminClient();
    await admin`set client_min_messages=warning`;
    await applyMigrations(admin);
    runtime = (await import("postgres")).default(
      String(process.env.INTEGRATION_APP_RUNTIME_URL),
      { max: 1, prepare: false },
    );
  });
  afterAll(async () => {
    process.env = oldEnv;
    await runtime.end({ timeout: 5 });
    await admin.end({ timeout: 5 });
  });
  beforeEach(async () => {
    await seedPgrBase(admin);
    await admin.unsafe(`
      insert into users (id,email) values ('owner','owner@example.test'),
        ('author','author@example.test'), ('reviewer','reviewer@example.test'),
        ('other','other@example.test'), ('scoped','scoped@example.test'),
        ('representative','rep@example.test');
      insert into org_memberships (org_id,user_id,role) values ('org_a','owner','owner'),
        ('org_a','author','collaborator'), ('org_a','reviewer','org:member'),
        ('org_a','other','collaborator'), ('org_a','scoped','collaborator'),
        ('org_a','representative','client');
      insert into companies (id,org_id,cnpj,razao_social)
        values ('${OTHER_COMPANY}','org_a','33444555000181','A2 Ltda');
      insert into member_access_scopes (org_id,user_id,company_id,area,granted_by)
        values ('org_a','scoped','${OTHER_COMPANY}','safety','owner');
      update pgr set created_by='author', responsible='Profissional fictício',
        issued_at='2026-01-01', valid_until='2027-01-01' where id='${I.pgrA}';
      update ges set process_description='Processo fictício observado' where id='${I.gesA}';
      update risks set hazard='Perigo observado', sources='Fonte observada',
        possible_injuries='Informação declarada' where id='${I.riskA}';
      update risk_assessments set result='moderate' where id='${I.riskAssessmentA}';
    `);
    mockUploaded.length = 0;
    mockRemove.mockClear();
    mockStaff.mockReset();
    mockStaff.mockResolvedValue(owner);
    process.env.APP_ENV = "local";
    process.env.DEV_API_AUTH_BYPASS = "true";
  });

  it("leaves a PGR without the explicit requirement exactly as before", async () => {
    expect(await status()).toBe("not_required");
    const generated = await issuePgrDocument(author, I.pgrA, await issueOptions());
    expect(generated.issue).toBeNull();
    expect(extractDocxText(generated.file)).toContain(
      "Documento gerado após conferência",
    );
    expect(mockUploaded).toHaveLength(0);
    expect(await admin`select id from pgr_document_approvals`).toHaveLength(0);
    const signature = await createPgrSignature(author, I.pgrA, {});
    expect(signature.signature.state).toBe("pending");
  });

  it("lets only the administrator adopt the review, once, and then blocks issue and signature", async () => {
    await expect(requireDocumentReview(author, I.pgrA, activation)).rejects.toMatchObject(
      { code: "FORBIDDEN" },
    );
    await requireDocumentReview(owner, I.pgrA, activation);
    await expect(requireDocumentReview(owner, I.pgrA, activation)).rejects.toMatchObject({
      code: "VALIDATION",
    });
    expect(await status()).toBe("awaiting_reviewer");
    await expect(
      issuePgrDocument(author, I.pgrA, await issueOptions()),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(createPgrSignature(owner, I.pgrA, {})).rejects.toMatchObject({
      code: "VALIDATION",
    });
    const preview = await generatePgrDocx("org_a", I.pgrA);
    expect(extractDocxText(preview.file)).toContain("PRÉVIA PARA CONFERÊNCIA");
  });

  it("holds the legacy PDF route behind the pending review", async () => {
    const legacyPdf = () => LEGACY_PDF(request(asOwner, undefined, "GET"), params);
    expect((await legacyPdf()).status).toBe(200);
    await requireDocumentReview(owner, I.pgrA, activation);
    const blocked = await legacyPdf();
    expect(blocked.status).toBe(422);
    expect((await blocked.json()).error.code).toBe("VALIDATION");
    await assignDocumentReviewer(owner, I.pgrA, assignment());
    await approve();
    expect((await legacyPdf()).status).toBe(200);
  });

  it("designates only an office member, in scope and different from the author", async () => {
    await expect(
      assignDocumentReviewer(owner, I.pgrA, assignment()),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    await requireDocumentReview(owner, I.pgrA, activation);
    await expect(
      assignDocumentReviewer(author, I.pgrA, assignment()),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    for (const invalid of ["author", "representative", "scoped", "nobody"])
      await expect(
        assignDocumentReviewer(owner, I.pgrA, assignment(invalid)),
      ).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(
      assignDocumentReviewer(owner, I.pgrA, { ...assignment(), authorUserId: "other" }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    const row = await assignDocumentReviewer(owner, I.pgrA, assignment());
    expect(row).toMatchObject({ authorUserId: "author", reviewerUserId: "reviewer" });
    const view = await getDocumentApproval(owner, I.pgrA);
    expect(view).toMatchObject({ status: "awaiting_review", assignmentId: row.id });
    expect(view.reviewer).toMatchObject({ userId: "reviewer", identity });
  });

  it("asks the administrator for the author when the PGR has none recorded", async () => {
    await admin`update pgr set created_by=null where id=${I.pgrA}`;
    await requireDocumentReview(owner, I.pgrA, activation);
    await expect(
      assignDocumentReviewer(owner, I.pgrA, assignment()),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    const row = await assignDocumentReviewer(owner, I.pgrA, {
      ...assignment(),
      authorUserId: "other",
    });
    expect(row.authorUserId).toBe("other");
  });

  it("records only the opinion of the designated reviewer, never the author's", async () => {
    await requireDocumentReview(owner, I.pgrA, activation);
    const assigned = await assignDocumentReviewer(owner, I.pgrA, assignment());
    const input = {
      assignmentId: assigned.id,
      snapshotSha256: await version(),
      verdict: "approved",
    };
    for (const intruder of [author, other, owner])
      await expect(decideDocumentApproval(intruder, I.pgrA, input)).rejects.toMatchObject(
        { code: "FORBIDDEN" },
      );
    await expect(
      decideDocumentApproval(reviewer, I.pgrA, { ...input, verdict: "rejected" }),
    ).rejects.toMatchObject({ name: "ZodError" });
    await expect(
      decideDocumentApproval(reviewer, I.pgrA, {
        ...input,
        snapshotSha256: "0".repeat(64),
      }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    await decideDocumentApproval(reviewer, I.pgrA, {
      ...input,
      verdict: "rejected",
      reason: "Fonte do risco incompleta",
    });
    expect(await status()).toBe("rejected");
    await expect(
      issuePgrDocument(author, I.pgrA, await issueOptions()),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    const approval = await decideDocumentApproval(reviewer, I.pgrA, input);
    expect(approval).toMatchObject({ kind: "approved", actor: "reviewer" });
    expect(approval.templateSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(await status()).toBe("approved");
  });

  it("makes the approval stale when the data changes and keeps the old opinion", async () => {
    const first = await reviewed();
    await admin`update risks set description='Alteração relevante' where id=${I.riskA}`;
    expect(await status()).toBe("stale");
    await expect(
      issuePgrDocument(author, I.pgrA, await issueOptions()),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(createPgrSignature(owner, I.pgrA, {})).rejects.toMatchObject({
      code: "VALIDATION",
    });
    const second = await approve();
    expect(second.snapshotSha256).not.toBe(first.snapshotSha256);
    expect(await status()).toBe("approved");
    const kinds = (await getDocumentApproval(owner, I.pgrA)).history.map((e) => e.kind);
    expect(kinds.filter((kind) => kind === "approved")).toHaveLength(2);
  });

  it("drops the opinion on reassignment and on revocation", async () => {
    await reviewed();
    await assignDocumentReviewer(owner, I.pgrA, assignment("other"));
    expect(await status()).toBe("awaiting_review");
    const view = await getDocumentApproval(owner, I.pgrA);
    const input = {
      assignmentId: view.assignmentId,
      snapshotSha256: view.version.snapshotSha256,
      verdict: "approved",
    };
    await expect(decideDocumentApproval(reviewer, I.pgrA, input)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await decideDocumentApproval(other, I.pgrA, input);
    expect(await status()).toBe("approved");
    await expect(
      revokeDocumentReviewer(other, I.pgrA, { reason: "Tentativa" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await revokeDocumentReviewer(owner, I.pgrA, { reason: "Revisor afastado" });
    expect(await status()).toBe("awaiting_reviewer");
    await expect(decideDocumentApproval(other, I.pgrA, input)).rejects.toMatchObject({
      code: "VALIDATION",
    });
    await expect(
      revokeDocumentReviewer(owner, I.pgrA, { reason: "De novo" }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(createPgrSignature(owner, I.pgrA, {})).rejects.toMatchObject({
      code: "VALIDATION",
    });
  });

  it("makes self-approval and forged opinions impossible in the database", async () => {
    await requireDocumentReview(owner, I.pgrA, activation);
    const assigned = await assignDocumentReviewer(owner, I.pgrA, assignment());
    const hash = "a".repeat(64);
    const forged = (actor: string, authorId: string, reviewerId: string) =>
      asActor(
        actor,
        (tx) => tx`insert into pgr_document_approvals
          (org_id,pgr_id,kind,assignment_id,author_user_id,reviewer_user_id,snapshot_sha256,template_sha256,actor)
          values ('org_a',${I.pgrA},'approved',${assigned.id},${authorId},${reviewerId},${hash},${hash},${actor})`,
      );
    await expect(forged("author", "author", "author")).rejects.toMatchObject({
      code: "42501",
    });
    await expect(
      admin`insert into pgr_document_approvals
        (org_id,pgr_id,kind,author_user_id,reviewer_user_id,reviewer_identity,actor,reason)
        values ('org_a',${I.pgrA},'assigned','author','author','{}'::jsonb,'owner','forjado')`,
    ).rejects.toMatchObject({ code: "23514" });
    await expect(forged("author", "other", "author")).rejects.toMatchObject({
      code: "42501",
    });
    await expect(forged("other", "author", "reviewer")).rejects.toMatchObject({
      code: "42501",
    });
    await expect(forged("other", "author", "other")).rejects.toMatchObject({
      code: "42501",
    });
    await expect(
      asActor(
        "owner",
        (tx) => tx`insert into pgr_document_approvals
          (org_id,pgr_id,kind,author_user_id,reviewer_user_id,reviewer_identity,actor,reason)
          values ('org_a',${I.pgrA},'assigned','other','author','{}'::jsonb,'owner','forjado')`,
      ),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      asActor(
        "author",
        (tx) => tx`insert into pgr_document_approvals (org_id,pgr_id,kind,actor,reason)
          values ('org_a',${I.pgrB},'required','author','forjado')`,
      ),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      asActor("owner", (tx) => tx`update pgr_document_approvals set reason='forjado'`),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      asActor("owner", (tx) => tx`delete from pgr_document_approvals`),
    ).rejects.toMatchObject({ code: "42501" });
    expect(await forged("reviewer", "author", "reviewer")).toHaveLength(0);
  });

  it("archives the final issue with authorship, review and origin evidence", async () => {
    const approval = await reviewed();
    const generated = await issuePgrDocument(author, I.pgrA, await issueOptions());
    expect(extractDocxText(generated.file)).toContain(identity.fullName);
    expect(mockUploaded).toHaveLength(1);
    const stored = Buffer.from(await mockUploaded[0].arrayBuffer());
    expect(generated.issue).toMatchObject({
      kind: "issued",
      actor: "author",
      decisionId: approval.id,
      fileSha256: sha256(stored),
      snapshotSha256: approval.snapshotSha256,
      templateSha256: approval.templateSha256,
    });
    const [issue] = (await getDocumentApproval(owner, I.pgrA)).issues;
    expect(issue).toMatchObject({
      status: "current",
      issuedBy: "author",
      authorUserId: "author",
      reviewerUserId: "reviewer",
      reviewerIdentity: identity,
      decisionId: approval.id,
    });
    const [document] = await admin`select doc_type, related_entity_id from documents
      where id=${String(issue.documentId)}`;
    expect(document).toMatchObject({
      doc_type: "PGR — emissão final",
      related_entity_id: I.pgrA,
    });
    await expect(deleteDocument("org_a", String(issue.documentId))).rejects.toMatchObject(
      { code: "IN_USE" },
    );
    const [row] = await admin`select snapshot from pgr_document_approvals
      where id=${issue.id}`;
    expect(JSON.stringify(row.snapshot)).toContain("Ruído contínuo");
  });

  it("issues a new version after a change and records replacement and cancellation", async () => {
    await reviewed();
    const first = await issuePgrDocument(author, I.pgrA, await issueOptions());
    await admin`update risks set description='Versão corrigida' where id=${I.riskA}`;
    await approve();
    const second = await issuePgrDocument(author, I.pgrA, await issueOptions());
    expect(second.issue).toMatchObject({ supersedesIssueId: first.issue?.id });
    await expect(
      cancelFinalIssue(author, I.pgrA, String(second.issue?.id), { reason: "x" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await cancelFinalIssue(owner, I.pgrA, String(second.issue?.id), {
      reason: "Emitido com a obra errada",
    });
    await expect(
      cancelFinalIssue(owner, I.pgrA, String(second.issue?.id), { reason: "De novo" }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(
      cancelFinalIssue(owner, I.pgrA, I.pgrA, { reason: "Inexistente" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    const issues = (await getDocumentApproval(owner, I.pgrA)).issues;
    expect(issues.map((issue) => issue.status)).toEqual(["cancelled", "superseded"]);
    expect(issues[0].cancellation).toMatchObject({
      actor: "owner",
      reason: "Emitido com a obra errada",
    });
    expect(mockUploaded).toHaveLength(2);
  });

  it("removes the stored file when the issue cannot be recorded", async () => {
    await reviewed();
    const options = await issueOptions();
    await admin`revoke insert on documents from app_runtime`;
    await expect(issuePgrDocument(author, I.pgrA, options))
      .rejects.toBeDefined()
      .finally(() => admin`grant insert on documents to app_runtime`);
    expect(mockRemove).toHaveBeenCalledTimes(1);
    expect(
      await admin`select id from pgr_document_approvals where kind='issued'`,
    ).toHaveLength(0);
  });

  it("hides the review from other offices and from members outside the scope", async () => {
    await reviewed();
    const foreign: TenantContext = { ...owner, tenantId: "org_b" };
    await expect(getDocumentApproval(foreign, I.pgrA)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(
      requireDocumentReview(foreign, I.pgrA, activation),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(getDocumentApproval(scoped, I.pgrA)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(
      issuePgrDocument(scoped, I.pgrA, await issueOptions()),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(
      await asActor("scoped", (tx) => tx`select id from pgr_document_approvals`),
    ).toHaveLength(0);
    await admin`insert into member_access_scopes (org_id,user_id,company_id,area,granted_by)
      values ('org_a','reviewer',${OTHER_COMPANY},'safety','owner')`;
    await expect(approve()).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("runs the same flow through Server Actions and REST", async () => {
    mockStaff.mockResolvedValue(author);
    expect(await requireDocumentReviewAction(I.pgrA, activation)).toMatchObject({
      ok: false,
      error: { code: "FORBIDDEN" },
    });
    expect((await ACTIVATE(request(asReviewer, activation), params)).status).toBe(403);
    expect((await ACTIVATE(request(asOwner, activation), params)).status).toBe(201);
    expect(
      (await ACTIVATE(request({ user: "representative", role: "client" }), params))
        .status,
    ).toBe(403);
    expect((await ASSIGN(request(asOwner, assignment("author")), params)).status).toBe(
      422,
    );
    expect((await ASSIGN(request(asOwner, assignment()), params)).status).toBe(201);
    mockStaff.mockResolvedValue(reviewer);
    const action = await getDocumentApprovalAction(I.pgrA);
    expect(action).toMatchObject({ ok: true, data: { status: "awaiting_review" } });
    const overview = await (await GET(request(asReviewer, {}, "GET"), params)).json();
    expect(overview.permissions).toMatchObject({ canDecide: true, canAssign: false });
    const decision = {
      assignmentId: overview.assignmentId,
      snapshotSha256: overview.version.snapshotSha256,
      verdict: "approved",
    };
    const blocked = await SIGNATURE(request(asOwner), params);
    expect(blocked.status).toBe(422);
    expect((await DECIDE(request(asOwner, decision), params)).status).toBe(403);
    expect((await DECIDE(request(asReviewer, decision), params)).status).toBe(201);
    expect((await SIGNATURE(request(asOwner), params)).status).toBe(201);
    const docx = await DOCX(
      request(asOwner, { format: "docx", ...(await issueOptions()) }),
      params,
    );
    expect(docx.status).toBe(200);
    const issueId = String(docx.headers.get("X-Pgr-Issue-Id"));
    expect(docx.headers.get("X-Pgr-Document-Id")).toMatch(/^[a-f0-9-]{36}$/);
    const cancel = { params: Promise.resolve({ id: I.pgrA, issueId }) };
    expect(
      (await CANCEL(request(asReviewer, { reason: "Tentativa" }), cancel)).status,
    ).toBe(403);
    expect(
      (await CANCEL(request(asOwner, { reason: "Substituído" }), cancel)).status,
    ).toBe(201);
    expect((await REVOKE(request(asOwner, { reason: "Encerrado" }), params)).status).toBe(
      201,
    );
    expect((await SIGNATURE(request(asOwner), params)).status).toBe(422);
  });
});
