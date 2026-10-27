import type postgres from "postgres";
import { NextRequest } from "next/server";
jest.mock("@/shared/integrations/clerk/reviewer-account", () => ({
  findVerifiedReviewerAccount: jest.fn(async () => "external"),
}));
jest.mock("@/shared/db/env", () => ({
  getDatabaseUrl: () => process.env.INTEGRATION_APP_RUNTIME_URL,
}));
import { adminClient, applyMigrations, withOrgTx } from "../_helpers/db";
import { seedPgrBase, PGR_IDS as I } from "../_helpers/pgr-seed";
import {
  assignReviewer,
  approveDocument,
  assertPgrDocumentApproval,
  currentPgrTemplateHash,
  registerRestrictedReviewer,
  revokeRestrictedReviewer,
  documentApprovalOverview,
} from "@/shared/server/pgr/document-approval-core";
import { getReviewSample } from "@/shared/server/pgr/document-review-core";
import { GET as companyList } from "@/app/api/v1/companies/route";
import { createPgrReviewSample } from "@/shared/db/repositories/pgr-document-reviews";
import { getPgrGenerationSnapshot } from "@/shared/db/repositories/pgr-generation-snapshot";
import { pgrSnapshotHash } from "@/shared/server/pgr/pgr-readiness-core";
import { documentReviewerSchema } from "@/shared/domains/pgr/document-approval";
const author = {
  tenantId: "org_a",
  userId: "author",
  role: "owner",
  plan: "free" as const,
};
const reviewer = { ...author, userId: "reviewer", role: "collaborator" };
const identity = {
  fullName: "Revisor fictício",
  profession: "Profissional SST",
  registration: {
    kind: "registered" as const,
    council: "Órgão fictício",
    number: "TESTE",
  },
};
(process.env.INTEGRATION_APP_RUNTIME_URL ? describe : describe.skip)(
  "SEG-09/24 own-account per-document review",
  () => {
    let admin: ReturnType<typeof postgres>, runtime: ReturnType<typeof postgres>;
    beforeAll(async () => {
      admin = adminClient();
      await applyMigrations(admin);
      runtime = (await import("postgres")).default(
        process.env.INTEGRATION_APP_RUNTIME_URL!,
        { max: 1, prepare: false },
      );
    });
    afterAll(async () => {
      await runtime?.end({ timeout: 5 });
      await admin?.end({ timeout: 5 });
    });
    beforeEach(async () => {
      await seedPgrBase(admin);
      await admin`insert into users (id) values ('author'),('reviewer'),('other'),('external')`;
      await admin`insert into org_memberships (org_id,user_id,role) values ('org_a','author','owner'),('org_a','reviewer','collaborator'),('org_a','other','collaborator')`;
      await admin`update pgr set created_by='author' where id=${I.pgrA}`;
    });
    async function setup(reviewerUserId = "reviewer") {
      const assignment = await assignReviewer(author, I.pgrA, {
        authorUserId: "author",
        reviewerUserId,
        reviewer: identity,
        reason: "Revisão de documento fictício",
        expectedAssignmentId: null,
      });
      const snapshot = (await getPgrGenerationSnapshot("org_a", I.pgrA))!;
      const sample = await createPgrReviewSample(
        author,
        I.pgrA,
        { reason: "Amostra preservada", supersedesSampleId: null },
        {
          fileName: "amostra.docx",
          storagePath: "synthetic/sample.docx",
          sizeBytes: 1,
          documentGroupId: crypto.randomUUID(),
          snapshot,
          snapshotSha256: pgrSnapshotHash(snapshot),
          templateSha256: await currentPgrTemplateHash(),
          fileSha256: "a".repeat(64),
        },
      );
      return {
        assignmentId: assignment.id,
        sampleId: sample.id,
        expectedDecisionId: null,
        status: "accepted" as const,
        reason: "Parecer técnico fictício",
      };
    }
    it("requires an independent reviewer and an actual active membership, even with a forged role", async () => {
      expect(
        documentReviewerSchema.safeParse({
          authorUserId: "author",
          reviewerUserId: "author",
          reviewer: identity,
          reason: "Teste",
          expectedAssignmentId: null,
        }).success,
      ).toBe(false);
      await expect(assignReviewer(reviewer, I.pgrA, {})).rejects.toThrow();
      await expect(
        assignReviewer({ ...reviewer, role: "owner" }, I.pgrA, {
          authorUserId: "author",
          reviewerUserId: "other",
          reviewer: identity,
          reason: "Tentativa",
          expectedAssignmentId: null,
        }),
      ).rejects.toThrow();
      expect(await admin`select id from pgr_document_approvals`).toHaveLength(0);
    });
    it("preserves legacy documents until designation, then requires the reviewer's own decision", async () => {
      await expect(assertPgrDocumentApproval("org_a", I.pgrA)).resolves.toBeUndefined();
      const input = await setup();
      await expect(assertPgrDocumentApproval("org_a", I.pgrA)).rejects.toThrow();
      await expect(approveDocument(author, I.pgrA, input)).rejects.toThrow();
      await approveDocument(reviewer, I.pgrA, input);
      await expect(assertPgrDocumentApproval("org_a", I.pgrA)).resolves.toBeUndefined();
      const [decision] =
        await admin`select actor,reviewer_user_id,source_sha256,template_sha256 from pgr_document_approvals where kind='decision'`;
      expect(decision).toMatchObject({
        actor: "reviewer",
        reviewer_user_id: "reviewer",
        source_sha256: expect.any(String),
        template_sha256: expect.any(String),
      });
    });
    it("requires review for new PGRs and prevents runtime from opting out at insert or update", async () => {
      const created = await withOrgTx(
        runtime,
        "org_a",
        (tx) =>
          tx`insert into pgr (org_id,company_id,created_by,technical_review_required) values ('org_a',${I.companyA},'author',false) returning id,technical_review_required`,
      );
      expect(created[0].technical_review_required).toBe(true);
      await expect(assertPgrDocumentApproval("org_a", created[0].id)).rejects.toThrow();
      await expect(
        withOrgTx(
          runtime,
          "org_a",
          (tx) =>
            tx`update pgr set technical_review_required=false where id=${created[0].id}`,
        ),
      ).rejects.toThrow();
    });
    it("makes changed source facts require a new sample and review, without rewriting old decisions", async () => {
      const input = await setup();
      await approveDocument(reviewer, I.pgrA, input);
      await admin`update risks set description='Risco fictício alterado' where id=${I.riskA}`;
      await expect(assertPgrDocumentApproval("org_a", I.pgrA)).rejects.toThrow();
      expect(
        await admin`select id from pgr_document_approvals where kind='decision'`,
      ).toHaveLength(1);
    });
    it("serializes competing decisions and rejects stale submissions", async () => {
      const input = await setup();
      const results = await Promise.allSettled([
        approveDocument(reviewer, I.pgrA, input),
        approveDocument(reviewer, I.pgrA, { ...input, status: "changes_requested" }),
      ]);
      expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      expect(
        await admin`select id from pgr_document_approvals where kind='decision'`,
      ).toHaveLength(1);
    });
    it("enforces tenant isolation and append-only grants directly in RLS", async () => {
      const input = await setup();
      await expect(
        approveDocument({ ...reviewer, tenantId: "org_b" }, I.pgrA, input),
      ).rejects.toThrow();
      expect(
        await withOrgTx(
          runtime,
          "org_b",
          (tx) => tx`select id from pgr_document_approvals`,
        ),
      ).toHaveLength(0);
      await expect(
        withOrgTx(
          runtime,
          "org_a",
          (tx) => tx`update pgr_document_approvals set status='accepted'`,
        ),
      ).rejects.toThrow();
      await expect(
        withOrgTx(runtime, "org_a", (tx) => tx`delete from pgr_document_approvals`),
      ).rejects.toThrow();
    });
    it("supports a restricted reviewer on Free, isolates another PGR in the same company and revokes future access", async () => {
      const added = await registerRestrictedReviewer(author, I.pgrA, {
        email: "external@example.invalid",
      });
      expect(added).toMatchObject({
        userId: "external",
        reviewPath: expect.stringContaining("reviewOrg=org_a"),
      });
      const [membership] =
        await admin`select role,scoped_company_id from org_memberships where user_id='external' and org_id='org_a'`;
      expect(membership).toMatchObject({ role: "client", scoped_company_id: I.companyA });
      expect((await admin`select plan from orgs where id='org_a'`)[0].plan).toBe("free");
      const client = { ...author, userId: "external", role: "client" };
      const input = await setup("external");
      expect((await documentApprovalOverview(client, I.pgrA)).canReview).toBe(true);
      expect((await getReviewSample(client, I.pgrA, input.sampleId)).sample.id).toBe(
        input.sampleId,
      );
      await approveDocument(client, I.pgrA, input);
      await admin`insert into pgr (id,org_id,company_id,created_by) values (${I.pgrA2},'org_a',${I.companyA},'author')`;
      await assignReviewer(author, I.pgrA2, {
        authorUserId: "author",
        reviewerUserId: "reviewer",
        reviewer: identity,
        reason: "Documento diferente na mesma empresa",
        expectedAssignmentId: null,
      });
      await expect(documentApprovalOverview(client, I.pgrA2)).rejects.toThrow();
      expect(
        await withOrgTx(runtime, "org_a", async (tx) => {
          await tx`select set_config('app.current_actor','external',true)`;
          return tx`select id from pgr_document_approvals where pgr_id=${I.pgrA2}`;
        }),
      ).toHaveLength(0);
      const previousApp = process.env.APP_ENV,
        previousBypass = process.env.DEV_API_AUTH_BYPASS;
      process.env.APP_ENV = "test";
      process.env.DEV_API_AUTH_BYPASS = "true";
      try {
        expect(
          (
            await companyList(
              new NextRequest("http://localhost/api/v1/companies", {
                headers: {
                  "x-dev-tenant": "org_a",
                  "x-dev-role": "client",
                  "x-dev-user": "external",
                },
              }),
            )
          ).status,
        ).toBe(403);
      } finally {
        if (previousApp === undefined) delete process.env.APP_ENV;
        else process.env.APP_ENV = previousApp;
        if (previousBypass === undefined) delete process.env.DEV_API_AUTH_BYPASS;
        else process.env.DEV_API_AUTH_BYPASS = previousBypass;
      }
      await revokeRestrictedReviewer(author, I.pgrA, { userId: "external" });
      await expect(documentApprovalOverview(client, I.pgrA)).rejects.toThrow();
      expect(
        await admin`select id from pgr_document_approvals where kind='decision'`,
      ).toHaveLength(1);
      expect(
        await withOrgTx(runtime, "org_a", async (tx) => {
          await tx`select set_config('app.current_actor','external',true)`;
          return tx`select id from pgr_review_samples`;
        }),
      ).toHaveLength(0);
    });
  },
);
