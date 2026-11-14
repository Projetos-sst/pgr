import type postgres from "postgres";
import { createHash } from "node:crypto";
import { NextRequest } from "next/server";
import PizZip from "pizzip";

jest.mock("@/shared/db/env", () => ({
  getDatabaseUrl: () => process.env.INTEGRATION_APP_RUNTIME_URL,
}));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
const mockStaff = jest.fn();
jest.mock("@/shared/auth/require-office-staff", () => ({
  OFFICE_STAFF_ROLES: new Set(["owner", "collaborator"]),
  requireOfficeStaff: () => mockStaff(),
}));
type Stored = { status: "found"; bytes: Buffer } | { status: "unavailable" };
const mockObjects = new Map<string, Stored>();
jest.mock("@/shared/integrations/storage/documents-storage", () => ({
  ...jest.requireActual("@/shared/integrations/storage/documents-storage"),
  downloadDocumentObject: jest.fn(
    async (path: string) => mockObjects.get(path) ?? { status: "missing" },
  ),
}));

import { adminClient, applyMigrations } from "../_helpers/db";
import { seedPgrBase, PGR_IDS as I } from "../_helpers/pgr-seed";
import type { TenantContext } from "@/shared/auth/require-tenant-context";
import { runAsActor } from "@/shared/db/session-actor";
import { PROPOSED_RETENTION_TERMS } from "@/shared/domains/retention/policy";
import type { ExportManifest } from "@/shared/domains/retention/export-manifest";
import {
  assertDiscardAuthorized,
  getRetentionPolicy,
  recordRetentionPolicyVersion,
  simulateRetention,
} from "@/shared/server/retention/retention-core";
import {
  exportPgrRetentionPackage,
  listPgrRetentionExports,
} from "@/shared/server/retention/retention-export-core";
import {
  getRetentionPolicyAction,
  listPgrRetentionExportsAction,
  recordRetentionPolicyVersionAction,
  simulateRetentionAction,
} from "@/shared/server/actions/retention/retention";
import * as policyRoute from "@/app/api/v1/retention-policy/route";
import * as simulationRoute from "@/app/api/v1/retention-policy/simulation/route";
import * as exportRoute from "@/app/api/v1/pgr/[id]/retention-exports/route";

const enabled = !!process.env.INTEGRATION_APP_RUNTIME_URL;
const member = (
  tenantId: string,
  userId: string,
  role: "owner" | "collaborator",
): TenantContext => ({ tenantId, userId, role, plan: "free" });
const owner = member("org_a", "owner", "owner");
const collaborator = member("org_a", "collab", "collaborator");
const scoped = member("org_a", "scoped", "collaborator");
const outsider = member("org_b", "owner_b", "owner");
const acting = <T>(ctx: TenantContext, run: () => Promise<T>) =>
  runAsActor(ctx.userId, run);
const sha256 = (value: Uint8Array | string) =>
  createHash("sha256").update(value).digest("hex");

const OTHER_COMPANY = "11111111-1111-1111-1111-1111111111c9";
const GROUP = "33333333-3333-4333-8333-333333333301";
const DOC_V1 = "33333333-3333-4333-8333-333333333311";
const DOC_V2 = "33333333-3333-4333-8333-333333333312";
const DOC_PENDING = "33333333-3333-4333-8333-333333333313";
const SAMPLE = "33333333-3333-4333-8333-333333333321";
const SIGNATURE = "33333333-3333-4333-8333-333333333331";
const PATH_V1 = `org_a/documentos/${GROUP}/v1-pgr.docx`;
const PATH_V2 = `org_a/documentos/${GROUP}/v2-pgr.docx`;
const FILE_V1 = Buffer.from("conteudo da versao 1");
const FILE_V2 = Buffer.from("conteudo da versao 2");
const FILE_PATH_V1 = `files/${GROUP}/v1-${DOC_V1}.docx`;
const FILE_PATH_V2 = `files/${GROUP}/v2-${DOC_V2}.docx`;
const RECORD_PATHS = [
  "records/documents.json",
  "records/pgr.json",
  "records/pgr_document_approvals.json",
  "records/pgr_docx_text_versions.json",
  "records/pgr_review_decisions.json",
  "records/pgr_review_samples.json",
  "records/pgr_revisions.json",
  "records/signature_captures.json",
  "records/signature_requests.json",
];
const approval = {
  approverName: "Maria Responsável",
  approverRole: "Sócia administradora",
  approvedOn: "2026-11-10",
  reference: "Ata de 10/11/2026",
};
const proposed = { status: "proposed" as const, terms: PROPOSED_RETENTION_TERMS };
const approved = {
  status: "approved" as const,
  terms: PROPOSED_RETENTION_TERMS,
  approval,
};
const params = (id: string = I.pgrA) => ({ params: Promise.resolve({ id }) });
const request = (
  url: string,
  method: "GET" | "POST",
  role: string,
  body?: unknown,
  tenant = "org_a",
) =>
  new NextRequest(`http://localhost${url}`, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      "x-dev-tenant": tenant,
      "x-dev-user": tenant === "org_a" ? "owner" : "owner_b",
      "x-dev-role": role,
    },
  });
const unzip = (file: Buffer) => {
  const zip = new PizZip(file);
  const manifest: ExportManifest = JSON.parse(zip.file("manifest.json")?.asText() ?? "");
  return { zip, manifest, paths: Object.keys(zip.files).sort() };
};
const code = (run: () => Promise<unknown>) =>
  run().then(
    () => "resolved",
    (error: { code?: string }) => error.code,
  );

(enabled ? describe : describe.skip)("guarda, exportação e descarte", () => {
  let admin: ReturnType<typeof postgres>;
  let runtime: ReturnType<typeof postgres>;
  const oldEnv = { ...process.env };

  const exportsOf = (pgrId: string = I.pgrA) =>
    admin<
      { status: string; content_sha256: string | null; exported_by: string }[]
    >`select status, content_sha256, exported_by, missing_count, hash_mismatch_count, failure_reason
        from retention_exports where pgr_id = ${pgrId} order by seq`;
  const asRuntime = (userId: string, statement: string) =>
    runtime.begin(async (tx) => {
      await tx`select set_config('app.current_org','org_a',true), set_config('app.current_actor',${userId},true)`;
      return tx.unsafe(statement);
    });

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
      insert into users (id,email) values
        ('owner','owner@example.test'), ('collab','collab@example.test'),
        ('scoped','scoped@example.test'), ('owner_b','owner-b@example.test');
      insert into org_memberships (org_id,user_id,role) values
        ('org_a','owner','owner'), ('org_a','collab','collaborator'),
        ('org_a','scoped','collaborator'), ('org_b','owner_b','owner');
      insert into companies (id,org_id,cnpj,razao_social) values
        ('${OTHER_COMPANY}','org_a','11444777000161','Outra Ltda');
      insert into member_access_scopes (org_id,user_id,company_id,area,granted_by)
        values ('org_a','scoped','${OTHER_COMPANY}','safety','owner');
      insert into documents (id,org_id,document_group_id,name,doc_type,version,status,storage_path,size_bytes,related_entity_type,related_entity_id) values
        ('${DOC_V1}','org_a','${GROUP}','PGR','PGR — amostra de revisão',1,'ready','${PATH_V1}',${FILE_V1.byteLength},'pgr','${I.pgrA}'),
        ('${DOC_V2}','org_a','${GROUP}','PGR','PGR — amostra de revisão',2,'ready','${PATH_V2}',${FILE_V2.byteLength},'pgr','${I.pgrA}'),
        ('${DOC_PENDING}','org_a','${GROUP}','PGR','PGR',3,'generating','org_a/documentos/generated/pending.pdf',0,'pgr','${I.pgrA}');
      insert into pgr_review_samples (id,org_id,pgr_id,document_id,snapshot,snapshot_sha256,template_sha256,file_sha256,created_by,reason) values
        ('${SAMPLE}','org_a','${I.pgrA}','${DOC_V1}','{}','${"a".repeat(64)}','${"b".repeat(64)}','${sha256(FILE_V1)}','owner','Amostra inicial');
      insert into pgr_review_decisions (org_id,sample_id,status,data,recorded_by) values
        ('org_a','${SAMPLE}','accepted','{"reviewerName":"Revisor"}','owner');
      insert into pgr_document_approvals (org_id,pgr_id,kind,actor,reason) values
        ('org_a','${I.pgrA}','required','owner','Revisão exigida');
      insert into pgr_docx_text_versions (org_id,pgr_id,overrides,texts_sha256,reason,created_by) values
        ('org_a','${I.pgrA}','{}','${"c".repeat(64)}','Texto inicial','owner');
      insert into signature_requests (id,org_id,target_type,target_id,token_hash,payload,status,expires_at) values
        ('${SIGNATURE}','org_a','pgr','${I.pgrA}','segredo-do-token','{"companyName":"A Ltda"}','signed', now() + interval '1 day');
      insert into signature_captures (org_id,request_id,image_data,signer_name,method) values
        ('org_a','${SIGNATURE}','data:image/png;base64,AAAA','Fulano Signatário','link');
    `);
    mockObjects.clear();
    mockObjects.set(PATH_V1, { status: "found", bytes: FILE_V1 });
    mockObjects.set(PATH_V2, { status: "found", bytes: FILE_V2 });
    mockStaff.mockReset();
    mockStaff.mockResolvedValue(owner);
    process.env.APP_ENV = "local";
    process.env.DEV_API_AUTH_BYPASS = "true";
  });

  describe("registro da política", () => {
    it("sem versão registrada o estado é não aprovada e a proposta fica disponível", async () => {
      const policy = await acting(owner, () => getRetentionPolicy(owner));
      expect(policy.state).toEqual({ status: "not_approved", reason: "no_policy" });
      expect(policy.current).toBeNull();
      expect(policy.total).toBe(0);
      expect(policy.proposal).toEqual(PROPOSED_RETENTION_TERMS);
      expect(policy.canRecord).toBe(true);
    });

    it("versão proposta não aprova; versão aprovada guarda quem aprovou, cargo, data e referência", async () => {
      const first = await acting(owner, () =>
        recordRetentionPolicyVersion(owner, proposed),
      );
      expect(first).toMatchObject({
        version: 1,
        status: "proposed",
        recordedBy: "owner",
      });
      expect(first.approverName).toBeNull();
      const afterProposal = await acting(owner, () => getRetentionPolicy(owner));
      expect(afterProposal.state).toEqual({
        status: "not_approved",
        reason: "latest_version_proposed",
      });

      const second = await acting(owner, () =>
        recordRetentionPolicyVersion(owner, approved),
      );
      expect(second).toMatchObject({
        version: 2,
        status: "approved",
        approverName: approval.approverName,
        approverRole: approval.approverRole,
        approvedOn: approval.approvedOn,
        approvalReference: approval.reference,
        terms: PROPOSED_RETENTION_TERMS,
      });
      const policy = await acting(collaborator, () => getRetentionPolicy(collaborator));
      expect(policy.state).toEqual({
        status: "approved",
        version: 2,
        termsSha256: second.termsSha256,
      });
      expect(policy.rows.map((row) => row.version)).toEqual([2, 1]);
      expect(policy.canRecord).toBe(false);
    });

    it("uma versão proposta registrada depois da aprovação volta o estado para não aprovada", async () => {
      await acting(owner, () => recordRetentionPolicyVersion(owner, approved));
      await acting(owner, () => recordRetentionPolicyVersion(owner, proposed));
      const policy = await acting(owner, () => getRetentionPolicy(owner));
      expect(policy.state).toEqual({
        status: "not_approved",
        reason: "latest_version_proposed",
      });
      expect(policy.total).toBe(2);
    });

    it("só o administrador registra: colaborador recebe FORBIDDEN e o banco recusa", async () => {
      expect(
        await code(() =>
          acting(collaborator, () =>
            recordRetentionPolicyVersion(collaborator, approved),
          ),
        ),
      ).toBe("FORBIDDEN");
      await expect(
        asRuntime(
          "collab",
          `insert into retention_policy_versions (org_id,status,terms,terms_sha256,recorded_by)
           values ('org_a','proposed','{}','${"d".repeat(64)}','collab')`,
        ),
      ).rejects.toMatchObject({ code: "42501" });
      const [{ total }] =
        await admin`select count(*)::int total from retention_policy_versions`;
      expect(total).toBe(0);
    });

    it("recusa aprovação com data futura e aprovação sem os dados de quem aprovou", async () => {
      expect(
        await code(() =>
          acting(owner, () =>
            recordRetentionPolicyVersion(owner, {
              ...approved,
              approval: { ...approval, approvedOn: "2999-01-01" },
            }),
          ),
        ),
      ).toBe("VALIDATION");
      await expect(
        acting(owner, () =>
          recordRetentionPolicyVersion(owner, {
            status: "approved",
            terms: proposed.terms,
          }),
        ),
      ).rejects.toMatchObject({ name: "ZodError" });
      await expect(
        admin.unsafe(
          `insert into retention_policy_versions (org_id,status,terms,terms_sha256,recorded_by)
           values ('org_a','approved','{}','${"d".repeat(64)}','owner')`,
        ),
      ).rejects.toMatchObject({ code: "23514" });
    });

    it("o histórico é somente acréscimo: o runtime não altera nem apaga versão ou exportação", async () => {
      await acting(owner, () => recordRetentionPolicyVersion(owner, approved));
      await acting(owner, () => exportPgrRetentionPackage(owner, I.pgrA));
      const statements = [
        "update retention_policy_versions set status='proposed'",
        "delete from retention_policy_versions",
        "update retention_exports set status='complete'",
        "delete from retention_exports",
      ];
      for (const statement of statements) {
        await expect(asRuntime("owner", statement)).rejects.toMatchObject({
          code: "42501",
        });
      }
    });

    it("outro escritório não enxerga a política nem herda a aprovação", async () => {
      await acting(owner, () => recordRetentionPolicyVersion(owner, approved));
      const policy = await acting(outsider, () => getRetentionPolicy(outsider));
      expect(policy.state).toEqual({ status: "not_approved", reason: "no_policy" });
      expect(policy.rows).toEqual([]);
    });
  });

  describe("simulação e trava de descarte", () => {
    const markers = { contract_end: "2020-01-31" };

    it("sem política usa a proposta, marca como provisória e bloqueia todo descarte", async () => {
      const simulation = await acting(owner, () => simulateRetention(owner, markers));
      expect(simulation.provisional).toBe(true);
      expect(simulation.termsSource).toBe("proposal");
      expect(simulation.rows[0]).toMatchObject({
        category: "pgr_documents",
        eligibleOn: "2021-01-31",
        notices: [
          { daysBefore: 90, on: "2020-11-02" },
          { daysBefore: 60, on: "2020-12-02" },
          { daysBefore: 30, on: "2021-01-01" },
        ],
      });
      expect(simulation.rows.map((row) => row.discard)).toEqual(
        simulation.rows.map(() => ({ allowed: false, reason: "policy_not_approved" })),
      );
    });

    it("a simulação lê os prazos da versão registrada, não uma constante", async () => {
      const [first, ...rest] = PROPOSED_RETENTION_TERMS.categories;
      await acting(owner, () =>
        recordRetentionPolicyVersion(owner, {
          ...approved,
          terms: {
            ...PROPOSED_RETENTION_TERMS,
            noticeDaysBefore: [15],
            categories: [{ ...first, retentionMonths: 36 }, ...rest],
          },
        }),
      );
      const simulation = await acting(owner, () => simulateRetention(owner, markers));
      expect(simulation.provisional).toBe(false);
      expect(simulation.termsSource).toBe("registered");
      expect(simulation.rows[0]).toMatchObject({
        eligibleOn: "2023-01-31",
        notices: [{ daysBefore: 15, on: "2023-01-16" }],
        discard: { allowed: true },
      });
      expect(simulation.rows[4].discard).toEqual({
        allowed: false,
        reason: "starting_point_unknown",
      });
    });

    it("a trava recusa descarte sem política aprovada e com prazo ainda correndo", async () => {
      const request = { category: "pgr_documents" as const, markers };
      const blocked = () => acting(owner, () => assertDiscardAuthorized(owner, request));
      expect(await code(blocked)).toBe("DISCARD_BLOCKED");
      await acting(owner, () => recordRetentionPolicyVersion(owner, proposed));
      expect(await code(blocked)).toBe("DISCARD_BLOCKED");
      await acting(owner, () => recordRetentionPolicyVersion(owner, approved));
      expect(await code(blocked)).toBe("resolved");
      expect(
        await code(() =>
          acting(owner, () =>
            assertDiscardAuthorized(owner, {
              category: "pgr_documents",
              markers: { contract_end: "2999-01-01" },
            }),
          ),
        ),
      ).toBe("DISCARD_BLOCKED");
      expect(
        await code(() =>
          acting(collaborator, () => assertDiscardAuthorized(collaborator, request)),
        ),
      ).toBe("FORBIDDEN");
    });

    it("recusa marco inicial com data inválida", async () => {
      await expect(
        acting(owner, () => simulateRetention(owner, { contract_end: "31/01/2027" })),
      ).rejects.toMatchObject({ name: "ZodError" });
    });
  });

  describe("exportação por PGR", () => {
    it("entrega documentos, versões, pareceres, eventos e assinaturas com hash de cada item", async () => {
      const result = await acting(owner, () => exportPgrRetentionPackage(owner, I.pgrA));
      const { zip, manifest, paths } = unzip(result.file);
      expect(paths).toEqual(
        [FILE_PATH_V1, FILE_PATH_V2, "manifest.json", ...RECORD_PATHS].sort(),
      );
      expect(manifest.status).toBe("complete");
      expect(manifest.scope).toEqual({
        type: "pgr",
        orgId: "org_a",
        pgrId: I.pgrA,
        companyId: I.companyA,
      });
      expect(manifest.exportedBy).toBe("owner");
      expect(manifest.policy).toEqual({ status: "not_approved", reason: "no_policy" });
      expect(manifest.items.map((item) => item.path)).toEqual(
        [FILE_PATH_V1, FILE_PATH_V2, ...RECORD_PATHS].sort(),
      );
      for (const item of manifest.items) {
        expect(sha256(zip.file(item.path)?.asUint8Array() ?? "")).toBe(item.sha256);
      }
      const v1 = manifest.items.find((item) => item.path === FILE_PATH_V1);
      expect(v1).toMatchObject({
        status: "ok",
        sha256: sha256(FILE_V1),
        expectedSha256: sha256(FILE_V1),
        source: { table: "documents", id: DOC_V1 },
      });
      expect(result.fileName).toBe(`pgr-${I.pgrA}-guarda.zip`);
    });

    it("os registros trazem o parecer, a versão pendente e a assinatura, sem o hash do token", async () => {
      const { zip } = unzip(
        (await acting(owner, () => exportPgrRetentionPackage(owner, I.pgrA))).file,
      );
      const read = (path: string) => zip.file(path)?.asText() ?? "";
      expect(JSON.parse(read("records/pgr_review_decisions.json"))).toEqual([
        expect.objectContaining({ sampleId: SAMPLE, status: "accepted" }),
      ]);
      expect(
        JSON.parse(read("records/documents.json")).map((row: { id: string }) => row.id),
      ).toEqual([DOC_V1, DOC_V2, DOC_PENDING]);
      expect(JSON.parse(read("records/signature_captures.json"))).toEqual([
        expect.objectContaining({ signerName: "Fulano Signatário", method: "link" }),
      ]);
      expect(read("records/signature_requests.json")).not.toContain("segredo-do-token");
      expect(JSON.parse(read("records/pgr_document_approvals.json"))).toEqual([
        expect.objectContaining({ kind: "required" }),
      ]);
    });

    it("repetir a exportação do mesmo estado gera o mesmo hash e registra cada execução", async () => {
      const first = await acting(owner, () => exportPgrRetentionPackage(owner, I.pgrA));
      const second = await acting(collaborator, () =>
        exportPgrRetentionPackage(collaborator, I.pgrA),
      );
      expect(second.manifest.contentSha256).toBe(first.manifest.contentSha256);
      expect(second.manifest.exportedBy).toBe("collab");
      expect(await exportsOf()).toEqual([
        expect.objectContaining({
          status: "complete",
          content_sha256: first.manifest.contentSha256,
          exported_by: "owner",
        }),
        expect.objectContaining({
          status: "complete",
          content_sha256: first.manifest.contentSha256,
          exported_by: "collab",
        }),
      ]);
      const history = await acting(owner, () => listPgrRetentionExports(owner, I.pgrA));
      expect(history.total).toBe(2);
      expect(history.rows.map((row) => row.exportedBy)).toEqual(["collab", "owner"]);
    });

    it("mudança no acervo muda o hash do conjunto", async () => {
      const before = await acting(owner, () => exportPgrRetentionPackage(owner, I.pgrA));
      await admin`insert into pgr_docx_text_versions (org_id,pgr_id,overrides,texts_sha256,reason,created_by)
        values ('org_a',${I.pgrA},'{}',${"e".repeat(64)},'Segunda versão','owner')`;
      const after = await acting(owner, () => exportPgrRetentionPackage(owner, I.pgrA));
      expect(after.manifest.contentSha256).not.toBe(before.manifest.contentSha256);
    });

    it("arquivo ausente no Storage: o pacote sai, o manifesto aponta o item e a exportação fica incompleta", async () => {
      mockObjects.delete(PATH_V2);
      const result = await acting(owner, () => exportPgrRetentionPackage(owner, I.pgrA));
      const { manifest, paths } = unzip(result.file);
      expect(manifest.status).toBe("incomplete");
      expect(manifest.counts).toMatchObject({ missing: 1, hashMismatch: 0 });
      expect(manifest.items.find((item) => item.path === FILE_PATH_V2)).toMatchObject({
        status: "missing",
        sha256: null,
      });
      expect(paths).not.toContain(FILE_PATH_V2);
      expect(paths).toContain(FILE_PATH_V1);
      expect(await exportsOf()).toEqual([
        expect.objectContaining({ status: "incomplete", missing_count: 1 }),
      ]);
    });

    it("arquivo diferente do hash registrado na amostra é apontado como divergente", async () => {
      mockObjects.set(PATH_V1, { status: "found", bytes: Buffer.from("adulterado") });
      const { manifest } = await acting(owner, () =>
        exportPgrRetentionPackage(owner, I.pgrA),
      );
      expect(manifest.status).toBe("incomplete");
      expect(manifest.items.find((item) => item.path === FILE_PATH_V1)).toMatchObject({
        status: "hash_mismatch",
        expectedSha256: sha256(FILE_V1),
        sha256: sha256("adulterado"),
      });
      expect(await exportsOf()).toEqual([
        expect.objectContaining({ status: "incomplete", hash_mismatch_count: 1 }),
      ]);
    });

    it("Storage indisponível: falha com erro de domínio, sem pacote, e a tentativa fica registrada", async () => {
      mockObjects.set(PATH_V2, { status: "unavailable" });
      expect(
        await code(() => acting(owner, () => exportPgrRetentionPackage(owner, I.pgrA))),
      ).toBe("EXPORT_UNAVAILABLE");
      expect(await exportsOf()).toEqual([
        expect.objectContaining({
          status: "failed",
          content_sha256: null,
          failure_reason: "storage_unavailable",
        }),
      ]);
      mockObjects.set(PATH_V2, { status: "found", bytes: FILE_V2 });
      const retry = await acting(owner, () => exportPgrRetentionPackage(owner, I.pgrA));
      expect(retry.manifest.status).toBe("complete");
      expect((await exportsOf()).map((row) => row.status)).toEqual([
        "failed",
        "complete",
      ]);
    });

    it("outro escritório e colaborador fora do escopo recebem NOT_FOUND, sem registro", async () => {
      for (const ctx of [outsider, scoped]) {
        expect(
          await code(() => acting(ctx, () => exportPgrRetentionPackage(ctx, I.pgrA))),
        ).toBe("NOT_FOUND");
        expect(
          await code(() => acting(ctx, () => listPgrRetentionExports(ctx, I.pgrA))),
        ).toBe("NOT_FOUND");
      }
      expect(await exportsOf()).toEqual([]);
    });

    it("colaborador com escopo na empresa do PGR exporta", async () => {
      await admin`insert into member_access_scopes (org_id,user_id,company_id,area,granted_by)
        values ('org_a','scoped',${I.companyA},'safety','owner')`;
      const result = await acting(scoped, () =>
        exportPgrRetentionPackage(scoped, I.pgrA),
      );
      expect(result.manifest.status).toBe("complete");
    });

    it("PGR sem arquivo, amostra nem assinatura exporta só os registros", async () => {
      await admin`insert into pgr (id,org_id,company_id) values (${I.pgrA2},'org_a',${I.companyA})`;
      const result = await acting(owner, () => exportPgrRetentionPackage(owner, I.pgrA2));
      const { manifest, paths } = unzip(result.file);
      expect(manifest.status).toBe("complete");
      expect(paths).toEqual(["manifest.json", ...RECORD_PATHS].sort());
      expect(await exportsOf(I.pgrA2)).toHaveLength(1);
      expect(await exportsOf()).toEqual([]);
    });

    it("empresa inativa continua consultável e exportável por quem tem acesso", async () => {
      await admin`update companies set status='inactive' where id=${I.companyA}`;
      const result = await acting(owner, () => exportPgrRetentionPackage(owner, I.pgrA));
      expect(result.manifest.status).toBe("complete");
      const history = await acting(collaborator, () =>
        listPgrRetentionExports(collaborator, I.pgrA),
      );
      expect(history.total).toBe(1);
    });

    it("nenhum dado do acervo é apagado pela exportação nem pela simulação", async () => {
      const counts = () =>
        admin`select (select count(*)::int from documents) documents,
          (select count(*)::int from pgr_review_samples) samples,
          (select count(*)::int from signature_captures) captures`;
      const [before] = await counts();
      await acting(owner, () => recordRetentionPolicyVersion(owner, approved));
      await acting(owner, () => simulateRetention(owner, { contract_end: "2000-01-01" }));
      await acting(owner, () => exportPgrRetentionPackage(owner, I.pgrA));
      expect((await counts())[0]).toEqual(before);
    });
  });

  describe("REST", () => {
    it("POST /pgr/{id}/retention-exports devolve o zip com os hashes no cabeçalho", async () => {
      const response = await exportRoute.POST(
        request("/api/v1/pgr/x/retention-exports", "POST", "owner"),
        params(),
      );
      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("application/zip");
      expect(response.headers.get("Content-Disposition")).toBe(
        `attachment; filename="pgr-${I.pgrA}-guarda.zip"`,
      );
      const { manifest } = unzip(Buffer.from(await response.arrayBuffer()));
      expect(response.headers.get("X-Retention-Export-Sha256")).toBe(
        manifest.contentSha256,
      );
      expect(response.headers.get("X-Retention-Export-Status")).toBe("complete");
    });

    it("representante da empresa recebe 403; PGR de outro escritório, 404; Storage fora, 503", async () => {
      const forbidden = await exportRoute.POST(
        request("/api/v1/pgr/x/retention-exports", "POST", "client"),
        params(),
      );
      expect(forbidden.status).toBe(403);
      const foreign = await exportRoute.POST(
        request("/api/v1/pgr/x/retention-exports", "POST", "owner", undefined, "org_b"),
        params(),
      );
      expect(foreign.status).toBe(404);
      const invalid = await exportRoute.POST(
        request("/api/v1/pgr/x/retention-exports", "POST", "owner"),
        params("nao-e-uuid"),
      );
      expect(invalid.status).toBe(422);
      mockObjects.set(PATH_V1, { status: "unavailable" });
      const unavailable = await exportRoute.POST(
        request("/api/v1/pgr/x/retention-exports", "POST", "owner"),
        params(),
      );
      expect(unavailable.status).toBe(503);
      expect((await unavailable.json()).error.code).toBe("EXPORT_UNAVAILABLE");
    });

    it("GET /pgr/{id}/retention-exports lista o histórico", async () => {
      await exportRoute.POST(
        request("/api/v1/pgr/x/retention-exports", "POST", "owner"),
        params(),
      );
      const response = await exportRoute.GET(
        request("/api/v1/pgr/x/retention-exports", "GET", "collaborator"),
        params(),
      );
      const body = await response.json();
      expect(response.status).toBe(200);
      expect(body.total).toBe(1);
      expect(body.rows[0]).toMatchObject({ status: "complete", exportedBy: "owner" });
    });

    it("POST /retention-policy registra a versão (201) e GET devolve o estado", async () => {
      const created = await policyRoute.POST(
        request("/api/v1/retention-policy", "POST", "owner", approved),
      );
      expect(created.status).toBe(201);
      expect(await created.json()).toMatchObject({ version: 1, status: "approved" });
      const read = await policyRoute.GET(
        request("/api/v1/retention-policy", "GET", "collaborator"),
      );
      const body = await read.json();
      expect(body.state.status).toBe("approved");
      expect(body.total).toBe(1);
      const invalid = await policyRoute.POST(
        request("/api/v1/retention-policy", "POST", "owner", { status: "approved" }),
      );
      expect(invalid.status).toBe(422);
      const client = await policyRoute.GET(
        request("/api/v1/retention-policy", "GET", "client"),
      );
      expect(client.status).toBe(403);
    });

    it("GET /retention-policy/simulation calcula as datas a partir dos marcos informados", async () => {
      const response = await simulationRoute.GET(
        request(
          "/api/v1/retention-policy/simulation?contract_end=2027-01-31",
          "GET",
          "owner",
        ),
      );
      const body = await response.json();
      expect(response.status).toBe(200);
      expect(body.provisional).toBe(true);
      expect(body.rows[0]).toMatchObject({
        eligibleOn: "2028-01-31",
        discard: { allowed: false, reason: "policy_not_approved" },
      });
      const invalid = await simulationRoute.GET(
        request(
          "/api/v1/retention-policy/simulation?contract_end=amanha",
          "GET",
          "owner",
        ),
      );
      expect(invalid.status).toBe(422);
    });
  });

  describe("Server Actions", () => {
    it("o administrador registra, consulta, simula e vê o histórico de exportações", async () => {
      const recorded = await recordRetentionPolicyVersionAction(approved);
      expect(recorded).toMatchObject({ ok: true, data: { version: 1 } });
      const policy = await getRetentionPolicyAction();
      expect(policy).toMatchObject({ ok: true, data: { state: { status: "approved" } } });
      const simulation = await simulateRetentionAction({ contract_end: "2027-01-31" });
      expect(simulation).toMatchObject({ ok: true, data: { provisional: false } });
      await acting(owner, () => exportPgrRetentionPackage(owner, I.pgrA));
      const history = await listPgrRetentionExportsAction(I.pgrA);
      expect(history).toMatchObject({ ok: true, data: { total: 1 } });
    });

    it("colaborador não registra a política pela Action", async () => {
      mockStaff.mockResolvedValue(collaborator);
      const result = await recordRetentionPolicyVersionAction(approved);
      expect(result).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    });
  });
});
