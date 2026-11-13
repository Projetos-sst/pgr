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
jest.mock("@/shared/integrations/storage/documents-storage", () => ({
  ...jest.requireActual("@/shared/integrations/storage/documents-storage"),
  putDocumentObject: jest.fn(async (orgId: string, group: string) => ({
    storagePath: `${orgId}/documentos/${group}/sample.docx`,
    sizeBytes: 1,
  })),
  removeDocumentObject: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("@/shared/integrations/storage/company-logo-storage", () => ({
  downloadCompanyLogo: jest.fn().mockResolvedValue(null),
}));
import { adminClient, applyMigrations } from "../_helpers/db";
import { seedPgrBase, PGR_IDS as I } from "../_helpers/pgr-seed";
import type { TenantContext } from "@/shared/auth/require-tenant-context";
import { DEFAULT_TITLES } from "@/shared/domains/pgr/pgr-docx/defaults";
import { canonicalPgrDocxTexts } from "@/shared/domains/pgr/pgr-docx/text-overrides";
import { extractDocxText } from "@/shared/integrations/docx/template-engine";
import { runAsActor } from "@/shared/db/session-actor";
import {
  listPgrDocxTextVersions,
  savePgrDocxTextVersion,
} from "@/shared/server/pgr/pgr-docx-texts-core";
import {
  listPgrDocxTextVersionsAction,
  savePgrDocxTextVersionAction,
} from "@/shared/server/actions/pgr/pgr-docx-texts";
import {
  createReviewSample,
  getReviewSample,
} from "@/shared/server/pgr/document-review-core";
import { getPgrReadiness } from "@/shared/server/pgr/pgr-readiness-core";
import { generatePgrDocx } from "@/shared/server/platform/pgr-docx-core";
import { GET, POST } from "@/app/api/v1/pgr/[id]/docx-texts/route";

const enabled = !!process.env.INTEGRATION_APP_RUNTIME_URL;
const member = (
  tenantId: string,
  userId: string,
  role: "owner" | "collaborator",
): TenantContext => ({ tenantId, userId, role, plan: "free" });
const owner: TenantContext = member("org_a", "owner", "owner");
const scoped: TenantContext = member("org_a", "scoped", "collaborator");
const outsider: TenantContext = member("org_b", "owner_b", "owner");
const OTHER_COMPANY = "11111111-1111-1111-1111-1111111111c9";
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
const STANDARD_SHA = sha256(canonicalPgrDocxTexts({}));
const edited = {
  reason: "Ajuste de redação pedido pelo responsável técnico",
  overrides: {
    titles: {
      introduction: "1 - APRESENTAÇÃO DO PROGRAMA",
      objective: DEFAULT_TITLES.objective,
    },
    texts: { objective: "Objetivo reescrito pelo responsável de {empresa}." },
  },
};
const acting = <T>(ctx: TenantContext, run: () => Promise<T>) =>
  runAsActor(ctx.userId, run);
const params = { params: Promise.resolve({ id: I.pgrA }) };
const request = (method: "GET" | "POST", role: string, body?: unknown) =>
  new NextRequest("http://localhost/api/v1/pgr/docx-texts", {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      "x-dev-tenant": "org_a",
      "x-dev-user": "owner",
      "x-dev-role": role,
    },
  });

(enabled ? describe : describe.skip)("textos padrão editáveis do PGR", () => {
  let admin: ReturnType<typeof postgres>;
  let runtime: ReturnType<typeof postgres>;
  const oldEnv = { ...process.env };

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
        ('owner','owner@example.test'), ('scoped','scoped@example.test'),
        ('owner_b','owner-b@example.test');
      insert into org_memberships (org_id,user_id,role) values
        ('org_a','owner','owner'), ('org_a','scoped','collaborator'),
        ('org_b','owner_b','owner');
      insert into companies (id,org_id,cnpj,razao_social) values
        ('${OTHER_COMPANY}','org_a','11444777000161','Outra Ltda');
      insert into member_access_scopes (org_id,user_id,company_id,area,granted_by)
        values ('org_a','scoped','${OTHER_COMPANY}','safety','owner');
    `);
    process.env.APP_ENV = "local";
    process.env.DEV_API_AUTH_BYPASS = "true";
  });

  it("guarda só o que difere do padrão, com autor, motivo, hash e número de versão", async () => {
    const saved = await acting(owner, () =>
      savePgrDocxTextVersion(owner, I.pgrA, edited),
    );
    expect(saved.version).toBe(1);
    expect(saved.createdBy).toBe("owner");
    expect(saved.reason).toBe(edited.reason);
    expect(saved.overrides).toEqual({
      titles: { introduction: "1 - APRESENTAÇÃO DO PROGRAMA" },
      texts: edited.overrides.texts,
    });
    expect(saved.textsSha256).toBe(sha256(canonicalPgrDocxTexts(saved.overrides)));
    expect(saved.textsSha256).not.toBe(STANDARD_SHA);
  });

  it("cada salvamento é uma versão nova; o histórico não perde a anterior", async () => {
    const first = await acting(owner, () =>
      savePgrDocxTextVersion(owner, I.pgrA, edited),
    );
    const second = await acting(owner, () =>
      savePgrDocxTextVersion(owner, I.pgrA, {
        reason: "Voltar ao texto padrão",
        overrides: {},
      }),
    );
    const list = await acting(owner, () => listPgrDocxTextVersions(owner, I.pgrA));
    expect(list.total).toBe(2);
    expect(list.rows.map((row) => [row.version, row.id])).toEqual([
      [2, second.id],
      [1, first.id],
    ]);
    expect(list.currentTextsSha256).toBe(STANDARD_SHA);
    expect(second.overrides).toEqual({});
  });

  it("PGR sem edição usa o padrão e registra o hash do texto padrão na geração", async () => {
    const generated = await generatePgrDocx("org_a", I.pgrA, { format: "docx" });
    expect(generated.provenance.textsSha256).toBe(STANDARD_SHA);
    expect(generated.reviewSnapshot?.textVersion).toBeNull();
    expect(extractDocxText(generated.file)).toContain(DEFAULT_TITLES.introduction);
  });

  it("a geração usa a versão salva e registra qual versão e qual hash foram usados", async () => {
    const saved = await acting(owner, () =>
      savePgrDocxTextVersion(owner, I.pgrA, edited),
    );
    const generated = await generatePgrDocx("org_a", I.pgrA, { format: "docx" });
    const text = extractDocxText(generated.file);
    expect(text).toContain("1 - APRESENTAÇÃO DO PROGRAMA");
    expect(text).not.toContain(DEFAULT_TITLES.introduction);
    expect(text).toContain("Objetivo reescrito pelo responsável");
    expect(text).not.toContain("{empresa}");
    expect(generated.provenance.textsSha256).toBe(saved.textsSha256);
    expect(generated.reviewSnapshot?.textVersion).toMatchObject({
      id: saved.id,
      textsSha256: saved.textsSha256,
      createdBy: "owner",
    });
  });

  it("mudar o texto muda a versão do documento: conferência e amostra anteriores ficam desatualizadas", async () => {
    const before = (await getPgrReadiness("org_a", I.pgrA)).sourceSha256;
    const sample = await acting(owner, () =>
      createReviewSample(owner, I.pgrA, {
        reason: "Amostra fictícia antes da edição",
        supersedesSampleId: null,
      }),
    );
    expect((await getReviewSample(owner, I.pgrA, sample.id)).sourceChanged).toBe(false);
    const saved = await acting(owner, () =>
      savePgrDocxTextVersion(owner, I.pgrA, edited),
    );
    expect((await getPgrReadiness("org_a", I.pgrA)).sourceSha256).not.toBe(before);
    expect((await getReviewSample(owner, I.pgrA, sample.id)).sourceChanged).toBe(true);
    const next = await acting(owner, () =>
      createReviewSample(owner, I.pgrA, {
        reason: "Amostra fictícia depois da edição",
        supersedesSampleId: sample.id,
      }),
    );
    expect(JSON.stringify(next.snapshot)).toContain(saved.id);
    expect(JSON.stringify(sample.snapshot)).not.toContain(saved.id);
  });

  it("alteração avulsa vale só na prévia; a emissão final recusa texto fora da versão salva", async () => {
    const saved = await acting(owner, () =>
      savePgrDocxTextVersion(owner, I.pgrA, edited),
    );
    const adHoc = { titles: { objective: "2 - PROPÓSITO" } };
    const preview = await generatePgrDocx("org_a", I.pgrA, {
      format: "docx",
      overrides: adHoc,
    });
    const text = extractDocxText(preview.file);
    expect(text).toContain("2 - PROPÓSITO");
    expect(text).toContain("1 - APRESENTAÇÃO DO PROGRAMA");
    expect(preview.provenance.textsSha256).not.toBe(saved.textsSha256);
    await expect(
      generatePgrDocx("org_a", I.pgrA, {
        purpose: "issue",
        expectedSourceSha256: (await getPgrReadiness("org_a", I.pgrA)).sourceSha256,
        overrides: adHoc,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("PGR publicado não aceita nova versão de texto", async () => {
    await admin`update pgr set published_at=now() where id=${I.pgrA}`;
    await expect(
      acting(owner, () => savePgrDocxTextVersion(owner, I.pgrA, edited)),
    ).rejects.toMatchObject({ code: "ALREADY_SIGNED" });
    expect((await admin`select 1 from pgr_docx_text_versions`).length).toBe(0);
  });

  it("outro escritório e membro fora do escopo não leem nem gravam", async () => {
    await acting(owner, () => savePgrDocxTextVersion(owner, I.pgrA, edited));
    for (const ctx of [outsider, scoped]) {
      await expect(
        acting(ctx, () => listPgrDocxTextVersions(ctx, I.pgrA)),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(
        acting(ctx, () => savePgrDocxTextVersion(ctx, I.pgrA, edited)),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    }
    expect((await admin`select 1 from pgr_docx_text_versions`).length).toBe(1);
  });

  it("no banco o histórico é só de inserção e o autor é o ator da sessão", async () => {
    await acting(owner, () => savePgrDocxTextVersion(owner, I.pgrA, edited));
    const asActor = <T>(
      actor: string,
      run: (tx: postgres.TransactionSql) => Promise<T>,
    ) =>
      runtime.begin(async (tx) => {
        await tx`select set_config('app.current_org','org_a',true), set_config('app.current_actor',${actor},true)`;
        return run(tx);
      });
    await expect(
      asActor("owner", (tx) => tx`update pgr_docx_text_versions set reason='x'`),
    ).rejects.toThrow(/permission denied/);
    await expect(
      asActor("owner", (tx) => tx`delete from pgr_docx_text_versions`),
    ).rejects.toThrow(/permission denied/);
    await expect(
      asActor(
        "owner",
        (tx) =>
          tx`insert into pgr_docx_text_versions (org_id,pgr_id,overrides,texts_sha256,reason,created_by)
             values ('org_a',${I.pgrA},'{}',${STANDARD_SHA},'Forjado','scoped')`,
      ),
    ).rejects.toThrow(/row-level security/);
    await expect(
      asActor(
        "scoped",
        (tx) =>
          tx`insert into pgr_docx_text_versions (org_id,pgr_id,overrides,texts_sha256,reason,created_by)
             values ('org_a',${I.pgrA},'{}',${STANDARD_SHA},'Fora do escopo','scoped')`,
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("Server Action e REST: 201 ao salvar, lista, 422 em chave desconhecida, 403 para representante", async () => {
    const action = await savePgrDocxTextVersionAction(I.pgrA, edited);
    expect(action).toMatchObject({ ok: true, data: { version: 1 } });
    const created = await POST(
      request("POST", "owner", { reason: "Pela API", overrides: {} }),
      params,
    );
    expect(created.status).toBe(201);
    expect(await created.json()).toMatchObject({ version: 2, textsSha256: STANDARD_SHA });
    const listed = await GET(request("GET", "owner"), params);
    expect(listed.status).toBe(200);
    expect(await listed.json()).toMatchObject({
      total: 2,
      currentTextsSha256: STANDARD_SHA,
    });
    expect(await listPgrDocxTextVersionsAction(I.pgrA)).toMatchObject({
      ok: true,
      data: { total: 2 },
    });
    const invalid = await POST(
      request("POST", "owner", {
        reason: "Chave inválida",
        overrides: { titles: { inexistente: "x" } },
      }),
      params,
    );
    expect(invalid.status).toBe(422);
    expect((await GET(request("GET", "client"), params)).status).toBe(403);
    expect(
      (await POST(request("POST", "client", { reason: "x", overrides: {} }), params))
        .status,
    ).toBe(403);
  });
});
