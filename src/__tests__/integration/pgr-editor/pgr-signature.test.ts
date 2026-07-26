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
import { publishPgrAction, updatePgrAction } from "@/shared/server/actions/pgr/pgr";
import {
  addGesToPgrAction,
  removeGesFromPgrAction,
} from "@/shared/server/actions/pgr/pgr-ges";
import { createPgrRevisionAction } from "@/shared/server/actions/pgr/pgr-revisions";

import { adminClient, applyMigrations } from "../_helpers/db";
import { seedPgrBase, PGR_IDS } from "../_helpers/pgr-seed";

const APP_RUNTIME_URL = process.env.INTEGRATION_APP_RUNTIME_URL;
const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!APP_RUNTIME_URL && !!ADMIN_URL;

const mockedGate = requireOfficeStaff as jest.MockedFunction<typeof requireOfficeStaff>;
const PNG = `data:image/png;base64,${"A".repeat(120)}`;
const asOwner = (tenantId: string) =>
  mockedGate.mockResolvedValue({ userId: "u", tenantId, plan: "free", role: "owner" });
const tokenOf = (publicUrl: string) => publicUrl.split("/signature-requests/")[1];

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
    expect(res.data.publicUrl).toContain("/signature-requests/");
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
    // O estado de assinatura vive só em `signature_requests`/`signature_captures`.
    // Asserção sobre a INTENÇÃO (nenhuma coluna de assinatura no `pgr`) em vez de
    // contagem total de colunas — esta última quebra a cada coluna nova legítima
    // (foi o que aconteceu com `published_at`, migration 0028).
    const columns = await admin<{ column_name: string }[]>`
      select column_name from information_schema.columns where table_name='pgr'`;
    const names = columns.map((c) => c.column_name);
    expect(names).toEqual(
      expect.not.arrayContaining([
        "signature_status",
        "signed_at",
        "signer_name",
        "auth_token",
        "status",
      ]),
    );
  });

  describe("trava de edição após assinatura (enforcement de servidor)", () => {
    async function signPgrA(): Promise<void> {
      const created = await createPgrSignatureRequestAction({ pgrId: PGR_IDS.pgrA });
      if (!created.ok) throw new Error("falha ao criar solicitação de assinatura");
      const submitted = await submitPublicSignature(tokenOf(created.data.publicUrl), {
        signerName: "Assinante",
        imageDataUrl: PNG,
      });
      if (!submitted.ok) throw new Error("falha ao assinar");
    }

    it("assinado: update/GES/revisão são recusados com ALREADY_SIGNED", async () => {
      await signPgrA();

      const update = await updatePgrAction(PGR_IDS.pgrA, {
        companyId: PGR_IDS.companyA,
        registrationType: "not_applicable",
        issuedAt: "2026-01-10",
        validUntil: "2027-01-10",
      });
      expect(!update.ok && update.error.code).toBe("ALREADY_SIGNED");

      const addGes = await addGesToPgrAction(PGR_IDS.pgrA, { gesId: PGR_IDS.gesA });
      expect(!addGes.ok && addGes.error.code).toBe("ALREADY_SIGNED");

      const removeGes = await removeGesFromPgrAction(PGR_IDS.pgrA, PGR_IDS.gesA);
      expect(!removeGes.ok && removeGes.error.code).toBe("ALREADY_SIGNED");

      const revision = await createPgrRevisionAction(PGR_IDS.pgrA, {
        revisedAt: "2026-03-01",
        notes: "tentativa pós-assinatura",
      });
      expect(!revision.ok && revision.error.code).toBe("ALREADY_SIGNED");
    });

    it("assinado: publish grava publishedAt e republicar não troca a data", async () => {
      await signPgrA();

      const first = await publishPgrAction(PGR_IDS.pgrA);
      expect(first.ok).toBe(true);

      const [afterFirst] = await admin<{ published_at: Date | null }[]>`
        select published_at from public.pgr where org_id='org_a' and id=${PGR_IDS.pgrA}`;
      expect(afterFirst.published_at).not.toBeNull();

      const second = await publishPgrAction(PGR_IDS.pgrA);
      expect(second.ok).toBe(true);

      const [afterSecond] = await admin<{ published_at: Date | null }[]>`
        select published_at from public.pgr where org_id='org_a' and id=${PGR_IDS.pgrA}`;
      expect(afterSecond.published_at).toEqual(afterFirst.published_at);
    });

    it("sem assinatura o PGR segue editável (a trava não vaza para rascunho)", async () => {
      const update = await updatePgrAction(PGR_IDS.pgrA, {
        companyId: PGR_IDS.companyA,
        registrationType: "not_applicable",
        issuedAt: "2026-02-10",
        validUntil: "2027-02-10",
      });
      expect(update.ok).toBe(true);
    });
  });
});
