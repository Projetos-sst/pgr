/**
 * Integração da assinatura do PGR (target_type='pgr') contra Postgres efêmero.
 * Reusa `seedPgrBase` (pgrA@org_a[free], pgrB@org_b[pro]).
 */
import type postgres from "postgres";

jest.mock("@/shared/db/env", () => ({
  getDatabaseUrl: () => process.env.INTEGRATION_APP_RUNTIME_URL,
}));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("@/shared/auth/require-office-staff", () => ({
  requireOfficeStaff: jest.fn(),
}));

import { requireOfficeStaff } from "@/shared/auth/require-office-staff";
import { ForbiddenError } from "@/shared/auth/errors";
import {
  createPgrSignatureRequestAction,
  getPgrSignatureViewAction,
} from "@/shared/server/actions/pgr/pgr-signature";
import { submitPublicSignature } from "@/shared/server/actions/public-signatures";

import { adminClient, applyMigrations } from "../_helpers/db";
import { seedPgrBase, PGR_IDS } from "../_helpers/pgr-seed";

const APP_RUNTIME_URL = process.env.INTEGRATION_APP_RUNTIME_URL;
const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!APP_RUNTIME_URL && !!ADMIN_URL;

const mockedGate = requireOfficeStaff as jest.MockedFunction<typeof requireOfficeStaff>;
const PNG = `data:image/png;base64,${"A".repeat(120)}`;
const asOwner = (tenantId: string) =>
  mockedGate.mockResolvedValue({ userId: "u", tenantId, plan: "free", role: "owner" });
const tokenOf = (publicUrl: string) => publicUrl.split("/assinar/")[1];

const ALLOWED_KEYS = [
  "documentTitle",
  "companyName",
  "workUnitName",
  "responsibleName",
  "issuedAt",
  "validUntil",
  "revisionNumber",
].sort();

(shouldRun ? describe : describe.skip)("Assinatura do PGR — protegido", () => {
  let admin: ReturnType<typeof postgres>;
  beforeAll(async () => {
    admin = adminClient();
    await applyMigrations(admin);
  });
  afterAll(async () => {
    await admin.end({ timeout: 5 });
  });
  beforeEach(async () => {
    await seedPgrBase(admin);
    mockedGate.mockReset();
    asOwner("org_a");
  });

  it("cria a solicitação com target_type='pgr' e target_id=pgrId", async () => {
    const res = await createPgrSignatureRequestAction({ pgrId: PGR_IDS.pgrA });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.publicUrl).toContain("/assinar/");
    const [row] = await admin<{ target_type: string; target_id: string }[]>`
      select target_type, target_id from public.signature_requests where org_id='org_a' limit 1`;
    expect(row.target_type).toBe("pgr");
    expect(row.target_id).toBe(PGR_IDS.pgrA);
  });

  it("payload é MÍNIMO: só as 7 chaves permitidas, sem PII/ids internos", async () => {
    await createPgrSignatureRequestAction({ pgrId: PGR_IDS.pgrA });
    const [row] = await admin<{ payload: Record<string, unknown> }[]>`
      select payload from public.signature_requests where org_id='org_a' limit 1`;
    expect(Object.keys(row.payload).sort()).toEqual(ALLOWED_KEYS);
    for (const forbidden of ["orgId", "pgrId", "gesId", "riskId", "employees", "cpf"]) {
      expect(forbidden in row.payload).toBe(false);
    }
  });

  it("payload é CONGELADO: editar o PGR depois não altera a solicitação já criada", async () => {
    await createPgrSignatureRequestAction({ pgrId: PGR_IDS.pgrA });
    await admin.unsafe(
      `update public.pgr set responsible='NOVO RESP' where org_id='org_a' and id='${PGR_IDS.pgrA}'`,
    );
    const [row] = await admin<{ payload: { responsibleName: string | null } }[]>`
      select payload from public.signature_requests where org_id='org_a' limit 1`;
    expect(row.payload.responsibleName).not.toBe("NOVO RESP");
  });

  it("estado derivado: none → pending → signed", async () => {
    const none = await getPgrSignatureViewAction({ pgrId: PGR_IDS.pgrA });
    expect(none.ok && none.data.state).toBe("none");

    const created = await createPgrSignatureRequestAction({ pgrId: PGR_IDS.pgrA });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const pending = await getPgrSignatureViewAction({ pgrId: PGR_IDS.pgrA });
    expect(pending.ok && pending.data.state).toBe("pending");

    const submit = await submitPublicSignature(tokenOf(created.data.publicUrl), {
      signerName: "Assinante",
      imageDataUrl: PNG,
    });
    expect(submit.ok).toBe(true);

    const signed = await getPgrSignatureViewAction({ pgrId: PGR_IDS.pgrA });
    expect(signed.ok && signed.data.state).toBe("signed");
    expect(signed.ok && signed.data.signerName).toBe("Assinante");
  });

  it("cross-tenant → NOT_FOUND sem escrita", async () => {
    const res = await createPgrSignatureRequestAction({ pgrId: PGR_IDS.pgrB });
    expect(!res.ok && res.error.code).toBe("NOT_FOUND");
    const [{ count }] = await admin<{ count: string }[]>`
      select count(*)::text from public.signature_requests where org_id='org_a'`;
    expect(count).toBe("0");
  });

  it("papel client → FORBIDDEN", async () => {
    mockedGate.mockReset();
    mockedGate.mockRejectedValue(new ForbiddenError());
    const res = await createPgrSignatureRequestAction({ pgrId: PGR_IDS.pgrA });
    expect(!res.ok && res.error.code).toBe("FORBIDDEN");
  });

  it("o `pgr` permanece intacto (sem coluna de status/assinatura)", async () => {
    await createPgrSignatureRequestAction({ pgrId: PGR_IDS.pgrA });
    const [{ n }] = await admin<{ n: string }[]>`
      select count(*)::text as n from information_schema.columns where table_name='pgr'`;
    expect(n).toBe("11");
  });
});
