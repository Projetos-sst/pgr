/**
 * Entrega do ASO ao trabalhador (NOB-165; MED-13; NR-7 7.5.19) contra Postgres efêmero. Storage
 * simulado; banco, RLS e regras reais:
 * - só ASO assinado vigente é entregue (prévia recusada); documento e hash vêm do banco;
 * - registrada × comprovada × ciência confirmada (só com recibo assinado pelo trabalhador);
 * - pedido de via física fica pendente até uma via física entregue depois dele;
 * - substituição do ASO exige nova entrega; histórico preservado; correção com motivo;
 * - comprovante conferido pelos bytes, SHA-256 no servidor, download por URL curta;
 * - SQL direto: autoria, trabalhador, documento substituído, UPDATE e DELETE recusados.
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
    signedAsoPath: actual.signedAsoPath,
    asoDeliveryEvidencePath: actual.asoDeliveryEvidencePath,
    SIGNED_DOWNLOAD_URL_TTL_SECONDS: actual.SIGNED_DOWNLOAD_URL_TTL_SECONDS,
    putSignedAsoObject: jest.fn(),
    putAsoDeliveryEvidence: jest.fn(),
    removeDocumentObject: jest.fn(),
    getSignedDownloadUrl: jest.fn(),
  };
});
import type { TenantContext } from "@/shared/auth/require-tenant-context";
import {
  getSignedDownloadUrl,
  putAsoDeliveryEvidence,
  putSignedAsoObject,
  removeDocumentObject,
} from "@/shared/integrations/storage/documents-storage";
import { createHealthExam } from "@/shared/db/repositories/health-exams";
import { registerMedicalRiskSource } from "@/shared/server/medicine/risk-source-core";
import { generateDocument } from "@/shared/server/medicine/aso-core";
import { registerSignedAso } from "@/shared/server/medicine/aso-signed-core";
import {
  deliveryEvidenceDownload,
  listDeliveries,
  registerDelivery,
  voidDelivery,
} from "@/shared/server/medicine/aso-delivery-core";
import {
  GET as LIST_DELIVERIES,
  POST as REGISTER_DELIVERY,
} from "@/app/api/v1/health-exams/[id]/aso-deliveries/route";
import { POST as VOID_DELIVERY } from "@/app/api/v1/health-exams/[id]/aso-deliveries/[deliveryId]/void/route";
import { GET as EVIDENCE } from "@/app/api/v1/aso-deliveries/[id]/evidence/route";
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
const ownerB: TenantContext = {
  tenantId: "org_b",
  userId: "owner-b",
  role: "owner",
  plan: "pro",
};
const EMPLOYEE_A2 = "aaaaaaaa-0000-4000-8000-0000000000e2";

const file = (body: string, name: string, type: string) =>
  new File([body], name, { type });
const pdf = (text = "documento fictício") =>
  file(`%PDF-1.7\n${text}\n%%EOF`, "a.pdf", "application/pdf");
const png = () =>
  new File(
    [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3])],
    "r.png",
    {
      type: "image/png",
    },
  );

const external = (overrides: Record<string, string> = {}) => ({
  origin: "external_clinic",
  signatureMethod: "handwritten",
  verificationReference: "Original físico na pasta fictícia 12",
  signerName: "Dra. Clínica Externa Fictícia",
  signerRegistration: "88001",
  signerUf: "PI",
  conclusion: "fit",
  signedOn: "2026-10-21",
  ...overrides,
});
const delivery = (overrides: Record<string, string | undefined> = {}) => ({
  kind: "made_available",
  method: "physical_copy",
  occurredAt: "2026-10-22T10:30",
  evidenceReference: "Entregue em mãos pela técnica fictícia",
  ...overrides,
});

const restReq = (ctx: TenantContext, method = "GET", body?: FormData | string) =>
  new NextRequest("http://localhost/api/v1/health-exams", {
    method,
    body,
    headers: {
      "x-dev-tenant": ctx.tenantId,
      "x-dev-user": ctx.userId,
      "x-dev-role": ctx.role,
      ...(typeof body === "string" ? { "content-type": "application/json" } : {}),
    },
  });

(enabled ? describe : describe.skip)("Entrega do ASO (NOB-165)", () => {
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
    for (const fn of [putSignedAsoObject, putAsoDeliveryEvidence, removeDocumentObject])
      (fn as jest.Mock).mockResolvedValue(undefined);
    (getSignedDownloadUrl as jest.Mock).mockResolvedValue(
      "https://storage.example.test/signed",
    );
    await seedPgrBase(admin);
    await admin`insert into users (id,email) values ('owner','o@example.test'),('staff','s@example.test'),('client','c@example.test'),('owner-b','ob@example.test')`;
    await admin`insert into org_memberships (org_id,user_id,role) values ('org_a','owner','owner'),('org_a','staff','org:member'),('org_a','client','org:client'),('org_b','owner-b','owner')`;
    await admin`insert into employees (id, org_id, company_id, ges_id, job_role_id, full_name, cpf)
      values (${EMPLOYEE_A2}, 'org_a', ${I.companyA}, ${I.gesA}, ${I.jobRoleA}, 'Func A2', '11122233344')`;
    process.env.APP_ENV = "local";
    process.env.DEV_API_AUTH_BYPASS = "true";
  });

  const exam = (employeeId = I.employeeA) =>
    createHealthExam("org_a", {
      employeeId,
      examType: "admissional",
      performedAt: "2026-10-20",
      aptitude: "fit",
    } as Parameters<typeof createHealthExam>[1]);
  const signedExam = async () => {
    const e = await exam();
    const doc = await registerSignedAso(staff, e.id, external(), pdf("aso v1"));
    return { exam: e, doc };
  };
  const state = async (examId: string) => (await listDeliveries(staff, examId)).summary;

  it("prévia não é entregue; sem comprovante fica só registrada; recibo assinado confirma a ciência", async () => {
    // Exame só com prévia (examinador cadastrado): entrega recusada.
    const examinerId = "aaaaaaaa-0000-4000-8000-0000000000d1";
    await admin`insert into medicos (id, org_id, name, crm, profession, registration_uf, status)
      values (${examinerId}, 'org_a', 'Dr. Fictício', '70002', 'physician', 'MA', 'active')`;
    await admin`update risks set noxious_agent_code='02.01.001' where id=${I.riskA}`;
    const source = await registerMedicalRiskSource(owner, I.companyA, {
      kind: "internal",
      pgrId: I.pgrA,
    });
    await admin`update medical_risk_entries set status='validated', reviewed_by='prof', reviewed_at=now() where source_id=${source.id}`;
    const withPreview = await createHealthExam("org_a", {
      employeeId: I.employeeA,
      doctorId: examinerId,
      examType: "periodic",
      performedAt: "2026-10-20",
      aptitude: "unfit",
    } as Parameters<typeof createHealthExam>[1]);
    await generateDocument(staff, withPreview.id);
    await expect(
      registerDelivery(staff, withPreview.id, delivery(), null),
    ).rejects.toMatchObject({
      code: "VALIDATION",
      message: expect.stringMatching(/prévia/),
    });

    const { exam: e, doc } = await signedExam();
    expect(await state(e.id)).toEqual({
      state: "none",
      physicalCopyPending: false,
      previousVersionDelivered: false,
    });
    const registered = await registerDelivery(staff, e.id, delivery(), null);
    expect(registered).toMatchObject({
      kind: "made_available",
      signedDocumentId: doc.id,
      documentSha256: doc.fileSha256,
      employeeId: I.employeeA,
      recordedBy: "staff",
      hasEvidence: false,
    });
    expect(registered).not.toHaveProperty("evidencePath");
    expect((await state(e.id)).state).toBe("registered");

    // Comprovante do canal: comprovada, mas não é ciência do trabalhador.
    await registerDelivery(
      staff,
      e.id,
      delivery({
        method: "digital_copy",
        channelDescription: "E-mail pessoal informado pelo trabalhador",
        evidenceKind: "channel_confirmation",
      }),
      pdf("confirmação de leitura"),
    );
    expect((await state(e.id)).state).toBe("proven");
    const withReceipt = await registerDelivery(
      staff,
      e.id,
      delivery({
        evidenceKind: "signed_receipt",
        evidenceReference: "Recibo assinado digitalizado",
      }),
      png(),
    );
    expect(withReceipt).toMatchObject({
      evidenceKind: "signed_receipt",
      evidenceContentType: "image/png",
      hasEvidence: true,
    });
    const [path] = (putAsoDeliveryEvidence as jest.Mock).mock.calls.at(-1)!;
    expect(path).toBe(`org_a/aso-entregas/${e.id}/${withReceipt.id}.png`);
    expect((await state(e.id)).state).toBe("acknowledged");
    const dl = await deliveryEvidenceDownload(staff, withReceipt.id);
    expect(dl).toMatchObject({
      sha256: withReceipt.evidenceSha256,
      expiresInSeconds: expect.any(Number),
    });
    await expect(deliveryEvidenceDownload(staff, registered.id)).rejects.toMatchObject({
      code: "VALIDATION",
    });
  });

  it("comprovante e campos: tipo pelos bytes, tipo do comprovante, canal da cópia digital, data", async () => {
    const { exam: e } = await signedExam();
    await expect(
      registerDelivery(
        staff,
        e.id,
        delivery({ evidenceKind: "signed_receipt" }),
        file("texto", "r.pdf", "application/pdf"),
      ),
    ).rejects.toMatchObject({
      code: "VALIDATION",
      message: expect.stringMatching(/PDF, JPEG ou PNG/),
    });
    await expect(registerDelivery(staff, e.id, delivery(), pdf())).rejects.toMatchObject({
      code: "VALIDATION",
      message: expect.stringMatching(/tipo do comprovante/),
    });
    await expect(
      registerDelivery(staff, e.id, delivery({ evidenceKind: "signed_receipt" }), null),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    for (const bad of [
      { method: "digital_copy" },
      { evidenceReference: "" },
      { occurredAt: "2026-10-20T09:00" },
      { occurredAt: "2099-01-01T09:00" },
      { kind: "physical_copy_requested" },
    ])
      await expect(registerDelivery(staff, e.id, delivery(bad), null)).rejects.toThrow();
    expect(putAsoDeliveryEvidence).not.toHaveBeenCalled();
    expect((await listDeliveries(staff, e.id)).deliveries).toHaveLength(0);
  });

  it("via física: pedido fica pendente até uma via física entregue depois dele", async () => {
    const { exam: e } = await signedExam();
    await registerDelivery(
      staff,
      e.id,
      delivery({
        method: "digital_copy",
        channelDescription: "Aplicativo corporativo fictício",
      }),
      null,
    );
    await registerDelivery(
      staff,
      e.id,
      {
        kind: "physical_copy_requested",
        occurredAt: "2026-10-23T08:00",
        evidenceReference: "Pedido verbal ao RH",
      },
      null,
    );
    expect((await state(e.id)).physicalCopyPending).toBe(true);
    // Via física com data anterior ao pedido não atende.
    await registerDelivery(
      staff,
      e.id,
      delivery({ occurredAt: "2026-10-22T08:00" }),
      null,
    );
    expect((await state(e.id)).physicalCopyPending).toBe(true);
    await registerDelivery(
      staff,
      e.id,
      delivery({ occurredAt: "2026-10-24T09:00" }),
      null,
    );
    expect((await state(e.id)).physicalCopyPending).toBe(false);
  });

  it("substituição exige nova entrega; histórico preservado; correção com motivo", async () => {
    const { exam: e, doc } = await signedExam();
    const first = await registerDelivery(
      staff,
      e.id,
      delivery({ evidenceKind: "signed_receipt" }),
      pdf("recibo"),
    );
    expect((await state(e.id)).state).toBe("acknowledged");
    const v2 = await registerSignedAso(
      owner,
      e.id,
      {
        ...external(),
        replacesId: doc.id,
        replaceReason: "Clínica reenviou com a data corrigida.",
      },
      pdf("aso v2"),
    );
    expect(await state(e.id)).toMatchObject({
      state: "none",
      previousVersionDelivered: true,
    });
    const second = await registerDelivery(
      staff,
      e.id,
      delivery({ occurredAt: "2026-10-25T10:00" }),
      null,
    );
    expect(second).toMatchObject({
      signedDocumentId: v2.id,
      documentSha256: v2.fileSha256,
    });
    const listed = (await listDeliveries(staff, e.id)).deliveries;
    expect(listed.map((d) => d.signedDocumentId)).toEqual([doc.id, v2.id]);
    expect((await state(e.id)).state).toBe("registered");

    // Correção do registro atual: volta a "não registrada"; o original continua no histórico.
    const voided = await voidDelivery(staff, e.id, second.id, {
      reason: "Registrada por engano na ficha errada.",
    });
    expect(voided).toMatchObject({ kind: "voided", voidsId: second.id });
    expect((await state(e.id)).state).toBe("none");
    await expect(
      voidDelivery(staff, e.id, second.id, {
        reason: "Segunda correção fictícia indevida.",
      }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(
      voidDelivery(staff, e.id, voided.id, { reason: "Correção de correção fictícia." }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(
      voidDelivery(staff, e.id, first.id, { reason: "curto" }),
    ).rejects.toThrow();
    expect((await listDeliveries(staff, e.id)).deliveries).toHaveLength(3);
  });

  it("SQL direto: autoria, trabalhador, empresa, documento substituído, UPDATE e DELETE", async () => {
    const { exam: e, doc } = await signedExam();
    const created = await registerDelivery(staff, e.id, delivery(), null);
    const as = (actor: string, fn: (tx: postgres.TransactionSql) => Promise<unknown>) =>
      runtime.begin(async (tx) => {
        await tx`select set_config('app.current_org', 'org_a', true), set_config('app.current_actor', ${actor}, true)`;
        return fn(tx);
      });
    const forge = (
      actor: string,
      o: {
        recordedBy?: string;
        employeeId?: string;
        companyId?: string;
        docId?: string;
        sha?: string;
      } = {},
    ) =>
      as(
        actor,
        (
          tx,
        ) => tx`insert into aso_deliveries (id, org_id, company_id, health_exam_id, employee_id, signed_document_id,
          document_sha256, kind, method, occurred_at, evidence_reference, recorded_by)
        values (gen_random_uuid(), 'org_a', ${o.companyId ?? I.companyA}, ${e.id}, ${o.employeeId ?? I.employeeA},
          ${o.docId ?? doc.id}, ${o.sha ?? doc.fileSha256}, 'made_available', 'physical_copy', now(), 'Forjado fictício', ${o.recordedBy ?? actor})`,
      );
    await expect(forge("staff", { recordedBy: "owner" })).rejects.toMatchObject({
      code: "42501",
    });
    await expect(forge("client")).rejects.toMatchObject({ code: "42501" });
    await expect(forge("intruso")).rejects.toMatchObject({ code: "42501" });
    await expect(forge("staff", { employeeId: EMPLOYEE_A2 })).rejects.toMatchObject({
      code: "42501",
    });
    await expect(forge("staff", { sha: "f".repeat(64) })).rejects.toMatchObject({
      code: "42501",
    });
    await expect(
      forge("staff", { companyId: "cccccccc-0000-4000-8000-0000000000c9" }),
    ).rejects.toMatchObject({
      code: expect.stringMatching(/42501|23503/),
    });
    await registerSignedAso(
      owner,
      e.id,
      {
        ...external(),
        replacesId: doc.id,
        replaceReason: "Substituição fictícia para o teste.",
      },
      pdf("v2"),
    );
    await expect(forge("staff")).rejects.toMatchObject({ code: "42501" });
    await expect(
      as(
        "staff",
        (tx) => tx`update aso_deliveries set kind='voided' where id=${created.id}`,
      ),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      as("owner", (tx) => tx`delete from aso_deliveries where id=${created.id}`),
    ).rejects.toMatchObject({ code: "42501" });
  });

  it("REST: multipart 201, lista com situação, correção, comprovante; outro tenant 404; cliente 403", async () => {
    const { exam: e } = await signedExam();
    const params = { params: Promise.resolve({ id: e.id }) };
    const form = new FormData();
    for (const [k, v] of Object.entries(delivery({ evidenceKind: "signed_receipt" })))
      if (v) form.set(k, v);
    form.set("evidence", pdf("recibo"));
    const res = await REGISTER_DELIVERY(restReq(staff, "POST", form), params);
    expect(res.status).toBe(201);
    const { id } = await res.json();
    const list = await LIST_DELIVERIES(restReq(staff), params);
    expect(list.status).toBe(200);
    expect((await list.json()).summary.state).toBe("acknowledged");
    const ev = await EVIDENCE(restReq(staff), { params: Promise.resolve({ id }) });
    expect(ev.status).toBe(200);
    expect(
      (await EVIDENCE(restReq(ownerB), { params: Promise.resolve({ id }) })).status,
    ).toBe(404);
    expect((await LIST_DELIVERIES(restReq(ownerB), params)).status).toBe(404);
    expect(
      (
        await LIST_DELIVERIES(
          restReq({ ...owner, userId: "client", role: "client" }),
          params,
        )
      ).status,
    ).toBe(403);
    const voided = await VOID_DELIVERY(
      restReq(
        staff,
        "POST",
        JSON.stringify({ reason: "Recibo de outro trabalhador anexado por engano." }),
      ),
      { params: Promise.resolve({ id: e.id, deliveryId: id }) },
    );
    expect(voided.status).toBe(201);
    await expect(registerDelivery(ownerB, e.id, delivery(), null)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});
