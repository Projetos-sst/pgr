/**
 * Conferência auditada do comprovante de entrega do ASO (NOB-167; MED-13; NR-7 7.5.19). Postgres
 * efêmero, storage simulado. Upload não é conferência; escolher "recibo assinado" não prova autoria;
 * só uma conferência humana explícita, ligada ao arquivo e ao hash, muda a situação. Dados fictícios.
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
import { registerSignedAso } from "@/shared/server/medicine/aso-signed-core";
import {
  deliveryEvidenceDownload,
  listDeliveries,
  registerDelivery,
  reviewDeliveryEvidence,
  voidDelivery,
} from "@/shared/server/medicine/aso-delivery-core";
import { POST as REVIEW } from "@/app/api/v1/health-exams/[id]/aso-deliveries/[deliveryId]/review/route";
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
const EMPLOYEE_A2 = "aaaaaaaa-0000-4000-8000-0000000000e7";
const SECRET_NOTE = "Observação clínica sigilosa fictícia";

const pdf = (text = "documento fictício") =>
  new File([`%PDF-1.7\n${text}\n%%EOF`], "a.pdf", { type: "application/pdf" });
const external = {
  origin: "external_clinic",
  signatureMethod: "handwritten",
  verificationReference: "Original físico na pasta fictícia 12",
  signerName: "Dra. Clínica Externa Fictícia",
  signerRegistration: "88001",
  signerUf: "PI",
  conclusion: "fit",
  signedOn: "2026-10-21",
};
const delivery = (overrides: Record<string, string | undefined> = {}) => ({
  kind: "made_available",
  method: "physical_copy",
  occurredAt: "2026-10-22T10:30",
  evidenceReference: "Entregue em mãos pela técnica fictícia",
  ...overrides,
});
const documentary = {
  method: "documentary",
  result: "confirmed",
  reference: "Nome e CPF do recibo conferidos com a ficha",
};
const witnessed = {
  method: "signature_witnessed",
  result: "confirmed",
  reference: "Assinou na minha presença; RG conferido",
};
const reviewReq = (ctx: TenantContext, body: unknown) =>
  new NextRequest("http://localhost/api/v1/health-exams", {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      "x-dev-tenant": ctx.tenantId,
      "x-dev-user": ctx.userId,
      "x-dev-role": ctx.role,
    },
  });

(enabled ? describe : describe.skip)(
  "Conferência do comprovante de entrega do ASO (NOB-167)",
  () => {
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
      values (${EMPLOYEE_A2}, 'org_a', ${I.companyA}, ${I.gesA}, ${I.jobRoleA}, 'Func A2', '11122233355')`;
      process.env.APP_ENV = "local";
      process.env.DEV_API_AUTH_BYPASS = "true";
    });

    const signedExam = async () => {
      const e = await createHealthExam("org_a", {
        employeeId: I.employeeA,
        examType: "admissional",
        performedAt: "2026-10-20",
        aptitude: "fit",
      } as Parameters<typeof createHealthExam>[1]);
      const doc = await registerSignedAso(staff, e.id, external, pdf("aso v1"));
      return { exam: e, doc };
    };
    const state = async (examId: string) =>
      (await listDeliveries(staff, examId)).summary.state;
    const receiptOf = (examId: string, text: string) =>
      registerDelivery(
        staff,
        examId,
        delivery({ evidenceKind: "signed_receipt" }),
        pdf(text),
      );

    it("reprodução: arquivo arbitrário marcado como recibo assinado não confirma recebimento", async () => {
      const { exam: e } = await signedExam();
      await receiptOf(e.id, "qualquer arquivo, sem assinatura do trabalhador");
      expect(await state(e.id)).toBe("evidence_pending");
    });

    it("conferência legítima é auditada: documental vira 'conferido'; presenciada vira recebimento confirmado", async () => {
      const { exam: e, doc } = await signedExam();
      const receipt = await receiptOf(e.id, "recibo");
      const review = await reviewDeliveryEvidence(staff, e.id, receipt.id, documentary);
      expect(review).toMatchObject({
        kind: "evidence_reviewed",
        reviewsId: receipt.id,
        reviewedEvidenceSha256: receipt.evidenceSha256,
        reviewedEvidenceKind: "signed_receipt",
        reviewMethod: "documentary",
        reviewResult: "confirmed",
        reviewReference: documentary.reference,
        recordedBy: "staff",
        signedDocumentId: doc.id,
        employeeId: I.employeeA,
      });
      expect(Date.now() - Date.parse(review.recordedAt)).toBeLessThan(60_000);
      expect(await state(e.id)).toBe("evidence_checked");
      // Duplicata indevida do mesmo comprovante.
      await expect(
        reviewDeliveryEvidence(staff, e.id, receipt.id, witnessed),
      ).rejects.toMatchObject({ code: "VALIDATION" });
      const second = await receiptOf(e.id, "recibo 2");
      expect(await state(e.id)).toBe("evidence_checked");
      await reviewDeliveryEvidence(owner, e.id, second.id, witnessed);
      expect(await state(e.id)).toBe("receipt_confirmed");
    });

    it("conferência recusada não confirma; presenciada só vale para recibo assinado; sem arquivo não se confere", async () => {
      const { exam: e } = await signedExam();
      const channel = await registerDelivery(
        staff,
        e.id,
        delivery({
          method: "digital_copy",
          channelDescription: "E-mail informado pelo trabalhador",
          evidenceKind: "channel_confirmation",
        }),
        pdf("confirmação"),
      );
      expect(await state(e.id)).toBe("evidence_pending");
      await expect(
        reviewDeliveryEvidence(staff, e.id, channel.id, witnessed),
      ).rejects.toMatchObject({ code: "VALIDATION" });
      await reviewDeliveryEvidence(staff, e.id, channel.id, {
        ...documentary,
        result: "rejected",
        reference: "Confirmação ilegível",
      });
      expect(await state(e.id)).toBe("evidence_rejected");
      const plain = await registerDelivery(staff, e.id, delivery(), null);
      await expect(
        reviewDeliveryEvidence(staff, e.id, plain.id, documentary),
      ).rejects.toMatchObject({ code: "VALIDATION" });
      await expect(
        reviewDeliveryEvidence(
          staff,
          e.id,
          "bbbbbbbb-0000-4000-8000-000000000001",
          documentary,
        ),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("comprovante corrigido perde a conferência; novo volta a aguardar; conferir o corrigido é recusado (servidor e trigger)", async () => {
      const { exam: e } = await signedExam();
      const receipt = await receiptOf(e.id, "recibo errado");
      await reviewDeliveryEvidence(staff, e.id, receipt.id, witnessed);
      expect(await state(e.id)).toBe("receipt_confirmed");
      await voidDelivery(staff, e.id, receipt.id, {
        reason: "Recibo de outro trabalhador anexado por engano.",
      });
      expect(await state(e.id)).toBe("none");
      const other = await receiptOf(e.id, "recibo certo");
      expect(await state(e.id)).toBe("evidence_pending");
      // Conferência anulada também perde efeito.
      const review = await reviewDeliveryEvidence(staff, e.id, other.id, documentary);
      await voidDelivery(staff, e.id, review.id, {
        reason: "Conferência registrada no comprovante errado.",
      });
      expect(await state(e.id)).toBe("evidence_pending");
      const corrected = await receiptOf(e.id, "terceiro");
      await voidDelivery(staff, e.id, corrected.id, {
        reason: "Anexado em duplicidade, corrigido.",
      });
      await expect(
        reviewDeliveryEvidence(staff, e.id, corrected.id, documentary),
      ).rejects.toMatchObject({ code: "VALIDATION" });
      const [row] = await admin`select * from aso_deliveries where id = ${corrected.id}`;
      await expect(
        runtime.begin(async (tx) => {
          await tx`select set_config('app.current_org', 'org_a', true), set_config('app.current_actor', 'staff', true)`;
          return tx`insert into aso_deliveries (id, org_id, company_id, health_exam_id, employee_id, signed_document_id, document_sha256,
            kind, occurred_at, reviews_id, reviewed_evidence_sha256, reviewed_evidence_kind, review_method, review_result, review_reference, recorded_by)
          values (gen_random_uuid(), 'org_a', ${row.company_id}, ${e.id}, ${row.employee_id}, ${row.signed_document_id}, ${row.document_sha256},
            'evidence_reviewed', now(), ${corrected.id}, ${row.evidence_sha256}, 'signed_receipt', 'documentary', 'confirmed', 'Forjado fictício', 'staff')`;
        }),
      ).rejects.toMatchObject({ code: "42501" });
    });

    it("ASO substituído: confirmação deixa de ser vigente; nova versão exige comprovante e conferência próprios; histórico íntegro", async () => {
      const { exam: e, doc } = await signedExam();
      const receipt = await receiptOf(e.id, "recibo v1");
      await reviewDeliveryEvidence(staff, e.id, receipt.id, witnessed);
      const v2 = await registerSignedAso(
        owner,
        e.id,
        {
          ...external,
          replacesId: doc.id,
          replaceReason: "Clínica reenviou com a data corrigida.",
        },
        pdf("aso v2"),
      );
      expect((await listDeliveries(staff, e.id)).summary).toMatchObject({
        state: "none",
        previousVersionDelivered: true,
      });
      const r2 = await registerDelivery(
        staff,
        e.id,
        delivery({ evidenceKind: "signed_receipt", occurredAt: "2026-10-25T10:00" }),
        pdf("recibo v2"),
      );
      expect(r2.signedDocumentId).toBe(v2.id);
      expect(await state(e.id)).toBe("evidence_pending");
      await reviewDeliveryEvidence(staff, e.id, r2.id, witnessed);
      expect(await state(e.id)).toBe("receipt_confirmed");
      const reviews = (await listDeliveries(staff, e.id)).deliveries.filter(
        (d) => d.kind === "evidence_reviewed",
      );
      expect(reviews.map((d) => d.signedDocumentId)).toEqual([doc.id, v2.id]);
    });

    it("evento anterior à correção (recibo sem conferência, gravado direto) não é promovido", async () => {
      const { exam: e, doc } = await signedExam();
      await admin`insert into aso_deliveries (id, org_id, company_id, health_exam_id, employee_id, signed_document_id, document_sha256,
        kind, method, occurred_at, evidence_reference, evidence_kind, evidence_path, evidence_sha256, evidence_size_bytes, evidence_content_type, recorded_by)
      values (gen_random_uuid(), 'org_a', ${I.companyA}, ${e.id}, ${I.employeeA}, ${doc.id}, ${doc.fileSha256}, 'made_available', 'physical_copy',
        '2026-10-22T13:00:00Z', 'Registro antigo fictício', 'signed_receipt', ${`org_a/aso-entregas/${e.id}/antigo.pdf`}, ${"b".repeat(64)}, 10, 'application/pdf', 'staff')`;
      expect(await state(e.id)).toBe("evidence_pending");
    });

    it("SQL direto e permissões: autoria, trabalhador, empresa, hash, alvo, cliente, outro tenant, UPDATE e DELETE", async () => {
      const { exam: e } = await signedExam();
      const receipt = await receiptOf(e.id, "recibo");
      const [row] = await admin`select * from aso_deliveries where id = ${receipt.id}`;
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
          sha?: string;
          target?: string;
        } = {},
      ) =>
        as(
          actor,
          (
            tx,
          ) => tx`insert into aso_deliveries (id, org_id, company_id, health_exam_id, employee_id, signed_document_id, document_sha256,
          kind, occurred_at, reviews_id, reviewed_evidence_sha256, reviewed_evidence_kind, review_method, review_result, review_reference, recorded_by)
        values (gen_random_uuid(), 'org_a', ${o.companyId ?? row.company_id}, ${e.id}, ${o.employeeId ?? row.employee_id}, ${row.signed_document_id},
          ${row.document_sha256}, 'evidence_reviewed', now(), ${o.target ?? receipt.id}, ${o.sha ?? row.evidence_sha256}, 'signed_receipt',
          'signature_witnessed', 'confirmed', 'Forjado fictício', ${o.recordedBy ?? actor})`,
        );
      await expect(forge("staff", { recordedBy: "owner" })).rejects.toMatchObject({
        code: "42501",
      });
      await expect(forge("client")).rejects.toMatchObject({ code: "42501" });
      await expect(forge("intruso")).rejects.toMatchObject({ code: "42501" });
      await expect(forge("staff", { employeeId: EMPLOYEE_A2 })).rejects.toMatchObject({
        code: "42501",
      });
      await expect(forge("staff", { sha: "c".repeat(64) })).rejects.toMatchObject({
        code: "23503",
      });
      await expect(
        forge("staff", { target: "bbbbbbbb-0000-4000-8000-000000000002" }),
      ).rejects.toMatchObject({ code: "23503" });
      await expect(
        forge("staff", { companyId: "cccccccc-0000-4000-8000-0000000000c9" }),
      ).rejects.toMatchObject({ code: expect.stringMatching(/42501|23503/) });
      const review = await reviewDeliveryEvidence(staff, e.id, receipt.id, documentary);
      await expect(
        as(
          "staff",
          (tx) =>
            tx`update aso_deliveries set review_method = 'signature_witnessed' where id = ${review.id}`,
        ),
      ).rejects.toMatchObject({ code: "42501" });
      await expect(
        as("owner", (tx) => tx`delete from aso_deliveries where id = ${review.id}`),
      ).rejects.toMatchObject({ code: "42501" });
      // REST: cliente 403; outro tenant 404; revisor nunca vem do cliente (campo extra recusado).
      const params = { params: Promise.resolve({ id: e.id, deliveryId: receipt.id }) };
      expect(
        (
          await REVIEW(
            reviewReq({ ...owner, userId: "client", role: "client" }, documentary),
            params,
          )
        ).status,
      ).toBe(403);
      expect((await REVIEW(reviewReq(ownerB, documentary), params)).status).toBe(404);
      expect(
        (await REVIEW(reviewReq(staff, { ...documentary, reviewerId: "owner" }), params))
          .status,
      ).toBe(422);
      await expect(
        reviewDeliveryEvidence(ownerB, e.id, receipt.id, documentary),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("nenhuma informação clínica nem caminho privado na lista e no comprovante", async () => {
      const { exam: e } = await signedExam();
      await admin`insert into health_exam_clinical_notes (org_id, health_exam_id, origin, content)
      values ('org_a', ${e.id}, 'legacy_exam_notes', ${SECRET_NOTE})`;
      const receipt = await receiptOf(e.id, "recibo");
      await reviewDeliveryEvidence(staff, e.id, receipt.id, documentary);
      const listed = JSON.stringify(await listDeliveries(staff, e.id));
      expect(listed).not.toContain(SECRET_NOTE);
      expect(listed).not.toContain("aso-entregas/");
      expect(
        JSON.stringify(await deliveryEvidenceDownload(staff, receipt.id)),
      ).not.toContain(SECRET_NOTE);
    });
  },
);
