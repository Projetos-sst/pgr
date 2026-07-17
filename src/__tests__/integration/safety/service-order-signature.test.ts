/**
 * Integração da assinatura da Ordem de Serviço (target_type='service_order') contra Postgres
 * efêmero, com as migrations reais. Reusa `seedPgrBase` (org_a[free]/org_b[pro]) e a infra genérica
 * de assinatura. O token cru nunca é impresso: só é usado para montar a chamada pública.
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
import { hashToken } from "@/shared/domains/signatures/token";
import {
  createServiceOrderSignatureRequestAction,
  getServiceOrderSignatureViewAction,
} from "@/shared/server/actions/safety/service-order-signature";
import {
  createServiceOrderAction,
  deleteServiceOrderAction,
  updateServiceOrderAction,
} from "@/shared/server/actions/safety/service-orders";
import {
  resolvePublicSignature,
  submitPublicSignature,
} from "@/shared/server/actions/public-signatures";

import { adminClient, applyMigrations } from "../_helpers/db";
import { seedPgrBase, PGR_IDS } from "../_helpers/pgr-seed";

const APP_RUNTIME_URL = process.env.INTEGRATION_APP_RUNTIME_URL;
const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!APP_RUNTIME_URL && !!ADMIN_URL;

const mockedGate = requireOfficeStaff as jest.MockedFunction<typeof requireOfficeStaff>;
const PNG = `data:image/png;base64,${"A".repeat(120)}`;

function asOwner(tenantId: string, plan: "free" | "pro" = "free") {
  mockedGate.mockResolvedValue({ userId: "u", tenantId, plan, role: "owner" });
}
const tokenOf = (publicUrl: string) => publicUrl.split("/signature-requests/")[1];

const ALLOWED_KEYS = [
  "documentTitle",
  "serviceOrderNumber",
  "companyName",
  "employeeName",
  "issuedAt",
  "items",
].sort();

const BASE = {
  title: "Entrega de EPIs",
  openedAt: "2026-07-10",
  assignedEmployeeId: PGR_IDS.employeeA,
};

(shouldRun ? describe : describe.skip)("Assinatura da OS (US3)", () => {
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

  /** OS válida (funcionário + itens) pronta para assinar. */
  async function createSignableOrder(items = [{ description: "Usar capacete" }]) {
    const created = await createServiceOrderAction({
      ...BASE,
      items: items.map((i) => ({ ...i, sourceType: "manual" as const })),
    });
    if (!created.ok) throw new Error("falha ao criar OS de teste");
    return created.data;
  }

  it("cria a solicitação para OS válida com target_type='service_order'", async () => {
    const order = await createSignableOrder();
    const res = await createServiceOrderSignatureRequestAction({
      serviceOrderId: order.id,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.signature.state).toBe("pending");
    expect(res.data.qrCodeDataUrl).toContain("data:image/png;base64,");

    const [row] = await admin<{ target_type: string; target_id: string }[]>`
      select target_type, target_id from public.signature_requests where org_id='org_a' limit 1`;
    expect(row.target_type).toBe("service_order");
    expect(row.target_id).toBe(order.id);
  });

  it("link público só existe na criação; o GET protegido nunca o reconstrói", async () => {
    const order = await createSignableOrder();
    const created = await createServiceOrderSignatureRequestAction({
      serviceOrderId: order.id,
    });
    if (!created.ok) return;
    expect(created.data.publicUrl).toContain("/signature-requests/");

    const view = await getServiceOrderSignatureViewAction({ serviceOrderId: order.id });
    expect(view.ok).toBe(true);
    if (!view.ok) return;
    const keys = Object.keys(view.data);
    expect(keys.sort()).toEqual(
      ["expiresAt", "requestId", "signedAt", "signerName", "state"].sort(),
    );
    for (const leak of ["publicUrl", "token", "tokenHash", "qrCodeDataUrl", "payload"]) {
      expect(keys).not.toContain(leak);
    }
    expect(JSON.stringify(view.data)).not.toContain(tokenOf(created.data.publicUrl));
  });

  it("token é persistido SOMENTE como hash (nunca cru)", async () => {
    const order = await createSignableOrder();
    const created = await createServiceOrderSignatureRequestAction({
      serviceOrderId: order.id,
    });
    if (!created.ok) return;
    const raw = tokenOf(created.data.publicUrl);
    const [row] = await admin<{ token_hash: string }[]>`
      select token_hash from public.signature_requests where org_id='org_a' limit 1`;
    expect(row.token_hash).toBe(hashToken(raw));
    expect(row.token_hash).not.toBe(raw);
  });

  it("payload é MÍNIMO: só as 6 chaves, sem CPF/ids internos/source", async () => {
    const order = await createSignableOrder();
    await createServiceOrderSignatureRequestAction({ serviceOrderId: order.id });
    const [row] = await admin<{ payload: Record<string, unknown> }[]>`
      select payload from public.signature_requests where org_id='org_a' limit 1`;
    expect(Object.keys(row.payload).sort()).toEqual(ALLOWED_KEYS);
    for (const forbidden of [
      "orgId",
      "serviceOrderId",
      "employeeId",
      "companyId",
      "cpf",
      "sourceId",
      "sourceType",
    ]) {
      expect(forbidden in row.payload).toBe(false);
    }
    const serialized = JSON.stringify(row.payload);
    expect(serialized).not.toContain("12345678901"); // CPF do funcionário (seed)
    expect(serialized).not.toContain(order.id);
    expect(serialized).not.toContain(PGR_IDS.employeeA);
    // Item público carrega apenas o texto.
    const items = row.payload.items as Record<string, unknown>[];
    expect(Object.keys(items[0])).toEqual(["description"]);
  });

  it("payload é CONGELADO: alterar a OS depois não altera a solicitação emitida", async () => {
    const order = await createSignableOrder();
    await createServiceOrderSignatureRequestAction({ serviceOrderId: order.id });

    await updateServiceOrderAction(order.id, {
      title: "TÍTULO ALTERADO",
      openedAt: BASE.openedAt,
      assignedEmployeeId: PGR_IDS.employeeA,
      status: "in_progress",
      items: [{ description: "ITEM ALTERADO", sourceType: "manual" }],
    });
    await admin`update public.companies set razao_social='EMPRESA ALTERADA' where id=${PGR_IDS.companyA}`;

    const [row] = await admin<
      {
        payload: {
          documentTitle: string;
          companyName: string;
          items: { description: string }[];
        };
      }[]
    >`select payload from public.signature_requests where org_id='org_a' limit 1`;
    expect(row.payload.documentTitle).toContain("Entrega de EPIs");
    expect(row.payload.documentTitle).not.toContain("ALTERADO");
    expect(row.payload.companyName).toBe("A Ltda");
    expect(row.payload.items[0].description).toBe("Usar capacete");
  });

  it("aceita 100 itens e descrição de 500; rejeita 101 itens e 501 caracteres", async () => {
    const ok = await createSignableOrder(
      Array.from({ length: 100 }, (_, i) => ({ description: `item ${i}` })),
    );
    const okRes = await createServiceOrderSignatureRequestAction({
      serviceOrderId: ok.id,
    });
    expect(okRes.ok).toBe(true);

    const at500 = await createSignableOrder([{ description: "a".repeat(500) }]);
    const at500Res = await createServiceOrderSignatureRequestAction({
      serviceOrderId: at500.id,
    });
    expect(at500Res.ok).toBe(true);

    // 101 itens / 501 caracteres não passam nem no CRUD (mesmos limites do domínio).
    const tooMany = await createServiceOrderAction({
      ...BASE,
      items: Array.from({ length: 101 }, () => ({
        description: "x",
        sourceType: "manual" as const,
      })),
    });
    expect(tooMany.ok).toBe(false);
    const tooLong = await createServiceOrderAction({
      ...BASE,
      items: [{ description: "a".repeat(501), sourceType: "manual" as const }],
    });
    expect(tooLong.ok).toBe(false);
  });

  it("OS sem itens ou sem funcionário não é assinável (VALIDATION)", async () => {
    const noItems = await createServiceOrderAction({ ...BASE, items: [] });
    if (!noItems.ok) return;
    const r1 = await createServiceOrderSignatureRequestAction({
      serviceOrderId: noItems.data.id,
    });
    expect(!r1.ok && r1.error.code).toBe("VALIDATION");

    const noEmployee = await createServiceOrderAction({
      title: "Sem funcionário",
      openedAt: BASE.openedAt,
      items: [{ description: "x", sourceType: "manual" }],
    });
    if (!noEmployee.ok) return;
    const r2 = await createServiceOrderSignatureRequestAction({
      serviceOrderId: noEmployee.data.id,
    });
    expect(!r2.ok && r2.error.code).toBe("VALIDATION");
  });

  it("estado derivado none → pending → signed; assinatura pública cria a captura", async () => {
    const order = await createSignableOrder();
    const none = await getServiceOrderSignatureViewAction({ serviceOrderId: order.id });
    expect(none.ok && none.data.state).toBe("none");

    const created = await createServiceOrderSignatureRequestAction({
      serviceOrderId: order.id,
    });
    if (!created.ok) return;
    const pending = await getServiceOrderSignatureViewAction({
      serviceOrderId: order.id,
    });
    expect(pending.ok && pending.data.state).toBe("pending");

    const token = tokenOf(created.data.publicUrl);
    // Token válido resolve a página pública SEM Clerk (isolamento vem do token).
    const resolved = await resolvePublicSignature(token);
    expect(resolved.state).toBe("signable");
    expect(resolved.targetType).toBe("service_order");

    const submit = await submitPublicSignature(token, {
      signerName: "Func A",
      imageDataUrl: PNG,
    });
    expect(submit.ok).toBe(true);

    const signed = await getServiceOrderSignatureViewAction({ serviceOrderId: order.id });
    expect(signed.ok && signed.data.state).toBe("signed");
    expect(signed.ok && signed.data.signerName).toBe("Func A");

    const [{ count }] = await admin<{ count: number }[]>`
      select count(*)::int as count from public.signature_captures where org_id='org_a'`;
    expect(count).toBe(1);
  });

  it("replay bloqueado: o mesmo token não assina duas vezes", async () => {
    const order = await createSignableOrder();
    const created = await createServiceOrderSignatureRequestAction({
      serviceOrderId: order.id,
    });
    if (!created.ok) return;
    const token = tokenOf(created.data.publicUrl);
    await submitPublicSignature(token, { signerName: "Func A", imageDataUrl: PNG });

    const replay = await submitPublicSignature(token, {
      signerName: "Invasor",
      imageDataUrl: PNG,
    });
    expect(replay.ok).toBe(false);
    expect((await resolvePublicSignature(token)).state).toBe("used");

    const [{ count }] = await admin<{ count: number }[]>`
      select count(*)::int as count from public.signature_captures where org_id='org_a'`;
    expect(count).toBe(1);
  });

  it("token expirado e token cancelado são rejeitados", async () => {
    const order = await createSignableOrder();
    const created = await createServiceOrderSignatureRequestAction({
      serviceOrderId: order.id,
    });
    if (!created.ok) return;
    const token = tokenOf(created.data.publicUrl);

    await admin`update public.signature_requests set expires_at = now() - interval '1 hour'
      where org_id='org_a'`;
    expect((await resolvePublicSignature(token)).state).toBe("expired");
    expect(
      (await submitPublicSignature(token, { signerName: "X", imageDataUrl: PNG })).ok,
    ).toBe(false);

    await admin`update public.signature_requests
      set status='cancelled', expires_at = now() + interval '1 hour' where org_id='org_a'`;
    const view = await getServiceOrderSignatureViewAction({ serviceOrderId: order.id });
    expect(view.ok && view.data.state).toBe("cancelled");
  });

  it("token inválido não revela existência de OS (resposta genérica)", async () => {
    await createSignableOrder();
    const resolved = await resolvePublicSignature("token-que-nao-existe");
    expect(resolved.state).toBe("invalid");
    expect(JSON.stringify(resolved)).not.toContain("service_order");
  });

  it("cota compartilhada de assinaturas se aplica à OS (free)", async () => {
    // Consome a cota free com pedidos de OUTRO alvo: o contador é por tenant/mês, sem
    // filtro de target_type — a OS não tem cota própria.
    await admin.unsafe(`
      insert into public.signature_requests (org_id, target_type, token_hash, payload, expires_at)
      select 'org_a', 'demo', 'hash-' || g::text, '{}'::jsonb, now() + interval '1 day'
      from generate_series(1, 10) g;
    `);
    const order = await createSignableOrder();
    const res = await createServiceOrderSignatureRequestAction({
      serviceOrderId: order.id,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("QUOTA_EXCEEDED");
  });

  it("OS cross-tenant → NOT_FOUND, sem escrita e sem consumir cota", async () => {
    asOwner("org_b", "pro");
    const foreign = await createServiceOrderAction({
      title: "OS do org_b",
      openedAt: BASE.openedAt,
      assignedEmployeeId: PGR_IDS.employeeB,
      items: [{ description: "x", sourceType: "manual" }],
    });
    if (!foreign.ok) return;

    asOwner("org_a");
    const res = await createServiceOrderSignatureRequestAction({
      serviceOrderId: foreign.data.id,
    });
    expect(!res.ok && res.error.code).toBe("NOT_FOUND");
    const [{ count }] = await admin<{ count: number }[]>`
      select count(*)::int as count from public.signature_requests where org_id='org_a'`;
    expect(count).toBe(0);
  });

  it("papel client → FORBIDDEN nas superfícies protegidas", async () => {
    const order = await createSignableOrder();
    mockedGate.mockReset();
    mockedGate.mockRejectedValue(new ForbiddenError());
    const create = await createServiceOrderSignatureRequestAction({
      serviceOrderId: order.id,
    });
    expect(!create.ok && create.error.code).toBe("FORBIDDEN");
    const get = await getServiceOrderSignatureViewAction({ serviceOrderId: order.id });
    expect(!get.ok && get.error.code).toBe("FORBIDDEN");
  });

  it("OS assinada: não edita, não exclui e não reemite (backstop do repositório)", async () => {
    const order = await createSignableOrder();
    const created = await createServiceOrderSignatureRequestAction({
      serviceOrderId: order.id,
    });
    if (!created.ok) return;
    await submitPublicSignature(tokenOf(created.data.publicUrl), {
      signerName: "Func A",
      imageDataUrl: PNG,
    });

    const edit = await updateServiceOrderAction(order.id, {
      title: "tentativa de edição",
      openedAt: BASE.openedAt,
      status: "in_progress",
      items: [{ description: "novo", sourceType: "manual" }],
    });
    expect(!edit.ok && edit.error.code).toBe("IN_USE");

    const removed = await deleteServiceOrderAction(order.id);
    expect(!removed.ok && removed.error.code).toBe("IN_USE");

    const reissue = await createServiceOrderSignatureRequestAction({
      serviceOrderId: order.id,
    });
    expect(!reissue.ok && reissue.error.code).toBe("IN_USE");

    // Nada mudou no banco: a OS assinada continua íntegra.
    const [row] = await admin<{ title: string }[]>`
      select title from public.service_orders where id=${order.id}`;
    expect(row.title).toBe("Entrega de EPIs");
    const [{ count }] = await admin<{ count: number }[]>`
      select count(*)::int as count from public.signature_requests where org_id='org_a'`;
    expect(count).toBe(1);
  });

  it("OS NÃO assinada (pendente) continua editável e excluível", async () => {
    const order = await createSignableOrder();
    await createServiceOrderSignatureRequestAction({ serviceOrderId: order.id });
    const edit = await updateServiceOrderAction(order.id, {
      title: "editada com pedido pendente",
      openedAt: BASE.openedAt,
      status: "in_progress",
      items: [{ description: "novo", sourceType: "manual" }],
    });
    expect(edit.ok).toBe(true);
    const removed = await deleteServiceOrderAction(order.id);
    expect(removed.ok).toBe(true);
  });

  it("a tabela service_orders permanece sem coluna de token/assinatura", async () => {
    const cols = await admin<{ column_name: string }[]>`
      select column_name from information_schema.columns where table_name='service_orders'`;
    const names = cols.map((c) => c.column_name);
    for (const forbidden of [
      "token",
      "token_hash",
      "auth_token",
      "signature_status",
      "signed_at",
    ]) {
      expect(names).not.toContain(forbidden);
    }
  });
});
