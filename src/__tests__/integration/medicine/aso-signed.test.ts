/**
 * ASO assinado arquivado (NOB-163) contra Postgres efêmero. O storage é simulado; banco, RLS e
 * regras são reais:
 * - fluxo A: só o examinador do exame, verificado, com o CRM/UF dele e a conclusão da prévia;
 * - fluxo B: equipe do escritório arquiva o ASO da clínica externa; perfil cliente barrado;
 * - PDF conferido, SHA-256 calculado no servidor, conferência da assinatura obrigatória;
 * - substituição com motivo, sem dupla cadeia; histórico preservado e bloqueia exclusão;
 * - SQL direto: inclusão forjada, UPDATE e DELETE recusados; isolamento entre tenants.
 * Dados fictícios.
 */
import { createHash } from "node:crypto";

import type postgres from "postgres";
import { NextRequest } from "next/server";
jest.mock("@/shared/db/env", () => ({
  getDatabaseUrl: () => process.env.INTEGRATION_APP_RUNTIME_URL,
}));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("@/shared/integrations/storage/documents-storage", () => {
  const actual = jest.requireActual("@/shared/integrations/storage/documents-storage");
  return {
    signedAsoPath: actual.signedAsoPath,
    SIGNED_DOWNLOAD_URL_TTL_SECONDS: actual.SIGNED_DOWNLOAD_URL_TTL_SECONDS,
    putSignedAsoObject: jest.fn(),
    removeDocumentObject: jest.fn(),
    getSignedDownloadUrl: jest.fn(),
  };
});
import type { TenantContext } from "@/shared/auth/require-tenant-context";
import {
  getSignedDownloadUrl,
  putSignedAsoObject,
  removeDocumentObject,
} from "@/shared/integrations/storage/documents-storage";
import {
  createHealthExam,
  deleteHealthExam,
  updateHealthExam,
} from "@/shared/db/repositories/health-exams";
import { registerMedicalRiskSource } from "@/shared/server/medicine/risk-source-core";
import {
  addProcedure,
  confirmExaminerConclusion,
  generateDocument,
} from "@/shared/server/medicine/aso-core";
import {
  listSignedAsos,
  registerSignedAso,
  signedAsoDownload,
} from "@/shared/server/medicine/aso-signed-core";
import {
  GET as LIST_SIGNED,
  POST as REGISTER,
} from "@/app/api/v1/health-exams/[id]/signed-asos/route";
import { GET as DOWNLOAD } from "@/app/api/v1/signed-asos/[id]/download/route";
import { registerDelivery } from "@/shared/server/medicine/aso-delivery-core";
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
const examiner: TenantContext = { ...owner, userId: "examiner", role: "collaborator" };
const ownerB: TenantContext = {
  tenantId: "org_b",
  userId: "owner-b",
  role: "owner",
  plan: "pro",
};
const COORDINATOR = "aaaaaaaa-0000-4000-8000-000000000051";
const EXAMINER = "aaaaaaaa-0000-4000-8000-000000000052";

const pdf = (text = "ASO assinado fictício") =>
  new File([`%PDF-1.7\n${text}\n%%EOF`], "aso.pdf", { type: "application/pdf" });
const sha = async (file: File) =>
  createHash("sha256")
    .update(new Uint8Array(await file.arrayBuffer()))
    .digest("hex");

const examinerFields = (
  previewDocumentId: string,
  overrides: Record<string, string> = {},
) => ({
  origin: "examiner",
  previewDocumentId,
  signatureMethod: "icp_brasil",
  verificationReference: "Verificador ITI, relatório fictício 001",
  signerName: "Dr. Examinador Fictício",
  signerRegistration: "70002",
  signerUf: "MA",
  conclusion: "unfit",
  signedOn: "2026-10-21",
  ...overrides,
});
const externalFields = (overrides: Record<string, string> = {}) => ({
  origin: "external_clinic",
  signatureMethod: "handwritten",
  verificationReference: "Original físico no arquivo da clínica fictícia, pasta 12",
  signerName: "Dra. Clínica Externa Fictícia",
  signerRegistration: "88001",
  signerUf: "PI",
  conclusion: "fit",
  signedOn: "2026-10-21",
  ...overrides,
});

const restReq = (ctx: TenantContext, method = "GET", body?: FormData) =>
  new NextRequest("http://localhost/api/v1/health-exams", {
    method,
    body,
    headers: {
      "x-dev-tenant": ctx.tenantId,
      "x-dev-user": ctx.userId,
      "x-dev-role": ctx.role,
    },
  });

(enabled ? describe : describe.skip)("ASO assinado (NOB-163)", () => {
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

  beforeEach(async () => {
    jest.clearAllMocks();
    (putSignedAsoObject as jest.Mock).mockResolvedValue(undefined);
    (removeDocumentObject as jest.Mock).mockResolvedValue(undefined);
    (getSignedDownloadUrl as jest.Mock).mockResolvedValue(
      "https://storage.example.test/signed",
    );
    await seedPgrBase(admin);
    await admin`insert into users (id,email) values ('owner','o@example.test'),('staff','s@example.test'),('doctor','d@example.test'),('examiner','e@example.test'),('owner-b','ob@example.test')`;
    await admin`insert into org_memberships (org_id,user_id,role) values ('org_a','owner','owner'),('org_a','staff','org:member'),('org_a','doctor','collaborator'),('org_a','examiner','collaborator'),('org_b','owner-b','owner')`;
    await admin`insert into medicos (id, org_id, name, crm, profession, registration_uf, rqe, affiliation, status) values
      (${COORDINATOR}, 'org_a', 'Dra. Coordenadora Fictícia', '70001', 'physician', 'MA', '961', 'internal', 'active'),
      (${EXAMINER}, 'org_a', 'Dr. Examinador Fictício', '70002', 'physician', 'MA', null, 'external', 'active')`;
    await admin`insert into pcmso_coordinator_assignments (org_id, company_id, medico_id, starts_on, created_by)
      values ('org_a', ${I.companyA}, ${COORDINATOR}, '2026-01-01', 'owner')`;
    await admin`update risks set noxious_agent_code='02.01.001' where id=${I.riskA}`;
    const source = await registerMedicalRiskSource(owner, I.companyA, {
      kind: "internal",
      pgrId: I.pgrA,
    });
    await admin`update medical_risk_entries set status='validated', reviewed_by='prof', reviewed_at=now() where source_id=${source.id}`;
    await link(owner, COORDINATOR, {
      userId: "doctor",
      reason: "Coordenadora fictícia.",
    });
    await link(owner, EXAMINER, { userId: "examiner", reason: "Examinador fictício." });
    process.env.APP_ENV = "local";
    process.env.DEV_API_AUTH_BYPASS = "true";
  });

  const examWithPreview = async () => {
    const exam = await createHealthExam("org_a", {
      employeeId: I.employeeA,
      doctorId: EXAMINER,
      examType: "periodic",
      performedAt: "2026-10-20",
      aptitude: "unfit",
    } as Parameters<typeof createHealthExam>[1]);
    const preview = await generateDocument(staff, exam.id);
    return { exam, preview };
  };

  it("fluxo A: só o examinador verificado, com o CRM/UF dele e a conclusão da prévia", async () => {
    const { exam, preview } = await examWithPreview();
    const file = pdf();
    const expectedHash = await sha(file);
    // Owner, colaborador e a coordenadora (verificada, mas não é a examinadora do exame): barrados.
    for (const ctx of [owner, staff, doctor])
      await expect(
        registerSignedAso(ctx, exam.id, examinerFields(preview.id), pdf()),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    // CRM divergente, conclusão divergente e data anterior ao exame.
    await expect(
      registerSignedAso(
        examiner,
        exam.id,
        examinerFields(preview.id, { signerRegistration: "70001" }),
        pdf(),
      ),
    ).rejects.toMatchObject({
      code: "VALIDATION",
      message: expect.stringMatching(/CRM/),
    });
    await expect(
      registerSignedAso(
        examiner,
        exam.id,
        examinerFields(preview.id, { conclusion: "fit" }),
        pdf(),
      ),
    ).rejects.toMatchObject({
      code: "VALIDATION",
      message: expect.stringMatching(/prévia/),
    });
    await expect(
      registerSignedAso(
        examiner,
        exam.id,
        examinerFields(preview.id, { signedOn: "2026-10-19" }),
        pdf(),
      ),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    // Cada falha depois do upload remove o arquivo (compensação).
    expect((removeDocumentObject as jest.Mock).mock.calls.length).toBe(
      (putSignedAsoObject as jest.Mock).mock.calls.length,
    );

    const created = await registerSignedAso(
      examiner,
      exam.id,
      examinerFields(preview.id),
      file,
    );
    expect(created).toMatchObject({
      origin: "examiner",
      previewDocumentId: preview.id,
      conclusion: "unfit",
      fileSha256: expectedHash,
      registeredBy: "examiner",
      replacedById: null,
    });
    const [path, bytes] = (putSignedAsoObject as jest.Mock).mock.calls.at(-1)!;
    expect(path).toBe(`org_a/aso-assinados/${exam.id}/${created.id}.pdf`);
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(expectedHash);
    expect(await listSignedAsos(staff, exam.id)).toHaveLength(1);
    const download = await signedAsoDownload(staff, created.id);
    expect(download).toMatchObject({
      sha256: expectedHash,
      expiresInSeconds: expect.any(Number),
    });
    expect(getSignedDownloadUrl).toHaveBeenCalledWith(path, expect.anything());

    // Identidade revogada: o examinador perde o fluxo A (servidor e SQL).
    await admin`insert into professional_identity_review_events (org_id, kind, verification_id, reason, actor_user_id)
      select org_id, 'revoked', id, 'Revogação fictícia de teste.', 'platform-verifier-test'
      from professional_identity_verifications where user_id = 'examiner'`;
    await expect(
      registerSignedAso(
        examiner,
        exam.id,
        {
          ...examinerFields(preview.id),
          replacesId: created.id,
          replaceReason: "Correção fictícia do documento.",
        },
        pdf(),
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("fluxo A: prévia antiga ou desatualizada não vira ASO oficial; nada é gravado nem enviado", async () => {
    const { exam, preview: v1 } = await examWithPreview();
    const examInput = {
      employeeId: I.employeeA,
      doctorId: EXAMINER,
      examType: "periodic",
      performedAt: "2026-10-20",
      aptitude: "unfit",
    };
    const edit = (overrides: Record<string, string>) =>
      updateHealthExam("org_a", exam.id, {
        ...examInput,
        ...overrides,
      } as Parameters<typeof updateHealthExam>[2]);
    const stale = {
      code: "VALIDATION",
      message: expect.stringMatching(/não corresponde mais ao exame/),
    };

    // Exame corrigido para apto depois da v1 (inapto): a v1 ainda é a mais recente, mas não é
    // mais a composição do exame.
    await edit({ aptitude: "fit" });
    await expect(
      registerSignedAso(examiner, exam.id, examinerFields(v1.id), pdf()),
    ).rejects.toMatchObject(stale);
    // Com a v2 gerada, a v1 também não é a mais recente (com qualquer conclusão).
    const v2 = await generateDocument(staff, exam.id);
    for (const conclusion of ["unfit", "fit"])
      await expect(
        registerSignedAso(
          examiner,
          exam.id,
          examinerFields(v1.id, { conclusion }),
          pdf(),
        ),
      ).rejects.toMatchObject(stale);

    // Examinador trocado para a coordenadora (verificada): ela não registra a partir da v2, que
    // nomeia o examinador anterior, mesmo com o CRM dela e a conclusão da prévia.
    await edit({ aptitude: "fit", doctorId: COORDINATOR });
    const asCoordinator = {
      conclusion: "fit",
      signerName: "Dra. Coordenadora Fictícia",
      signerRegistration: "70001",
    };
    await expect(
      registerSignedAso(doctor, exam.id, examinerFields(v2.id, asCoordinator), pdf()),
    ).rejects.toMatchObject(stale);

    // A conferência roda depois da autorização, no registro: cada arquivo enviado é removido
    // (compensação) e nenhum registro fica.
    const uploaded = (putSignedAsoObject as jest.Mock).mock.calls.map(([path]) => path);
    expect(uploaded.length).toBeGreaterThan(0);
    expect((removeDocumentObject as jest.Mock).mock.calls.map(([path]) => path)).toEqual(
      uploaded,
    );
    expect(await admin`select id from aso_signed_documents`).toHaveLength(0);
    jest.clearAllMocks();
    (putSignedAsoObject as jest.Mock).mockResolvedValue(undefined);
    (removeDocumentObject as jest.Mock).mockResolvedValue(undefined);

    // Prévia mais recente, gerada dos dados atuais: aceita.
    const v3 = await generateDocument(staff, exam.id);
    const created = await registerSignedAso(
      doctor,
      exam.id,
      examinerFields(v3.id, asCoordinator),
      pdf(),
    );
    expect(created).toMatchObject({
      origin: "examiner",
      previewDocumentId: v3.id,
      conclusion: "fit",
      registeredBy: "doctor",
      signerRegistration: "70001",
    });
    expect(putSignedAsoObject).toHaveBeenCalledTimes(1);
    expect(removeDocumentObject).not.toHaveBeenCalled();
  });

  it("MED-11: exame editado depois do ASO assinado vigente fica sinalizado; sem edição, sem aviso", async () => {
    const vigente = async (examId: string) =>
      (await listSignedAsos(staff, examId)).find((d) => d.replacedById === null);
    const examInput = {
      employeeId: I.employeeA,
      doctorId: EXAMINER,
      examType: "periodic",
      performedAt: "2026-10-20",
      aptitude: "unfit",
    };

    // Fluxo A: sem edição, sem aviso.
    const { exam, preview } = await examWithPreview();
    const created = await registerSignedAso(
      examiner,
      exam.id,
      examinerFields(preview.id),
      pdf(),
    );
    expect(await vigente(exam.id)).toMatchObject({ id: created.id, outdated: false });
    // A edição não é bloqueada (a correção exige nova prévia), mas o vigente passa a divergir.
    await updateHealthExam("org_a", exam.id, {
      ...examInput,
      aptitude: "fit",
    } as Parameters<typeof updateHealthExam>[2]);
    expect(await vigente(exam.id)).toMatchObject({ id: created.id, outdated: true });
    // O documento assinado continua como estava.
    const [stored] =
      await admin`select conclusion from aso_signed_documents where id=${created.id}`;
    expect(stored).toEqual({ conclusion: "unfit" });
    // Correção por substituição a partir de nova prévia: o novo vigente não diverge.
    const v2 = await generateDocument(staff, exam.id);
    const replacement = await registerSignedAso(
      examiner,
      exam.id,
      {
        ...examinerFields(v2.id, { conclusion: "fit" }),
        replacesId: created.id,
        replaceReason: "Aptidão corrigida no exame fictício.",
      },
      pdf("v2"),
    );
    expect(await vigente(exam.id)).toMatchObject({
      id: replacement.id,
      outdated: false,
    });
    // Exame complementar incluído depois da assinatura também diverge.
    await addProcedure(staff, exam.id, { code: "0281", performedAt: "2026-10-19" });
    expect(await vigente(exam.id)).toMatchObject({
      id: replacement.id,
      outdated: true,
    });
    // O substituído não leva o aviso (só o vigente).
    const list = await listSignedAsos(staff, exam.id);
    expect(list.find((d) => d.id === created.id)?.outdated).toBeUndefined();

    // Fluxo B: só a conclusão é comparável.
    const external = await createHealthExam("org_a", {
      employeeId: I.employeeA,
      examType: "admissional",
      performedAt: "2026-10-20",
      aptitude: "fit",
    } as Parameters<typeof createHealthExam>[1]);
    await registerSignedAso(staff, external.id, externalFields(), pdf("b1"));
    expect(await vigente(external.id)).toMatchObject({ outdated: false });
    await updateHealthExam("org_a", external.id, {
      employeeId: I.employeeA,
      examType: "admissional",
      performedAt: "2026-10-20",
      aptitude: "unfit",
    } as Parameters<typeof updateHealthExam>[2]);
    expect(await vigente(external.id)).toMatchObject({ outdated: true });
  });

  it("examinador não é apagado de exame com prévia ou confirmação; troca por outro médico segue permitida", async () => {
    const examInput = (doctorId: string | undefined, aptitude = "unfit") =>
      ({
        employeeId: I.employeeA,
        doctorId,
        examType: "periodic",
        performedAt: "2026-10-20",
        aptitude,
      }) as Parameters<typeof updateHealthExam>[2];
    const cleared = {
      code: "VALIDATION",
      message: expect.stringMatching(/não pode ser removido/),
    };

    // Com prévia arquivada: limpar o médico é recusado e nada muda.
    const { exam } = await examWithPreview();
    await expect(
      updateHealthExam("org_a", exam.id, examInput(undefined)),
    ).rejects.toMatchObject(cleared);
    const [row] = await admin`select doctor_id from health_exams where id=${exam.id}`;
    expect(row).toEqual({ doctor_id: EXAMINER });
    // Trocar por outro médico ativo continua permitido.
    await expect(
      updateHealthExam("org_a", exam.id, examInput(COORDINATOR)),
    ).resolves.toMatchObject({ doctorId: COORDINATOR });

    // Só a confirmação do examinador ("apto com restrição"), sem prévia: também recusado.
    const restricted = await createHealthExam(
      "org_a",
      examInput(EXAMINER, "fit_with_restrictions"),
    );
    await confirmExaminerConclusion(examiner, restricted.id, { conclusion: "fit" });
    await expect(
      updateHealthExam(
        "org_a",
        restricted.id,
        examInput(undefined, "fit_with_restrictions"),
      ),
    ).rejects.toMatchObject(cleared);

    // Exame sem prévia, ASO assinado ou confirmação: o médico pode ficar em branco.
    const plain = await createHealthExam("org_a", examInput(EXAMINER));
    await expect(
      updateHealthExam("org_a", plain.id, examInput(undefined)),
    ).resolves.toMatchObject({ doctorId: null });
  });

  it("NOB-110: CRM do cadastro com pontuação confere pela forma canônica; identidade e autoria intactas", async () => {
    const { exam, preview } = await examWithPreview();
    // Cadastro legado com pontuação. Alterar o cadastro invalida a verificação (comparação exata
    // da NOB-158, que esta correção não afrouxa): sem nova verificação, o examinador é barrado.
    await admin`update medicos set crm='70.002' where id=${EXAMINER}`;
    await expect(
      registerSignedAso(examiner, exam.id, examinerFields(preview.id), pdf()),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    // Verificação conferida com o CRM como está no cadastro (simula o operador independente).
    await admin`update professional_identity_verifications set crm='70.002' where medico_id=${EXAMINER} and user_id='examiner'`;
    // O CRM certo não autoriza ninguém além do examinador verificado.
    for (const ctx of [owner, staff, doctor])
      await expect(
        registerSignedAso(ctx, exam.id, examinerFields(preview.id), pdf()),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    // Número diferente, UF diferente e zero à esquerda a mais: não é o CRM do examinador.
    const bads: Record<string, string>[] = [
      { signerRegistration: "70003" },
      { signerUf: "PI" },
      { signerRegistration: "070002" },
    ];
    for (const bad of bads)
      await expect(
        registerSignedAso(examiner, exam.id, examinerFields(preview.id, bad), pdf()),
      ).rejects.toMatchObject({
        code: "VALIDATION",
        message: expect.stringMatching(/não é o do médico examinador/),
      });
    expect(await admin`select id from aso_signed_documents`).toHaveLength(0);

    // A prévia antiga imprime o registro anterior ("70002"): com o cadastro reformatado ela não é
    // mais a composição atual (lote 3). Nova prévia, assinada pelo examinador.
    const fresh = await generateDocument(staff, exam.id);
    // Só números e UF minúscula: confere; o signatário fica gravado como está no cadastro.
    const created = await registerSignedAso(
      examiner,
      exam.id,
      examinerFields(fresh.id, { signerRegistration: "70002", signerUf: "ma" }),
      pdf(),
    );
    expect(created).toMatchObject({
      origin: "examiner",
      registeredBy: "examiner",
      signerRegistration: "70.002",
      signerUf: "MA",
    });
    const [stored] =
      await admin`select signer_registration, signer_uf from aso_signed_documents where id=${created.id}`;
    expect(stored).toEqual({ signer_registration: "70.002", signer_uf: "MA" });
    // O cadastro continua como estava (nada é reescrito).
    const [medico] = await admin`select crm from medicos where id=${EXAMINER}`;
    expect(medico.crm).toBe("70.002");
  });

  it("NOB-110: CRM do cadastro com letras não é adivinhado; pede a correção do cadastro", async () => {
    const { exam, preview } = await examWithPreview();
    await admin`update medicos set crm='70002-MA' where id=${EXAMINER}`;
    await admin`update professional_identity_verifications set crm='70002-MA' where medico_id=${EXAMINER} and user_id='examiner'`;
    await expect(
      registerSignedAso(examiner, exam.id, examinerFields(preview.id), pdf()),
    ).rejects.toMatchObject({
      code: "VALIDATION",
      message: expect.stringMatching(/corrigir o cadastro/),
    });
    // Outro médico continua barrado antes de qualquer conferência de CRM.
    await expect(
      registerSignedAso(doctor, exam.id, examinerFields(preview.id), pdf()),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(await admin`select id from aso_signed_documents`).toHaveLength(0);
  });

  it("arquivo, conferência e campos: PDF de verdade, método com conferência, sem terceiro estado", async () => {
    const { exam, preview } = await examWithPreview();
    const notPdf = new File(["texto qualquer"], "aso.pdf", { type: "application/pdf" });
    await expect(
      registerSignedAso(examiner, exam.id, examinerFields(preview.id), notPdf),
    ).rejects.toMatchObject({
      code: "VALIDATION",
      message: expect.stringMatching(/PDF/),
    });
    await expect(
      registerSignedAso(examiner, exam.id, examinerFields(preview.id), null),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    const bads: Record<string, string>[] = [
      { verificationReference: "" },
      { conclusion: "fit_with_restrictions" },
      { signatureMethod: "simulated" },
      { previewDocumentId: "" },
    ];
    for (const bad of bads)
      await expect(
        registerSignedAso(examiner, exam.id, examinerFields(preview.id, bad), pdf()),
      ).rejects.toThrow();
    expect(putSignedAsoObject).not.toHaveBeenCalled();
  });

  it("fluxo B: equipe arquiva o ASO da clínica externa; substituição com motivo e histórico", async () => {
    const exam = await createHealthExam("org_a", {
      employeeId: I.employeeA,
      examType: "admissional",
      performedAt: "2026-10-20",
      aptitude: "fit",
    } as Parameters<typeof createHealthExam>[1]);
    const first = await registerSignedAso(staff, exam.id, externalFields(), pdf("v1"));
    expect(first).toMatchObject({ origin: "external_clinic", previewDocumentId: null });
    // Novo documento sem substituir o vigente: recusado.
    await expect(
      registerSignedAso(owner, exam.id, externalFields(), pdf("v2")),
    ).rejects.toMatchObject({
      code: "VALIDATION",
      message: expect.stringMatching(/substitui/),
    });
    await expect(
      registerSignedAso(
        owner,
        exam.id,
        { ...externalFields(), replacesId: first.id },
        pdf("v2"),
      ),
    ).rejects.toThrow();
    const second = await registerSignedAso(
      owner,
      exam.id,
      {
        ...externalFields(),
        replacesId: first.id,
        replaceReason: "Clínica reenviou com a data corrigida.",
      },
      pdf("v2"),
    );
    // Substituir de novo o antigo: não é mais o vigente.
    await expect(
      registerSignedAso(
        owner,
        exam.id,
        {
          ...externalFields(),
          replacesId: first.id,
          replaceReason: "Tentativa fictícia de nova cadeia.",
        },
        pdf("v3"),
      ),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    const list = await listSignedAsos(staff, exam.id);
    expect(list.map((d) => [d.id, d.replacedById])).toEqual([
      [first.id, second.id],
      [second.id, null],
    ]);
    // O substituído continua acessível; o histórico bloqueia a exclusão do exame.
    await expect(signedAsoDownload(staff, first.id)).resolves.toMatchObject({
      url: expect.any(String),
    });
    await expect(deleteHealthExam("org_a", exam.id)).rejects.toMatchObject({
      code: "IN_USE",
    });
  });

  it("SQL direto: inclusão forjada, UPDATE e DELETE recusados", async () => {
    const { exam, preview } = await examWithPreview();
    const created = await registerSignedAso(
      examiner,
      exam.id,
      examinerFields(preview.id),
      pdf(),
    );
    const as = (actor: string, fn: (tx: postgres.TransactionSql) => Promise<unknown>) =>
      runtime.begin(async (tx) => {
        await tx`select set_config('app.current_org', 'org_a', true), set_config('app.current_actor', ${actor}, true)`;
        return fn(tx);
      });
    const forged = (actor: string, origin: string, preview: string | null) =>
      as(
        actor,
        (
          tx,
        ) => tx`insert into aso_signed_documents (id, org_id, company_id, health_exam_id, origin, preview_document_id,
          signature_method, verification_reference, signer_name, signer_registration, signer_uf, conclusion, signed_on,
          storage_path, file_sha256, size_bytes, registered_by)
        values (gen_random_uuid(), 'org_a', ${I.companyA}, ${exam.id}, ${origin}, ${preview}, 'icp_brasil', 'Forjado fictício',
          'Dr. Examinador Fictício', '70002', 'MA', 'unfit', '2026-10-21', ${"org_a/x/" + Math.random()}, ${"a".repeat(64)}, 10, ${actor})`,
      );
    // Owner forjando o fluxo A; conta de fora do escritório forjando o fluxo B.
    await expect(forged("owner", "examiner", preview.id)).rejects.toMatchObject({
      code: "42501",
    });
    await expect(forged("intruso", "external_clinic", null)).rejects.toMatchObject({
      code: "42501",
    });
    await expect(
      as(
        "examiner",
        (tx) =>
          tx`update aso_signed_documents set conclusion='fit' where id=${created.id}`,
      ),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      as("owner", (tx) => tx`delete from aso_signed_documents where id=${created.id}`),
    ).rejects.toMatchObject({ code: "42501" });
  });

  it("REST: multipart 201, lista, download; outro tenant 404; perfil cliente 403", async () => {
    const { exam, preview } = await examWithPreview();
    const params = { params: Promise.resolve({ id: exam.id }) };
    const form = new FormData();
    for (const [k, v] of Object.entries(examinerFields(preview.id))) form.set(k, v);
    form.set("file", pdf());
    const res = await REGISTER(restReq(examiner, "POST", form), params);
    expect(res.status).toBe(201);
    const { id } = await res.json();
    expect((await LIST_SIGNED(restReq(staff), params)).status).toBe(200);
    const dl = await DOWNLOAD(restReq(staff), { params: Promise.resolve({ id }) });
    expect(dl.status).toBe(200);
    expect(await dl.json()).toMatchObject({ url: "https://storage.example.test/signed" });
    expect((await LIST_SIGNED(restReq(ownerB), params)).status).toBe(404);
    expect(
      (await DOWNLOAD(restReq(ownerB), { params: Promise.resolve({ id }) })).status,
    ).toBe(404);
    expect(
      (await LIST_SIGNED(restReq({ ...owner, role: "client" }), params)).status,
    ).toBe(403);
    await expect(listSignedAsos(ownerB, exam.id)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  /**
   * Lote 4 — vigência única do ASO assinado. Vigente = registro que nenhum outro substitui, por exame.
   * Com `replaces_id` único e a FK composta (substituição só no mesmo exame), as versões formam
   * cadeias, e o número de vigentes é o número de raízes (`replaces_id` nulo). O banco passa a recusar
   * uma segunda raiz (e qualquer inclusão quando já há mais de uma vigente), inclusive por SQL direto e
   * sob concorrência; o app não escolhe uma vigente quando o legado tem mais de uma.
   */
  describe("vigência única do ASO assinado (lote 4)", () => {
    const insertRoot = (
      client: postgres.Sql,
      actor: string,
      examId: string,
      { replacesId = null as string | null, holdMs = 0 } = {},
    ) =>
      client.begin(async (tx) => {
        await tx`select set_config('app.current_org', 'org_a', true), set_config('app.current_actor', ${actor}, true)`;
        await tx`insert into aso_signed_documents (id, org_id, company_id, health_exam_id, origin, preview_document_id,
          signature_method, verification_reference, signer_name, signer_registration, signer_uf, conclusion, signed_on,
          storage_path, file_sha256, size_bytes, registered_by, replaces_id, replace_reason)
        values (gen_random_uuid(), 'org_a', ${I.companyA}, ${examId}, 'external_clinic', null, 'handwritten',
          'Conferência fictícia da clínica', 'Dra. Clínica Fictícia', '80001', 'MA', 'unfit', '2026-10-21',
          ${"org_a/x/" + Math.random()}, ${"b".repeat(64)}, 10, ${actor}, ${replacesId},
          ${replacesId ? "Substituição fictícia por SQL." : null})`;
        if (holdMs) await tx`select pg_sleep(${holdMs / 1000})`;
      });
    const count = async (examId: string) =>
      Number(
        (
          await admin`select count(*)::int as n from aso_signed_documents where health_exam_id=${examId}`
        )[0].n,
      );
    /** Semeia legado sem a regra (como registros anteriores à 0082): gatilho desligado só no seed. */
    const toggleGuard = (on: boolean) =>
      admin.unsafe(
        `do $do$ begin
          if exists (select 1 from pg_trigger where tgname = 'aso_signed_current_guard')
          then alter table public.aso_signed_documents ${on ? "enable" : "disable"} trigger aso_signed_current_guard;
          end if; end $do$`,
      );
    const seedLegacyRoot = async (examId: string) => {
      await toggleGuard(false);
      try {
        await admin`insert into aso_signed_documents (id, org_id, company_id, health_exam_id, origin, preview_document_id,
          signature_method, verification_reference, signer_name, signer_registration, signer_uf, conclusion, signed_on,
          storage_path, file_sha256, size_bytes, registered_by)
        values (gen_random_uuid(), 'org_a', ${I.companyA}, ${examId}, 'external_clinic', null, 'handwritten',
          'Legado fictício', 'Dra. Clínica Fictícia', '80001', 'MA', 'unfit', '2026-10-21',
          ${"org_a/legado/" + Math.random()}, ${"c".repeat(64)}, 10, 'staff')`;
      } finally {
        await toggleGuard(true);
      }
    };

    it("SQL direto: segunda versão raiz com um ASO vigente é recusada; nada é gravado", async () => {
      const { exam, preview } = await examWithPreview();
      await registerSignedAso(examiner, exam.id, examinerFields(preview.id), pdf());
      await expect(insertRoot(runtime, "staff", exam.id)).rejects.toMatchObject({
        code: "23505",
        constraint_name: "aso_signed_current_unique",
      });
      expect(await count(exam.id)).toBe(1);
    });

    it("concorrência: duas versões raiz simultâneas, em conexões separadas → só uma é gravada", async () => {
      const { exam } = await examWithPreview();
      const url = process.env.INTEGRATION_APP_RUNTIME_URL!;
      const pg = (await import("postgres")).default;
      const a = pg(url, { max: 1, prepare: false });
      const b = pg(url, { max: 1, prepare: false });
      try {
        const results = await Promise.allSettled([
          insertRoot(a, "staff", exam.id, { holdMs: 400 }),
          insertRoot(b, "staff", exam.id, { holdMs: 400 }),
        ]);
        expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
        expect(await count(exam.id)).toBe(1);
      } finally {
        await a.end({ timeout: 5 });
        await b.end({ timeout: 5 });
      }
    });

    it("substituição da vigente segue valendo; substituir versão já substituída é recusado; histórico preservado", async () => {
      const { exam } = await examWithPreview();
      await insertRoot(runtime, "staff", exam.id);
      const [first] =
        await admin`select id from aso_signed_documents where health_exam_id=${exam.id}`;
      await insertRoot(runtime, "staff", exam.id, { replacesId: first.id });
      // Reativar/forkar a versão antiga: substituí-la de novo é recusado.
      await expect(
        insertRoot(runtime, "staff", exam.id, { replacesId: first.id }),
      ).rejects.toMatchObject({ code: "23505" });
      expect(await count(exam.id)).toBe(2);
      const current = (await listSignedAsos(staff, exam.id)).filter(
        (d) => d.replacedById === null,
      );
      expect(current).toHaveLength(1);
    });

    it("outro exame do mesmo trabalhador não compete pela vigência", async () => {
      const { exam } = await examWithPreview();
      const { exam: other } = await examWithPreview();
      await insertRoot(runtime, "staff", exam.id);
      await insertRoot(runtime, "staff", other.id);
      expect(await count(exam.id)).toBe(1);
      expect(await count(other.id)).toBe(1);
    });

    it("legado com duas vigentes: nenhuma é escolhida; substituição e entrega falham fechado; nada é apagado", async () => {
      const { exam } = await examWithPreview();
      await seedLegacyRoot(exam.id);
      await seedLegacyRoot(exam.id);
      const items = await listSignedAsos(staff, exam.id);
      expect(items).toHaveLength(2);
      expect(items.some((d) => "outdated" in d)).toBe(false);
      const [one] =
        await admin`select id from aso_signed_documents where health_exam_id=${exam.id} limit 1`;
      const replacement = {
        origin: "external_clinic",
        signatureMethod: "handwritten",
        verificationReference: "Conferência fictícia da clínica",
        signerName: "Dra. Clínica Fictícia",
        signerRegistration: "80001",
        signerUf: "MA",
        conclusion: "unfit",
        signedOn: "2026-10-21",
        replacesId: one.id,
        replaceReason: "Substituição fictícia de legado.",
      };
      await expect(
        registerSignedAso(staff, exam.id, replacement, pdf()),
      ).rejects.toMatchObject({
        code: "DUPLICATE",
        message: expect.stringMatching(/mais de um documento assinado vigente/),
      });
      // SQL direto também não "resolve" substituindo uma delas.
      await expect(
        insertRoot(runtime, "staff", exam.id, { replacesId: one.id }),
      ).rejects.toMatchObject({
        code: "23505",
        constraint_name: "aso_signed_current_unique",
      });
      await expect(
        registerDelivery(
          staff,
          exam.id,
          {
            kind: "made_available",
            method: "physical_copy",
            occurredAt: "2026-10-22T10:30",
            evidenceReference: "Entregue em mãos (fictício)",
          },
          null,
        ),
      ).rejects.toMatchObject({
        code: "DUPLICATE",
        message: expect.stringMatching(/mais de um documento assinado vigente/),
      });
      expect(await count(exam.id)).toBe(2);
    });
  });
});
