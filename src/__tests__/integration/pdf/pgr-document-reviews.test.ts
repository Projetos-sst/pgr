import type postgres from "postgres";
import { createHash } from "node:crypto";
import { NextRequest } from "next/server";
jest.mock("@/shared/db/env", () => ({
  getDatabaseUrl: () => process.env.INTEGRATION_APP_RUNTIME_URL,
}));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("@/shared/auth/require-office-staff", () => ({
  OFFICE_STAFF_ROLES: new Set(["owner", "collaborator"]),
  requireOfficeStaff: jest.fn().mockResolvedValue({
    tenantId: "org_a",
    userId: "owner",
    role: "owner",
    plan: "free",
  }),
}));
const uploaded: File[] = [];
const remove = jest.fn().mockResolvedValue(undefined);
jest.mock("@/shared/integrations/storage/documents-storage", () => ({
  ...jest.requireActual("@/shared/integrations/storage/documents-storage"),
  putDocumentObject: jest.fn(
    async (orgId: string, group: string, _version: number, file: File) => {
      uploaded.push(file);
      return {
        storagePath: `${orgId}/documentos/${group}/sample.docx`,
        sizeBytes: file.size,
      };
    },
  ),
  removeDocumentObject: (path: string) => remove(path),
}));
jest.mock("@/shared/integrations/storage/company-logo-storage", () => ({
  downloadCompanyLogo: jest.fn().mockResolvedValue(null),
}));
import { adminClient, applyMigrations, withOrgTx } from "../_helpers/db";
import { seedPgrBase, PGR_IDS as I } from "../_helpers/pgr-seed";
import {
  createReviewSample,
  recordReviewDecision,
  getReviewSample,
  listReviewSamples,
} from "@/shared/server/pgr/document-review-core";
import { createReviewSampleAction } from "@/shared/server/actions/pgr/document-reviews";
import { deleteDocument } from "@/shared/db/repositories/documents";
import { POST } from "@/app/api/v1/pgr/[id]/reviews/route";
import { POST as DECIDE } from "@/app/api/v1/pgr/[id]/reviews/[sampleId]/decisions/route";
const enabled = !!process.env.INTEGRATION_APP_RUNTIME_URL;
const owner = {
  tenantId: "org_a",
  userId: "owner",
  role: "owner",
  plan: "free" as const,
};
const sampleInput = { reason: "Amostra fictícia para revisão", supersedesSampleId: null };
const decision = {
  expectedLatestDecisionId: null,
  status: "accepted",
  reviewer: {
    fullName: "Avaliador fictício",
    profession: "Profissão declarada",
    registration: { kind: "registered", council: "Órgão declarado", number: "123" },
  },
  reviewedAt: "2026-01-01T10:00:00Z",
  evidenceReference: "GED:parecer-fictício",
  reason: "Parecer externo fictício recebido",
  findings: [],
};
const finding = {
  key: "ACH-1",
  location: "Inventário",
  description: "Corrigir descrição",
  severity: "blocking",
  resolution: "open",
  correctionReference: null,
};
const req = (body: unknown, role = "owner") =>
  new NextRequest("http://localhost/api/v1/pgr/reviews", {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      "x-dev-tenant": "org_a",
      "x-dev-user": "owner",
      "x-dev-role": role,
    },
  });
(enabled ? describe : describe.skip)("PGR review samples and received opinions", () => {
  let admin: ReturnType<typeof postgres>, runtime: ReturnType<typeof postgres>;
  const oldEnv = { ...process.env };
  beforeAll(async () => {
    admin = adminClient();
    await admin`set client_min_messages=warning`;
    await applyMigrations(admin);
    runtime = (await import("postgres")).default(
      process.env.INTEGRATION_APP_RUNTIME_URL!,
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
    await admin`insert into users (id,email) values ('owner','owner@example.test')`;
    await admin`insert into org_memberships (org_id,user_id,role) values ('org_a','owner','owner')`;
    uploaded.length = 0;
    remove.mockClear();
    process.env.APP_ENV = "local";
    process.env.DEV_API_AUTH_BYPASS = "true";
  });
  it("preserves exact DOCX bytes, source snapshot and pending review without inventing approval", async () => {
    const sample = await createReviewSample(owner, I.pgrA, sampleInput);
    expect(sample.fileSha256).toBe(
      createHash("sha256")
        .update(Buffer.from(await uploaded[0].arrayBuffer()))
        .digest("hex"),
    );
    expect((await getReviewSample(owner, I.pgrA, sample.id)).latestDecision).toBeNull();
    await admin`update risks set description='Correção posterior' where id=${I.riskA}`;
    const original = await getReviewSample(owner, I.pgrA, sample.id);
    expect(original.sourceChanged).toBe(true);
    expect(JSON.stringify(original.sample.snapshot)).not.toContain("Correção posterior");
    await expect(deleteDocument("org_a", sample.documentId)).rejects.toMatchObject({
      code: "IN_USE",
    });
    expect(remove).not.toHaveBeenCalled();
  });
  it("records reviewer identity separately from the owner and keeps old opinions after source changes", async () => {
    const sample = await createReviewSample(owner, I.pgrA, sampleInput);
    await admin`update risks set description='Outra versão' where id=${I.riskA}`;
    const received = await recordReviewDecision(owner, I.pgrA, sample.id, decision);
    expect(received.recordedBy).toBe("owner");
    expect(received.data.reviewer.fullName).toBe(decision.reviewer.fullName);
    expect((await getReviewSample(owner, I.pgrA, sample.id)).history.total).toBe(1);
  });
  it("requires correction references and carries all prior findings into revalidation", async () => {
    const first = await createReviewSample(owner, I.pgrA, sampleInput);
    await recordReviewDecision(owner, I.pgrA, first.id, {
      ...decision,
      status: "changes_requested",
      findings: [finding],
    });
    await admin`update risks set description='Descrição corrigida' where id=${I.riskA}`;
    const next = await createReviewSample(owner, I.pgrA, {
      ...sampleInput,
      supersedesSampleId: first.id,
    });
    expect((await getReviewSample(owner, I.pgrA, next.id)).previousFindings).toHaveLength(
      1,
    );
    await expect(
      recordReviewDecision(owner, I.pgrA, next.id, decision),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    await recordReviewDecision(owner, I.pgrA, next.id, {
      ...decision,
      findings: [
        {
          ...finding,
          resolution: "resolved",
          correctionReference: "PR e parecer fictícios de revalidação",
        },
      ],
    });
    expect((await listReviewSamples(owner, I.pgrA)).total).toBe(2);
  });
  it("protects recording permissions, tenant, future dates and concurrent decisions", async () => {
    const sample = await createReviewSample(owner, I.pgrA, sampleInput);
    await expect(
      recordReviewDecision(
        { ...owner, role: "collaborator" },
        I.pgrA,
        sample.id,
        decision,
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      getReviewSample({ ...owner, tenantId: "org_b" }, I.pgrA, sample.id),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      recordReviewDecision(owner, I.pgrA, sample.id, {
        ...decision,
        reviewedAt: "2099-01-01T00:00:00Z",
      }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    const attempts = await Promise.allSettled([
      recordReviewDecision(owner, I.pgrA, sample.id, decision),
      recordReviewDecision(owner, I.pgrA, sample.id, decision),
    ]);
    expect(attempts.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  });
  it("rolls back both document and sample and compensates the uploaded object on DB failure", async () => {
    await admin`revoke insert on pgr_review_samples from app_runtime`;
    try {
      await expect(createReviewSample(owner, I.pgrA, sampleInput)).rejects.toBeDefined();
      expect(
        await admin`select id from documents where doc_type='PGR — amostra de revisão'`,
      ).toHaveLength(0);
      expect(remove).toHaveBeenCalledTimes(1);
    } finally {
      await admin`grant insert on pgr_review_samples to app_runtime`;
    }
  });
  it("keeps snapshots/opinions immutable and blocks clients and disabled modules", async () => {
    await createReviewSample(owner, I.pgrA, sampleInput);
    await expect(
      withOrgTx(
        runtime,
        "org_a",
        (tx) => tx`update pgr_review_samples set reason='forged'`,
      ),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      withOrgTx(runtime, "org_a", (tx) => tx`delete from pgr_review_decisions`),
    ).rejects.toMatchObject({ code: "42501" });
    expect(
      (
        await POST(req(sampleInput, "client"), {
          params: Promise.resolve({ id: I.pgrA }),
        })
      ).status,
    ).toBe(403);
    await admin`update company_modules set enabled=false where company_id=${I.companyA} and module='pgr'`;
    await expect(createReviewSample(owner, I.pgrA, sampleInput)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
  it("supports the same workflow through Server Actions and HTTP", async () => {
    const action = await createReviewSampleAction(I.pgrA, sampleInput);
    expect(action.ok).toBe(true);
    const response = await POST(req(sampleInput), {
      params: Promise.resolve({ id: I.pgrA }),
    });
    expect(response.status).toBe(201);
    const sample = await response.json();
    expect(
      (
        await DECIDE(req(decision), {
          params: Promise.resolve({ id: I.pgrA, sampleId: sample.id }),
        })
      ).status,
    ).toBe(201);
  });
});
