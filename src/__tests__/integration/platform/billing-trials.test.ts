import type postgres from "postgres";
import { NextRequest } from "next/server";
jest.mock("@/shared/db/env", () => ({
  getDatabaseUrl: () => process.env.INTEGRATION_APP_RUNTIME_URL,
}));
jest.mock("@/shared/auth/require-office-staff", () => ({
  OFFICE_STAFF_ROLES: new Set(["owner", "collaborator"]),
  requireOfficeStaff: jest.fn().mockResolvedValue({
    tenantId: "org_a",
    userId: "owner",
    role: "owner",
    plan: "free",
  }),
}));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("@/shared/integrations/pdf/gotenberg", () => ({
  htmlToPdf: jest.fn().mockResolvedValue(Buffer.from("synthetic-pdf")),
  docxToPdf: jest.fn(),
}));
jest.mock("@/shared/integrations/storage/documents-storage", () => ({
  getSignedDownloadUrl: jest.fn(),
  SIGNED_DOWNLOAD_URL_TTL_SECONDS: 60,
  slugifyFileName: (value: string) => value,
}));
import { adminClient, applyMigrations, withOrgTx } from "../_helpers/db";
import { seedPgrBase, PGR_IDS as I } from "../_helpers/pgr-seed";
import {
  startCommercialTrial,
  getCommercialTrial,
} from "@/shared/server/platform/billing-trials-core";
import { startCommercialTrialAction } from "@/shared/server/actions/platform/billing-trials";
import {
  assertPgrBillingExportAllowed,
  companyBillingExportAllowed,
} from "@/shared/db/repositories/billing-export";
import { generatePgrPdf } from "@/shared/server/platform/pgr-pdf-core";
import { htmlToPdf } from "@/shared/integrations/pdf/gotenberg";
import { getSignedDownloadUrl } from "@/shared/integrations/storage/documents-storage";
import { enqueuePgrPdfBatchAction } from "@/shared/server/actions/documents/pdf-batch";
import { downloadDocumentAction } from "@/shared/server/actions/documents/download";
import { GET as download } from "@/app/api/v1/documents/[id]/download/route";
import { GET as pdf } from "@/app/api/v1/pgr/[id]/pdf/route";
import { POST as startRestTrial } from "@/app/api/billing/trials/route";
import { createBillingOffer } from "@/shared/server/platform/billing-catalog-core";
import { startCommercialCheckout } from "@/shared/server/platform/billing-checkout-core";
import { simulateCommercialPayment } from "@/shared/server/platform/billing-subscriptions-core";
import { listCompanies } from "@/shared/db/repositories/companies";
const owner = {
  tenantId: "org_a",
  userId: "owner",
  role: "owner",
  plan: "free" as const,
};
(process.env.INTEGRATION_APP_RUNTIME_URL ? describe : describe.skip)(
  "15-day commercial trial and server export restrictions",
  () => {
    let admin: ReturnType<typeof postgres>, runtime: ReturnType<typeof postgres>;
    beforeAll(async () => {
      process.env.APP_ENV = "test";
      process.env.BILLING_MODE = "mock";
      process.env.BILLING_MOCK_ENABLED = "true";
      process.env.BILLING_MOCK_WEBHOOK_SECRET =
        "synthetic-trial-secret-at-least-32-characters";
      admin = adminClient();
      await applyMigrations(admin);
      runtime = (await import("postgres")).default(
        process.env.INTEGRATION_APP_RUNTIME_URL!,
        { max: 1, prepare: false },
      );
    });
    beforeEach(async () => {
      jest.clearAllMocks();
      await seedPgrBase(admin);
      await admin`insert into users (id,email) values ('owner','trial@example.invalid') on conflict do nothing`;
      await admin`insert into org_memberships (org_id,user_id,role) values ('org_a','owner','owner') on conflict (org_id,user_id) do update set role='owner'`;
    });
    afterAll(async () => {
      await runtime?.end({ timeout: 5 });
      await admin?.end({ timeout: 5 });
    });
    it("persists exactly 15 days once, does not restart after expiration and protects the clock at runtime", async () => {
      const [one, two] = await Promise.all([
        startCommercialTrial(owner, { companyId: I.companyA }),
        startCommercialTrial(owner, { companyId: I.companyA }),
      ]);
      expect(one.id).toBe(two.id);
      expect(+one.endsAt - +one.startedAt).toBe(15 * 86400000);
      await expect(
        withOrgTx(runtime, "org_a", async (tx) => {
          await tx`select set_config('app.current_actor','owner',true)`;
          return tx`update billing_trials set ends_at=ends_at+interval '15 days'`;
        }),
      ).rejects.toThrow();
      await admin`update billing_trials set started_at=now()-interval '16 days',ends_at=now()-interval '1 day'`;
      const again = await startCommercialTrial(owner, { companyId: I.companyA });
      expect(+again.endsAt).toBeLessThan(Date.now());
      expect((await getCommercialTrial(owner, I.companyA)).status).toBe("expired");
    });
    it("blocks PDF generation, binary REST and queued emission before calling providers", async () => {
      await startCommercialTrial(owner, { companyId: I.companyA });
      await expect(generatePgrPdf("org_a", I.pgrA)).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
      expect(htmlToPdf).not.toHaveBeenCalled();
      const response = await pdf(
        new NextRequest(`http://localhost/api/v1/pgr/${I.pgrA}/pdf`),
        { params: Promise.resolve({ id: I.pgrA }) },
      );
      expect(response.status).toBe(403);
      expect((await enqueuePgrPdfBatchAction([I.pgrA])).ok).toBe(false);
      expect(await admin`select * from jobs`).toHaveLength(0);
    });
    it("blocks cached GED downloads even after expiry hides the PGR through RLS", async () => {
      await admin`delete from company_modules where company_id=${I.companyA} and module='pgr'`;
      const [doc] =
        await admin`insert into documents (org_id,document_group_id,name,doc_type,storage_path,size_bytes,related_entity_type,related_entity_id) values ('org_a',gen_random_uuid(),'PGR sintético','pgr','synthetic/pgr.pdf',1,'pgr',${I.pgrA}) returning id`;
      await startCommercialTrial(owner, { companyId: I.companyA });
      await admin`update billing_trials set started_at=now()-interval '16 days',ends_at=now()-interval '1 day'`;
      expect((await downloadDocumentAction(doc.id)).ok).toBe(false);
      const response = await download(
        new NextRequest(`http://localhost/api/v1/documents/${doc.id}/download`),
        { params: Promise.resolve({ id: doc.id }) },
      );
      expect(response.status).toBe(403);
      expect(getSignedDownloadUrl).not.toHaveBeenCalled();
    });
    it("keeps the original trial for other modules after partial purchase and records the first conversion only", async () => {
      await admin`delete from company_modules where company_id=${I.companyA} and module='pgr'`;
      await startCommercialTrial(owner, { companyId: I.companyA });
      const offer = await createBillingOffer(owner, {
        code: "medicine-only",
        name: "Medicina fictícia",
        interval: "month",
        items: [{ product: "medicine", label: "Medicina fictícia", amountMinor: 2500 }],
        limits: { companies: null, employees: null },
        policy: {},
        reason: "Cenário sintético",
      });
      const c = await startCommercialCheckout(owner, {
        companyId: I.companyA,
        priceId: offer.id,
        key: "trial-conversion-01",
      });
      await simulateCommercialPayment(owner, {
        contractId: c.contractId,
        scenario: "success",
      });
      const first = await getCommercialTrial(owner, I.companyA);
      expect(first.status).toBe("active");
      expect(first).toHaveProperty("hasConfirmedPurchase", true);
      expect(first).toHaveProperty("exportAllowed", { pgr: false, medicine: true });
      expect(
        (await listCompanies("org_a", { module: "pgr" })).rows.map((c) => c.id),
      ).toContain(I.companyA);
      await expect(assertPgrBillingExportAllowed("org_a", I.pgrA)).rejects.toThrow();
      await simulateCommercialPayment(owner, {
        contractId: c.contractId,
        scenario: "renewal",
      });
      const second = await getCommercialTrial(owner, I.companyA);
      expect(second.trial?.convertedAt).toEqual(first.trial?.convertedAt);
    });
    it("isolates the trial company, applies the same gates to Action/REST and preserves legacy exports outside mock mode", async () => {
      expect((await startCommercialTrialAction({ companyId: I.companyA })).ok).toBe(true);
      const response = await startRestTrial(
        new NextRequest("http://localhost/api/billing/trials", {
          method: "POST",
          body: JSON.stringify({ companyId: I.companyB }),
        }),
      );
      expect(response.status).toBe(404);
      const other = "99999999-9999-4999-8999-999999999999";
      await admin`insert into companies (id,org_id,razao_social) values (${other},'org_a','Outra empresa')`;
      await admin`insert into company_modules (org_id,company_id,module,enabled) values ('org_a',${other},'pgr',true)`;
      expect(await companyBillingExportAllowed("org_a", other, "pgr")).toBe(true);
      process.env.APP_ENV = "production";
      try {
        await expect(
          assertPgrBillingExportAllowed("org_a", I.pgrA),
        ).resolves.toBeUndefined();
        await expect(
          startCommercialTrial(owner, { companyId: I.companyA }),
        ).rejects.toThrow();
      } finally {
        process.env.APP_ENV = "test";
      }
    });
  },
);
