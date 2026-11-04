/**
 * PCMSO assinado × base de riscos (NOB-166, revisão do Tech Lead): o documento só vira vigente se
 * a prévia e o plano aprovado foram fundamentados exatamente nas fontes de riscos vigentes, com as
 * mesmas versões e os mesmos riscos validados (NR-7 7.5.1, 7.5.5; SEG-21). Postgres efêmero,
 * storage simulado. Dados fictícios.
 */
import { createHash } from "node:crypto";

import type postgres from "postgres";
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
const MEDICO = "aaaaaaaa-0000-4000-8000-000000000071";

const pdfBytes = (text: string) => `%PDF-1.7\n${text}\n%%EOF`;
const pdf = (text = "PCMSO assinado fictício") =>
  new File([pdfBytes(text)], "pcmso.pdf", { type: "application/pdf" });
const sha = (text: string) => createHash("sha256").update(pdfBytes(text)).digest("hex");

(enabled ? describe : describe.skip)("PCMSO assinado × base de riscos (NOB-166)", () => {
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
  let internalSourceId: string;
  beforeEach(async () => {
    jest.clearAllMocks();
    for (const fn of [putSignedAsoObject, removeDocumentObject])
      (fn as jest.Mock).mockResolvedValue(undefined);
    (getSignedDownloadUrl as jest.Mock).mockResolvedValue(
      "https://storage.example.test/signed",
    );
    today = todayInSaoPaulo();
    await seedPgrBase(admin);
    await admin`insert into users (id,email) values ('owner','o@example.test'),('staff','s@example.test'),('doctor','d@example.test')`;
    await admin`insert into org_memberships (org_id,user_id,role) values ('org_a','owner','owner'),('org_a','staff','org:member'),('org_a','doctor','collaborator')`;
    await admin`update companies set cnae='4120-4', main_activity='Construção de edifícios', risk_grade=3 where id=${I.companyA}`;
    await admin`insert into medicos (id, org_id, name, crm, profession, registration_uf, rqe, affiliation, status)
      values (${MEDICO}, 'org_a', 'Dra. Coordenadora Fictícia', '71001', 'physician', 'MA', '971', 'internal', 'active')`;
    await admin`insert into pcmso_coordinator_assignments (org_id, company_id, medico_id, starts_on, created_by)
      values ('org_a', ${I.companyA}, ${MEDICO}, '2026-01-01', 'owner')`;
    await admin`update risks set noxious_agent_code='02.01.001' where id=${I.riskA}`;
    const source = await registerMedicalRiskSource(owner, I.companyA, {
      kind: "internal",
      pgrId: I.pgrA,
    });
    internalSourceId = source.id;
    await validate(source.id);
    await link(owner, MEDICO, { userId: "doctor", reason: "Coordenadora fictícia." });
    process.env.APP_ENV = "local";
    process.env.DEV_API_AUTH_BYPASS = "true";
  });

  const validate = (sourceId: string) =>
    admin`update medical_risk_entries set status='validated', reviewed_by='prof', reviewed_at=now() where source_id=${sourceId}`;
  async function approvedPlan() {
    const plan = await createDraft(staff, I.companyA);
    for (const item of (await getPlan(staff, plan.id)).items)
      await decideItem(doctor, plan.id, item.id, {
        decision: "kept",
        periodicity: "Anual",
      });
    return approve(doctor, plan.id, { note: "Aprovação fictícia." });
  }
  const preview = () => generateDocument(staff, I.companyA, { cycleStart: "2026-11-01" });
  const fields = (previewDocumentId: string) => ({
    origin: "coordinator",
    previewDocumentId,
    signatureMethod: "icp_brasil",
    verificationReference: "Verificador ITI, relatório fictício 88",
    signerName: "Dra. Coordenadora Fictícia",
    signerRegistration: "71001",
    signerUf: "MA",
    signedOn: today,
  });
  const signed = () => admin`select id from pcmso_signed_documents`;

  it("riscos inalterados: aceito; hash da prévia (snapshot) e hash do PDF (bytes) são distintos e íntegros", async () => {
    await approvedPlan();
    const v1 = await preview();
    const created = await registerSignedPcmso(
      doctor,
      I.companyA,
      fields(v1.id),
      pdf("ok"),
    );
    expect(created.previewDocumentId).toBe(v1.id);
    expect(created.previewSha256).toBe(v1.contentSha256);
    expect(created.fileSha256).toBe(sha("ok"));
    expect(created.fileSha256).not.toBe(created.previewSha256);
    expect((await listSignedPcmsos(staff, I.companyA)).warnings).toEqual([]);
  });

  it("PGR interno alterado depois da prévia (sem nova fonte): bloqueado, fail closed", async () => {
    await approvedPlan();
    const v1 = await preview();
    await admin`update risks set description = 'Ruído contínuo acima do limite (alterado)' where id = ${I.riskA}`;
    await expect(
      registerSignedPcmso(doctor, I.companyA, fields(v1.id), pdf()),
    ).rejects.toMatchObject({
      code: "VALIDATION",
      message: expect.stringMatching(/PGR de origem mudou/),
    });
    expect(await signed()).toHaveLength(0);
  });

  it("PGR interno alterado sem nova fonte nem versão: INSERT direto pela conta do coordenador é recusado pelo banco", async () => {
    const plan = await approvedPlan();
    const v1 = await preview();
    await admin`update risks set description = 'Ruído contínuo alterado sem nova fonte' where id = ${I.riskA}`;
    // A fonte vigente continua a mesma (mesmo id e versão).
    const live =
      await admin`select id, version from medical_risk_sources where company_id = ${I.companyA}`;
    expect(live).toHaveLength(1);
    expect(live[0].id).toBe(internalSourceId);
    // app_runtime com RLS, ator = coordenador verificado (sem superusuário nem BYPASSRLS).
    const forged = runtime.begin(async (tx) => {
      await tx`select set_config('app.current_org', 'org_a', true), set_config('app.current_actor', 'doctor', true)`;
      return tx`insert into pcmso_signed_documents (id, org_id, company_id, preview_document_id, preview_sha256, exam_plan_id,
          origin, signature_method, signer_name, signer_registration, signer_uf, signed_on, verification_reference,
          storage_path, file_sha256, size_bytes, registered_by)
        values (gen_random_uuid(), 'org_a', ${I.companyA}, ${v1.id}, ${v1.contentSha256}, ${plan.id}, 'coordinator',
          'icp_brasil', 'Dra. Coordenadora Fictícia', '71001', 'MA', ${today}, 'Forjado fictício',
          ${"org_a/x/" + Math.random()}, ${"a".repeat(64)}, 10, 'doctor')`;
    });
    await expect(forged).rejects.toMatchObject({ code: "42501" });
    expect(await signed()).toHaveLength(0);
  });

  it("risco validado depois da prévia: INSERT direto também é recusado pelo banco", async () => {
    const ext = await registerMedicalRiskSource(owner, I.companyA, {
      kind: "external",
      title: "PGR externo fictício",
      version: "2026.1",
      reference: "Documento externo fictício",
      risks: [
        { agentType: "physical", description: "Calor", exposureGroup: "GES A" },
        { agentType: "chemical", description: "Poeira mineral", exposureGroup: "GES A" },
      ],
    });
    await admin`update medical_risk_entries set status='validated', reviewed_by='prof', reviewed_at=now()
      where source_id=${ext.id} and content->>'description' = 'Calor'`;
    const plan = await approvedPlan();
    const v1 = await preview();
    await admin`update medical_risk_entries set status='validated', reviewed_by='prof', reviewed_at=now()
      where source_id=${ext.id} and content->>'description' = 'Poeira mineral'`;
    const forged = runtime.begin(async (tx) => {
      await tx`select set_config('app.current_org', 'org_a', true), set_config('app.current_actor', 'doctor', true)`;
      return tx`insert into pcmso_signed_documents (id, org_id, company_id, preview_document_id, preview_sha256, exam_plan_id,
          origin, signature_method, signer_name, signer_registration, signer_uf, signed_on, verification_reference,
          storage_path, file_sha256, size_bytes, registered_by)
        values (gen_random_uuid(), 'org_a', ${I.companyA}, ${v1.id}, ${v1.contentSha256}, ${plan.id}, 'coordinator',
          'icp_brasil', 'Dra. Coordenadora Fictícia', '71001', 'MA', ${today}, 'Forjado fictício',
          ${"org_a/x/" + Math.random()}, ${"a".repeat(64)}, 10, 'doctor')`;
    });
    await expect(forged).rejects.toMatchObject({ code: "42501" });
  });

  it("fonte interna substituída por nova versão: bloqueado (servidor e SQL); fluxo coerente depois é aceito", async () => {
    const oldPlan = await approvedPlan();
    const v1 = await preview();
    await admin`update risks set description = 'Ruído contínuo revisado' where id = ${I.riskA}`;
    const v2source = await registerMedicalRiskSource(owner, I.companyA, {
      kind: "internal",
      pgrId: I.pgrA,
      supersedesSourceId: internalSourceId,
    });
    await validate(v2source.id);
    await expect(
      registerSignedPcmso(doctor, I.companyA, fields(v1.id), pdf()),
    ).rejects.toMatchObject({
      code: "VALIDATION",
      message: expect.stringMatching(/outra fonte ou versão/),
    });
    // SQL direto com a prévia obsoleta: a policy recusa.
    const forged = runtime.begin(async (tx) => {
      await tx`select set_config('app.current_org', 'org_a', true), set_config('app.current_actor', 'doctor', true)`;
      return tx`insert into pcmso_signed_documents (id, org_id, company_id, preview_document_id, preview_sha256, exam_plan_id,
          origin, signature_method, signer_name, signer_registration, signer_uf, signed_on, verification_reference,
          storage_path, file_sha256, size_bytes, registered_by)
        values (gen_random_uuid(), 'org_a', ${I.companyA}, ${v1.id}, ${v1.contentSha256}, ${oldPlan.id}, 'coordinator',
          'icp_brasil', 'Dra. Coordenadora Fictícia', '71001', 'MA', ${today}, 'Forjado fictício',
          ${"org_a/x/" + Math.random()}, ${"a".repeat(64)}, 10, 'doctor')`;
    });
    await expect(forged).rejects.toMatchObject({ code: "42501" });
    // Prévia "recente" ligada ao plano antigo (inserida direto, sem passar pela conferência).
    const [stale] =
      await admin`insert into pcmso_documents (org_id, company_id, version, cycle_start, cycle_end, exam_plan_id, content, content_sha256, generated_by)
      select org_id, company_id, 2, cycle_start, cycle_end, exam_plan_id, content, content_sha256, 'staff' from pcmso_documents where id = ${v1.id}
      returning id`;
    await expect(
      registerSignedPcmso(doctor, I.companyA, fields(stale.id as string), pdf()),
    ).rejects.toMatchObject({
      code: "VALIDATION",
      message: expect.stringMatching(
        /plano de exames aprovado foi feito sobre outra fonte/,
      ),
    });
    expect(await signed()).toHaveLength(0);
    // Plano revalidado e prévia nova, coerentes com a fonte vigente: aceito.
    await approvedPlan();
    const v3 = await preview();
    await expect(
      registerSignedPcmso(doctor, I.companyA, fields(v3.id), pdf("v3")),
    ).resolves.toMatchObject({
      previewDocumentId: v3.id,
    });
  });

  it("nova versão do PGR externo: bloqueado; fonte externa não é tratada como imutável", async () => {
    const ext = await registerMedicalRiskSource(owner, I.companyA, {
      kind: "external",
      title: "PGR externo fictício",
      version: "2026.1",
      reference: "Documento externo fictício v2026.1",
      risks: [{ agentType: "physical", description: "Calor", exposureGroup: "GES A" }],
    });
    await validate(ext.id);
    await approvedPlan();
    const v1 = await preview();
    const ext2 = await registerMedicalRiskSource(owner, I.companyA, {
      kind: "external",
      title: "PGR externo fictício",
      version: "2026.2",
      reference: "Documento externo fictício v2026.2",
      risks: [
        { agentType: "physical", description: "Calor intenso", exposureGroup: "GES A" },
      ],
      supersedesSourceId: ext.id,
    });
    await validate(ext2.id);
    await expect(
      registerSignedPcmso(doctor, I.companyA, fields(v1.id), pdf()),
    ).rejects.toMatchObject({
      code: "VALIDATION",
      message: expect.stringMatching(/outra fonte ou versão/),
    });
  });

  it("risco validado depois da prévia (mesma fonte) e fonte removida: bloqueado", async () => {
    // Fonte externa com dois riscos, só um validado na prévia.
    const ext = await registerMedicalRiskSource(owner, I.companyA, {
      kind: "external",
      title: "PGR externo fictício",
      version: "2026.1",
      reference: "Documento externo fictício",
      risks: [
        { agentType: "physical", description: "Calor", exposureGroup: "GES A" },
        { agentType: "chemical", description: "Poeira mineral", exposureGroup: "GES A" },
      ],
    });
    await admin`update medical_risk_entries set status='validated', reviewed_by='prof', reviewed_at=now()
      where source_id=${ext.id} and content->>'description' = 'Calor'`;
    await approvedPlan();
    const v1 = await preview();
    await admin`update medical_risk_entries set status='validated', reviewed_by='prof', reviewed_at=now()
      where source_id=${ext.id} and content->>'description' = 'Poeira mineral'`;
    await expect(
      registerSignedPcmso(doctor, I.companyA, fields(v1.id), pdf()),
    ).rejects.toMatchObject({
      code: "VALIDATION",
      message: expect.stringMatching(/riscos validados da empresa mudaram/),
    });
    // Fonte removida (só pelo dono do banco; a aplicação não apaga): falha fechada.
    await admin`delete from medical_risk_sources where id = ${ext.id}`;
    await expect(
      registerSignedPcmso(doctor, I.companyA, fields(v1.id), pdf()),
    ).rejects.toMatchObject({
      code: "VALIDATION",
    });
    expect(await signed()).toHaveLength(0);
  });

  it("documento vigente fica marcado quando a base muda depois; histórico preservado e nova emissão coerente", async () => {
    await approvedPlan();
    const v1 = await preview();
    const first = await registerSignedPcmso(doctor, I.companyA, fields(v1.id), pdf("v1"));
    await admin`update risks set description = 'Ruído alterado depois da assinatura' where id = ${I.riskA}`;
    expect((await listSignedPcmsos(staff, I.companyA)).warnings).toContain(
      "risk_basis_changed",
    );
    const v2source = await registerMedicalRiskSource(owner, I.companyA, {
      kind: "internal",
      pgrId: I.pgrA,
      supersedesSourceId: internalSourceId,
    });
    await validate(v2source.id);
    await approvedPlan();
    const v2 = await preview();
    const second = await registerSignedPcmso(
      doctor,
      I.companyA,
      {
        ...fields(v2.id),
        replacesId: first.id,
        changeKind: "clinical_revision",
        replaceReason: "Riscos do PGR revisados.",
      },
      pdf("v2"),
    );
    const listed = await listSignedPcmsos(staff, I.companyA);
    expect(listed.currentId).toBe(second.id);
    expect(listed.warnings).toEqual([]);
    await expect(signedPcmsoDownload(staff, first.id)).resolves.toMatchObject({
      sha256: sha("v1"),
    });
  });

  it("concorrência: nova fonte registrada junto com a assinatura não gera documento vigente inconsistente", async () => {
    await approvedPlan();
    const v1 = await preview();
    await admin`update risks set description = 'Ruído revisado em paralelo' where id = ${I.riskA}`;
    // O PGR já mudou: a assinatura falha fechada qualquer que seja a ordem; a nova fonte entra.
    const [sign, source] = await Promise.allSettled([
      registerSignedPcmso(doctor, I.companyA, fields(v1.id), pdf()),
      registerMedicalRiskSource(owner, I.companyA, {
        kind: "internal",
        pgrId: I.pgrA,
        supersedesSourceId: internalSourceId,
      }),
    ]);
    expect(sign.status).toBe("rejected");
    expect(source.status).toBe("fulfilled");
    expect(await signed()).toHaveLength(0);
  });
});
