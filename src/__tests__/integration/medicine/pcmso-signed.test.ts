/**
 * PCMSO assinado arquivado (NOB-166) contra Postgres efêmero. Storage simulado; banco, RLS e regras
 * reais:
 * - fluxo do coordenador: só a conta vinculada e verificada do médico responsável designado;
 * - fluxo do escritório: equipe arquiva o documento assinado pelo coordenador designado;
 * - prévia mais recente da empresa, plano aprovado vigente, datas coerentes, PDF e conferência;
 * - substituição com tipo de mudança (MED-14) e motivo; alertas de desatualização;
 * - SQL direto, outro tenant, perfil cliente e operador de identidade barrados.
 * Dados fictícios.
 */
import type postgres from "postgres";
import { NextRequest } from "next/server";
jest.mock("@/shared/db/env", () => ({
  getDatabaseUrl: () => process.env.INTEGRATION_APP_RUNTIME_URL,
}));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("@/shared/integrations/storage/documents-storage", () => {
  const actual = jest.requireActual("@/shared/integrations/storage/documents-storage");
  return {
    signedPcmsoPath: actual.signedPcmsoPath,
    SIGNED_DOWNLOAD_URL_TTL_SECONDS: actual.SIGNED_DOWNLOAD_URL_TTL_SECONDS,
    putSignedAsoObject: jest.fn(),
    removeDocumentObject: jest.fn(),
    getSignedDownloadUrl: jest.fn(),
  };
});
import type { TenantContext } from "@/shared/auth/require-tenant-context";
import { todayInSaoPaulo } from "@/shared/dates";
import {
  getSignedDownloadUrl,
  putSignedAsoObject,
  removeDocumentObject,
} from "@/shared/integrations/storage/documents-storage";
import { registerMedicalRiskSource } from "@/shared/server/medicine/risk-source-core";
import {
  approve,
  createDraft,
  decideItem,
  getPlan,
} from "@/shared/server/medicine/exam-plan-core";
import { generateDocument } from "@/shared/server/medicine/pcmso-document-core";
import {
  listSignedPcmsos,
  registerSignedPcmso,
  signedPcmsoDownload,
} from "@/shared/server/medicine/pcmso-signed-core";
import {
  GET as LIST_SIGNED,
  POST as REGISTER,
} from "@/app/api/v1/companies/[id]/signed-pcmsos/route";
import { GET as DOWNLOAD } from "@/app/api/v1/signed-pcmsos/[id]/download/route";
import { linkByInvitation as link } from "../_helpers/professional-link";
import { adminClient, applyMigrations } from "../_helpers/db";
import { seedPgrBase, PGR_IDS as I } from "../_helpers/pgr-seed";

const enabled =
  !!process.env.INTEGRATION_APP_RUNTIME_URL && !!process.env.INTEGRATION_DATABASE_URL;
const owner: TenantContext = {
  tenantId: "org_a",
  userId: "owner",
  role: "owner",
  plan: "free",
};
const staff: TenantContext = { ...owner, userId: "staff", role: "collaborator" };
const doctor: TenantContext = { ...owner, userId: "doctor", role: "collaborator" };
const doctor2: TenantContext = { ...owner, userId: "doctor2", role: "collaborator" };
const ownerB: TenantContext = {
  tenantId: "org_b",
  userId: "owner-b",
  role: "owner",
  plan: "pro",
};
const MEDICO = "aaaaaaaa-0000-4000-8000-000000000061";
const MEDICO_C = "aaaaaaaa-0000-4000-8000-000000000062";
const COMPANY_C = "cccccccc-0000-4000-8000-000000000063";

const pdf = (text = "PCMSO assinado fictício") =>
  new File([`%PDF-1.7\n${text}\n%%EOF`], "pcmso.pdf", { type: "application/pdf" });

const restReq = (ctx: TenantContext, method = "GET", body?: FormData) =>
  new NextRequest("http://localhost/api/v1/companies", {
    method,
    body,
    headers: {
      "x-dev-tenant": ctx.tenantId,
      "x-dev-user": ctx.userId,
      "x-dev-role": ctx.role,
    },
  });

(enabled ? describe : describe.skip)("PCMSO assinado (NOB-166)", () => {
  let admin: ReturnType<typeof postgres>;
  let runtime: ReturnType<typeof postgres>;
  const originalEnv = { ...process.env };
  beforeAll(async () => {
    admin = adminClient();
    await admin`set client_min_messages = warning`;
    await applyMigrations(admin);
    runtime = (await import("postgres")).default(
      process.env.INTEGRATION_APP_RUNTIME_URL!,
      {
        max: 1,
        prepare: false,
      },
    );
  });
  afterAll(async () => {
    process.env = originalEnv;
    await runtime?.end({ timeout: 5 });
    await admin?.end({ timeout: 5 });
  });

  let today: string;
  beforeEach(async () => {
    jest.clearAllMocks();
    for (const fn of [putSignedAsoObject, removeDocumentObject])
      (fn as jest.Mock).mockResolvedValue(undefined);
    (getSignedDownloadUrl as jest.Mock).mockResolvedValue(
      "https://storage.example.test/signed",
    );
    today = todayInSaoPaulo();
    await seedPgrBase(admin);
    await admin`insert into users (id,email) values ('owner','o@example.test'),('staff','s@example.test'),('doctor','d@example.test'),('doctor2','d2@example.test'),('client','c@example.test'),('owner-b','ob@example.test')`;
    await admin`insert into org_memberships (org_id,user_id,role) values ('org_a','owner','owner'),('org_a','staff','org:member'),('org_a','doctor','collaborator'),('org_a','doctor2','collaborator'),('org_a','client','org:client'),('org_b','owner-b','owner')`;
    await admin`update companies set cnae='4120-4', main_activity='Construção de edifícios', risk_grade=3 where id=${I.companyA}`;
    await admin`insert into medicos (id, org_id, name, crm, profession, registration_uf, rqe, affiliation, status) values
      (${MEDICO}, 'org_a', 'Dra. Coordenadora Fictícia', '61001', 'physician', 'MA', '961', 'internal', 'active'),
      (${MEDICO_C}, 'org_a', 'Dr. Coordenador da Empresa C', '61002', 'physician', 'MA', '962', 'external', 'active')`;
    await admin`insert into companies (id, org_id, cnpj, razao_social) values (${COMPANY_C}, 'org_a', '33444555000166', 'C Fictícia Ltda')`;
    await admin`insert into company_modules (org_id, company_id, module, enabled) values ('org_a', ${COMPANY_C}, 'medicine', true)`;
    await admin`insert into pcmso_coordinator_assignments (org_id, company_id, medico_id, starts_on, created_by) values
      ('org_a', ${I.companyA}, ${MEDICO}, '2026-01-01', 'owner'),
      ('org_a', ${COMPANY_C}, ${MEDICO_C}, '2026-01-01', 'owner')`;
    await admin`update risks set noxious_agent_code='02.01.001' where id=${I.riskA}`;
    const source = await registerMedicalRiskSource(owner, I.companyA, {
      kind: "internal",
      pgrId: I.pgrA,
    });
    await admin`update medical_risk_entries set status='validated', reviewed_by='prof', reviewed_at=now() where source_id=${source.id}`;
    await link(owner, MEDICO, { userId: "doctor", reason: "Coordenadora fictícia." });
    await link(owner, MEDICO_C, {
      userId: "doctor2",
      reason: "Coordenador fictício da C.",
    });
    process.env.APP_ENV = "local";
    process.env.DEV_API_AUTH_BYPASS = "true";
  });

  async function approvedPlan() {
    const plan = await createDraft(staff, I.companyA);
    const [item] = (await getPlan(staff, plan.id)).items;
    await decideItem(doctor, plan.id, item.id, {
      decision: "kept",
      periodicity: "Admissional, anual e demissional",
    });
    return approve(doctor, plan.id, { note: "Aprovação fictícia." });
  }
  const preview = () => generateDocument(staff, I.companyA, { cycleStart: "2026-11-01" });
  const fields = (previewDocumentId: string, overrides: Record<string, string> = {}) => ({
    origin: "coordinator",
    previewDocumentId,
    signatureMethod: "icp_brasil",
    verificationReference: "Verificador ITI, relatório fictício 77",
    signerName: "Dra. Coordenadora Fictícia",
    signerRegistration: "61001",
    signerUf: "MA",
    signedOn: today,
    ...overrides,
  });

  it("fluxo do coordenador: só o médico responsável verificado; owner, colaborador e outro coordenador barrados", async () => {
    await approvedPlan();
    const v1 = await preview();
    for (const ctx of [owner, staff, doctor2])
      await expect(
        registerSignedPcmso(ctx, I.companyA, fields(v1.id), pdf()),
      ).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
    // Outro coordenador assinando como ele mesmo: não é o responsável desta empresa.
    await expect(
      registerSignedPcmso(
        doctor2,
        I.companyA,
        fields(v1.id, { signerRegistration: "61002", signerName: "Dr. C" }),
        pdf(),
      ),
    ).rejects.toMatchObject({
      code: "VALIDATION",
      message: expect.stringMatching(/médico responsável/),
    });
    expect((removeDocumentObject as jest.Mock).mock.calls.length).toBe(
      (putSignedAsoObject as jest.Mock).mock.calls.length,
    );
    const created = await registerSignedPcmso(doctor, I.companyA, fields(v1.id), pdf());
    expect(created).toMatchObject({
      origin: "coordinator",
      previewDocumentId: v1.id,
      previewSha256: v1.contentSha256,
      previewVersion: 1,
      examPlanId: v1.examPlanId,
      verificationKind: "documentary",
      registeredBy: "doctor",
      replacedById: null,
    });
    expect(created).not.toHaveProperty("storagePath");
    const [path] = (putSignedAsoObject as jest.Mock).mock.calls.at(-1)!;
    expect(path).toBe(`org_a/pcmso-assinados/${I.companyA}/${created.id}.pdf`);
    const list = await listSignedPcmsos(staff, I.companyA);
    expect(list).toMatchObject({ currentId: created.id, warnings: [] });
    expect(await signedPcmsoDownload(staff, created.id)).toMatchObject({
      sha256: created.fileSha256,
    });
  });

  it("identidade revogada corta o fluxo do coordenador (servidor e SQL)", async () => {
    await approvedPlan();
    const v1 = await preview();
    await admin`insert into professional_identity_review_events (org_id, kind, verification_id, reason, actor_user_id)
      select org_id, 'revoked', id, 'Revogação fictícia de teste.', 'platform-verifier-test'
      from professional_identity_verifications where user_id = 'doctor'`;
    await expect(
      registerSignedPcmso(doctor, I.companyA, fields(v1.id), pdf()),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(await admin`select * from pcmso_signed_documents`).toHaveLength(0);
  });

  it("vínculo revogado corta o fluxo do coordenador", async () => {
    await approvedPlan();
    const v1 = await preview();
    await admin`update medico_user_links set revoked_at = now(), revoked_by = 'owner', revoke_reason = 'Fim do vínculo fictício.' where user_id = 'doctor'`;
    await expect(
      registerSignedPcmso(doctor, I.companyA, fields(v1.id), pdf()),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(await admin`select * from pcmso_signed_documents`).toHaveLength(0);
  });

  it("coerência: prévia de outra empresa ou inexistente, prévia antiga, plano trocado, datas, PDF e conferência", async () => {
    const firstPlan = await approvedPlan();
    const v1 = await preview();
    await expect(
      registerSignedPcmso(
        doctor,
        I.companyA,
        fields("bbbbbbbb-0000-4000-8000-000000000001"),
        pdf(),
      ),
    ).rejects.toMatchObject({
      code: "VALIDATION",
      message: expect.stringMatching(/não é desta empresa/),
    });
    await expect(
      registerSignedPcmso(
        doctor2,
        COMPANY_C,
        fields(v1.id, { signerRegistration: "61002" }),
        pdf(),
      ),
    ).rejects.toMatchObject({
      code: "VALIDATION",
    });
    const bads: Record<string, string>[] = [
      { signedOn: "2099-01-01" },
      { signedOn: "2026-10-01" },
      { verificationReference: "" },
      { signatureMethod: "simulada" },
      { signerUf: "X" },
    ];
    for (const bad of bads)
      await expect(
        registerSignedPcmso(doctor, I.companyA, fields(v1.id, bad), pdf()),
      ).rejects.toThrow();
    await expect(
      registerSignedPcmso(
        doctor,
        I.companyA,
        fields(v1.id),
        new File(["texto"], "a.pdf", { type: "application/pdf" }),
      ),
    ).rejects.toMatchObject({
      code: "VALIDATION",
      message: expect.stringMatching(/PDF/),
    });
    await expect(
      registerSignedPcmso(doctor, I.companyA, fields(v1.id), null),
    ).rejects.toMatchObject({
      code: "VALIDATION",
    });
    // Prévia antiga: com v2, a v1 não vira vigente.
    await preview();
    await expect(
      registerSignedPcmso(doctor, I.companyA, fields(v1.id), pdf()),
    ).rejects.toMatchObject({
      code: "VALIDATION",
      message: expect.stringMatching(/mais recente/),
    });
    // Novo plano aprovado: a prévia do plano antigo não é registrada.
    const draft = await createDraft(staff, I.companyA);
    const [item] = (await getPlan(staff, draft.id)).items;
    await decideItem(doctor, draft.id, item.id, {
      decision: "kept",
      periodicity: "Anual",
    });
    const secondPlan = await approve(doctor, draft.id, { note: "Revisão fictícia." });
    expect(secondPlan.id).not.toBe(firstPlan.id);
    const v2 = (await listSignedPcmsos(staff, I.companyA)).items.length;
    expect(v2).toBe(0);
    const stale = (
      await admin`select id from pcmso_documents where company_id=${I.companyA} order by version desc limit 1`
    )[0];
    await expect(
      registerSignedPcmso(doctor, I.companyA, fields(stale.id as string), pdf()),
    ).rejects.toMatchObject({
      code: "VALIDATION",
      message: expect.stringMatching(/plano aprovado vigente/),
    });
    expect(await admin`select * from pcmso_signed_documents`).toHaveLength(0);
  });

  it("fluxo do escritório, substituição com tipo de mudança (MED-14) e alertas de desatualização", async () => {
    await approvedPlan();
    const v1 = await preview();
    const first = await registerSignedPcmso(
      staff,
      I.companyA,
      fields(v1.id, {
        origin: "office_received",
        signatureMethod: "handwritten",
        verificationReference: "Original físico na pasta 3, conferido",
      }),
      pdf("v1"),
    );
    expect(first).toMatchObject({ origin: "office_received", registeredBy: "staff" });
    // Novo documento sem substituir: recusado; substituição sem tipo/motivo: recusada.
    await expect(
      registerSignedPcmso(doctor, I.companyA, fields(v1.id), pdf("x")),
    ).rejects.toMatchObject({
      code: "VALIDATION",
      message: expect.stringMatching(/substituição/),
    });
    await expect(
      registerSignedPcmso(
        doctor,
        I.companyA,
        { ...fields(v1.id), replacesId: first.id },
        pdf("x"),
      ),
    ).rejects.toThrow();
    // Troca de coordenador: alerta; a nova versão é alteração administrativa.
    const yesterday = new Date(Date.parse(`${today}T12:00:00Z`) - 86400000)
      .toISOString()
      .slice(0, 10);
    await admin`update pcmso_coordinator_assignments set ends_on = ${yesterday}, end_reason = 'Troca fictícia do médico responsável.' where company_id = ${I.companyA}`;
    await admin`insert into pcmso_coordinator_assignments (org_id, company_id, medico_id, starts_on, created_by)
      values ('org_a', ${I.companyA}, ${MEDICO_C}, ${today}, 'owner')`;
    expect((await listSignedPcmsos(staff, I.companyA)).warnings).toContain(
      "coordinator_changed",
    );
    const second = await registerSignedPcmso(
      doctor2,
      I.companyA,
      {
        ...fields(v1.id, {
          signerName: "Dr. Coordenador da Empresa C",
          signerRegistration: "61002",
        }),
        replacesId: first.id,
        changeKind: "administrative",
        replaceReason: "Troca do médico responsável pela empresa.",
      },
      pdf("v2"),
    );
    expect(second).toMatchObject({ replacesId: first.id, changeKind: "administrative" });
    const listed = await listSignedPcmsos(staff, I.companyA);
    expect(listed.currentId).toBe(second.id);
    expect(listed.items.map((i) => [i.id, i.replacedById])).toEqual([
      [first.id, second.id],
      [second.id, null],
    ]);
    expect(listed.warnings).toEqual([]);
    // Dupla cadeia: substituir de novo o antigo.
    await expect(
      registerSignedPcmso(
        doctor2,
        I.companyA,
        {
          ...fields(v1.id, { signerRegistration: "61002" }),
          replacesId: first.id,
          changeKind: "correction",
          replaceReason: "Tentativa de nova cadeia fictícia.",
        },
        pdf("v3"),
      ),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    // Nova prévia: o vigente fica desatualizado (alerta), sem reescrita.
    await preview();
    expect((await listSignedPcmsos(staff, I.companyA)).warnings).toContain(
      "newer_preview",
    );
    await expect(signedPcmsoDownload(staff, first.id)).resolves.toMatchObject({
      url: expect.any(String),
    });
  });

  it("NOB-110: CRM do coordenador com pontuação confere pela forma canônica; identidade e autoria intactas", async () => {
    // Cadastro legado com pontuação, verificado com o CRM como está no cadastro (simula o operador
    // independente; a verificação continua exigindo igualdade exata com o cadastro — NOB-158).
    await admin`update medicos set crm='61.001' where id=${MEDICO}`;
    await admin`update professional_identity_verifications set crm='61.001' where medico_id=${MEDICO} and user_id='doctor'`;
    await approvedPlan();
    const v1 = await preview();
    // O CRM certo não autoriza ninguém além do coordenador verificado.
    for (const ctx of [owner, staff, doctor2])
      await expect(
        registerSignedPcmso(ctx, I.companyA, fields(v1.id), pdf()),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    // Número diferente, UF diferente e zero à esquerda a mais: não é o coordenador designado.
    const bads: Record<string, string>[] = [
      { signerRegistration: "61002" },
      { signerUf: "PI" },
      { signerRegistration: "061001" },
    ];
    for (const bad of bads)
      await expect(
        registerSignedPcmso(doctor, I.companyA, fields(v1.id, bad), pdf()),
      ).rejects.toMatchObject({
        code: "VALIDATION",
        message: expect.stringMatching(/médico responsável/),
      });
    expect(await admin`select * from pcmso_signed_documents`).toHaveLength(0);

    // Só números e UF minúscula: confere; o signatário fica gravado como está no cadastro.
    const created = await registerSignedPcmso(
      doctor,
      I.companyA,
      fields(v1.id, { signerRegistration: "61001", signerUf: "ma" }),
      pdf(),
    );
    expect(created).toMatchObject({ origin: "coordinator", registeredBy: "doctor" });
    const [stored] =
      await admin`select signer_registration, signer_uf from pcmso_signed_documents where id=${created.id}`;
    expect(stored).toEqual({ signer_registration: "61.001", signer_uf: "MA" });
    expect((await listSignedPcmsos(staff, I.companyA)).warnings).not.toContain(
      "coordinator_changed",
    );
    // Reformatar o CRM no cadastro (mesmo número) não é troca de coordenador.
    await admin`update medicos set crm='61001' where id=${MEDICO}`;
    expect((await listSignedPcmsos(staff, I.companyA)).warnings).not.toContain(
      "coordinator_changed",
    );
  });

  it("NOB-110: CRM do coordenador com letras não é adivinhado; pede a correção do cadastro", async () => {
    await approvedPlan();
    const v1 = await preview();
    await admin`update medicos set crm='61001-MA' where id=${MEDICO}`;
    await admin`update professional_identity_verifications set crm='61001-MA' where medico_id=${MEDICO} and user_id='doctor'`;
    await expect(
      registerSignedPcmso(doctor, I.companyA, fields(v1.id), pdf()),
    ).rejects.toMatchObject({
      code: "VALIDATION",
      message: expect.stringMatching(/corrigir o cadastro/),
    });
    expect(await admin`select * from pcmso_signed_documents`).toHaveLength(0);
  });

  it("SQL direto: autoria forjada, empresa divergente, plano não aprovado, UPDATE/DELETE e operador de identidade", async () => {
    const plan = await approvedPlan();
    const v1 = await preview();
    const created = await registerSignedPcmso(doctor, I.companyA, fields(v1.id), pdf());
    const as = (actor: string, fn: (tx: postgres.TransactionSql) => Promise<unknown>) =>
      runtime.begin(async (tx) => {
        await tx`select set_config('app.current_org', 'org_a', true), set_config('app.current_actor', ${actor}, true)`;
        return fn(tx);
      });
    const forge = (
      actor: string,
      o: { origin?: string; companyId?: string; planId?: string } = {},
    ) =>
      as(
        actor,
        (
          tx,
        ) => tx`insert into pcmso_signed_documents (id, org_id, company_id, preview_document_id, preview_sha256, exam_plan_id,
          origin, signature_method, signer_name, signer_registration, signer_uf, signed_on, verification_reference,
          storage_path, file_sha256, size_bytes, replaces_id, change_kind, replace_reason, registered_by)
        values (gen_random_uuid(), 'org_a', ${o.companyId ?? I.companyA}, ${v1.id}, ${v1.contentSha256}, ${o.planId ?? plan.id},
          ${o.origin ?? "coordinator"}, 'icp_brasil', 'Forjado', '61001', 'MA', ${today}, 'Forjado fictício',
          ${"org_a/x/" + Math.random()}, ${"a".repeat(64)}, 10, ${created.id}, 'correction', 'Forjado fictício para o teste.', ${actor})`,
      );
    await expect(forge("owner")).rejects.toMatchObject({ code: "42501" });
    await expect(forge("staff")).rejects.toMatchObject({ code: "42501" });
    await expect(forge("client", { origin: "office_received" })).rejects.toMatchObject({
      code: "42501",
    });
    await expect(forge("doctor", { companyId: COMPANY_C })).rejects.toMatchObject({
      code: expect.stringMatching(/42501|23503/),
    });
    const draft = await createDraft(staff, I.companyA);
    await expect(forge("doctor", { planId: draft.id })).rejects.toMatchObject({
      code: expect.stringMatching(/42501|23503/),
    });
    await expect(
      as(
        "doctor",
        (tx) =>
          tx`update pcmso_signed_documents set signed_on = '2026-01-01' where id = ${created.id}`,
      ),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      as(
        "owner",
        (tx) => tx`delete from pcmso_signed_documents where id = ${created.id}`,
      ),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      admin.begin(async (tx) => {
        await tx`set local role identity_verifier`;
        return tx`select count(*) from pcmso_signed_documents`;
      }),
    ).rejects.toMatchObject({ code: "42501" });
  });

  it("REST: multipart 201, lista com vigente e alertas, download; outro tenant 404; cliente 403", async () => {
    await approvedPlan();
    const v1 = await preview();
    const params = { params: Promise.resolve({ id: I.companyA }) };
    const form = new FormData();
    for (const [k, v] of Object.entries(fields(v1.id))) form.set(k, v);
    form.set("file", pdf());
    const res = await REGISTER(restReq(doctor, "POST", form), params);
    expect(res.status).toBe(201);
    const { id } = await res.json();
    const list = await LIST_SIGNED(restReq(staff), params);
    expect(list.status).toBe(200);
    expect((await list.json()).currentId).toBe(id);
    expect(
      (await DOWNLOAD(restReq(staff), { params: Promise.resolve({ id }) })).status,
    ).toBe(200);
    expect(
      (await DOWNLOAD(restReq(ownerB), { params: Promise.resolve({ id }) })).status,
    ).toBe(404);
    expect((await LIST_SIGNED(restReq(ownerB), params)).status).toBe(404);
    expect(
      (await LIST_SIGNED(restReq({ ...owner, userId: "client", role: "client" }), params))
        .status,
    ).toBe(403);
    await expect(listSignedPcmsos(ownerB, I.companyA)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});
