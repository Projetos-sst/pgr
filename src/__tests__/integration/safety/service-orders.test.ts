/**
 * Integração das Server Actions + repositório de Ordens de Serviço (Fase 06, US2)
 * contra Postgres efêmero. Mocka o gate de papel, a URL do banco (app runtime →
 * efêmero) e next/cache. Numeração concorrente é provada no nível de conexões
 * paralelas reais (o pool do `db` é max:1 e serializa por si só).
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
  createServiceOrderAction,
  deleteServiceOrderAction,
  getServiceOrderAction,
  getSuggestedItemsAction,
  listServiceOrdersAction,
  setServiceOrderStatusAction,
  updateServiceOrderAction,
} from "@/shared/server/actions/safety/service-orders";
import { createServiceOrder } from "@/shared/db/repositories/service-orders";

import {
  adminClient,
  appRuntimeClient,
  applyMigrations,
  withOrgTx,
} from "../_helpers/db";
import { seedPgrBase, PGR_IDS } from "../_helpers/pgr-seed";

const APP_RUNTIME_URL = process.env.INTEGRATION_APP_RUNTIME_URL;
const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!APP_RUNTIME_URL && !!ADMIN_URL;

const mockedGate = requireOfficeStaff as jest.MockedFunction<typeof requireOfficeStaff>;

function asOwner(tenantId: string) {
  mockedGate.mockResolvedValue({ userId: "u", tenantId, plan: "free", role: "owner" });
}

const CREATE = { title: "OS de teste", openedAt: "2026-07-10" };

(shouldRun ? describe : describe.skip)("Server Actions — service_orders (US2)", () => {
  let admin: ReturnType<typeof postgres>;
  let runtime: ReturnType<typeof postgres>;

  beforeAll(async () => {
    admin = adminClient();
    await applyMigrations(admin);
    runtime = appRuntimeClient();
  });

  afterAll(async () => {
    await runtime.end({ timeout: 5 });
    await admin.end({ timeout: 5 });
  });

  beforeEach(async () => {
    await seedPgrBase(admin);
    mockedGate.mockReset();
    asOwner("org_a");
  });

  it("cria OS sem itens manuais; número inicia em 1", async () => {
    const result = await createServiceOrderAction(CREATE);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.number).toBe(1);
      expect(result.data.status).toBe("open");
    }
  });

  it("sugere itens do GES (riscos + EPIs) e cria OS com snapshots + item manual", async () => {
    const suggested = await getSuggestedItemsAction(PGR_IDS.employeeA);
    expect(suggested.ok).toBe(true);
    if (!suggested.ok) return;
    // Seed: riskA "Ruído contínuo" (risk) + epiCatalogA "Capacete CA-123" (epi).
    expect(suggested.data).toHaveLength(2);
    expect(suggested.data.map((s) => s.sourceType).sort()).toEqual(["epi", "risk"]);

    const created = await createServiceOrderAction({
      ...CREATE,
      assignedEmployeeId: PGR_IDS.employeeA,
      items: [
        ...suggested.data,
        { description: "Orientar sobre uso correto", sourceType: "manual" },
      ],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const detail = await getServiceOrderAction(created.data.id);
    expect(detail.ok).toBe(true);
    if (!detail.ok) return;
    expect(detail.data.items).toHaveLength(3);
    // Snapshots textuais persistidos, com sort_order determinístico.
    expect(detail.data.items[0].sourceType).toBe("risk");
    expect(detail.data.items[0].description).toContain("Ruído contínuo");
    expect(detail.data.items[2].sourceType).toBe("manual");
    expect(detail.data.items.map((i) => i.sortOrder)).toEqual([0, 1, 2]);
  });

  it("snapshot fica congelado: alterar o risco não reescreve a OS emitida", async () => {
    const suggested = await getSuggestedItemsAction(PGR_IDS.employeeA);
    if (!suggested.ok) return;
    const created = await createServiceOrderAction({
      ...CREATE,
      assignedEmployeeId: PGR_IDS.employeeA,
      items: suggested.data,
    });
    if (!created.ok) return;

    await admin`update public.risks set description = 'Ruído ALTERADO' where id = ${PGR_IDS.riskA}`;

    const detail = await getServiceOrderAction(created.data.id);
    if (!detail.ok) return;
    const riskItem = detail.data.items.find((i) => i.sourceType === "risk");
    expect(riskItem?.description).toContain("Ruído contínuo");
    expect(riskItem?.description).not.toContain("ALTERADO");
  });

  it("OS + itens são atômicos: falha no item faz rollback da OS (nada persiste)", async () => {
    await expect(
      createServiceOrder("org_a", {
        title: "OS que falha",
        openedAt: "2026-07-10",
        assignedEmployeeId: null,
        // sourceId malformado → INSERT do item quebra (uuid inválido) DEPOIS do
        // INSERT da OS → transação inteira sofre rollback.
        items: [
          {
            description: "item ruim",
            sourceType: "manual",
            sourceId: "NAO-EH-UUID",
            done: false,
          },
        ],
      }),
    ).rejects.toThrow();

    const [{ count }] = await admin<{ count: number }[]>`
      select count(*)::int as count from public.service_orders where org_id = 'org_a'`;
    expect(count).toBe(0);
  });

  it("SC-001: duas criações concorrentes no MESMO tenant → números consecutivos (lock real)", async () => {
    // Replica a sequência de numeração do repositório em DUAS conexões paralelas
    // reais para exercitar o `FOR UPDATE` na linha de `orgs` (o pool do `db` é max:1).
    async function createLocked(title: string): Promise<number> {
      return withOrgTx(runtime, "org_a", async (tx) => {
        await tx`select id from public.orgs where id = 'org_a' for update`;
        const [{ max }] = await tx<{ max: number | null }[]>`
          select max(number) as max from public.service_orders where org_id = 'org_a'`;
        const number = (max ?? 0) + 1;
        await tx`insert into public.service_orders (org_id, number, title, opened_at)
          values ('org_a', ${number}, ${title}, current_date)`;
        return number;
      });
    }
    const [n1, n2] = await Promise.all([createLocked("A"), createLocked("B")]);
    expect(new Set([n1, n2])).toEqual(new Set([1, 2]));
  });

  it("SC-002: tenants distintos podem ter o mesmo número (sem lock global)", async () => {
    asOwner("org_a");
    const a = await createServiceOrderAction(CREATE);
    asOwner("org_b");
    const b = await createServiceOrderAction(CREATE);
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) {
      expect(a.data.number).toBe(1);
      expect(b.data.number).toBe(1);
    }
  });

  it("employee cross-tenant no create → FK_NOT_FOUND (422)", async () => {
    const result = await createServiceOrderAction({
      ...CREATE,
      assignedEmployeeId: PGR_IDS.employeeB, // pertence a org_b
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("FK_NOT_FOUND");
  });

  it("OS cross-tenant → NOT_FOUND (404)", async () => {
    asOwner("org_b");
    const created = await createServiceOrderAction(CREATE);
    if (!created.ok) return;
    asOwner("org_a");
    const fetched = await getServiceOrderAction(created.data.id);
    expect(fetched.ok).toBe(false);
    if (!fetched.ok) expect(fetched.error.code).toBe("NOT_FOUND");
  });

  it("lista com filtro por status e busca por título/número", async () => {
    await createServiceOrderAction({ ...CREATE, title: "Troca de filtro" });
    await createServiceOrderAction({ ...CREATE, title: "Inspeção elétrica" });

    const all = await listServiceOrdersAction({});
    expect(all.ok && all.data.total).toBe(2);

    const byText = await listServiceOrdersAction({ q: "elétrica" });
    expect(byText.ok && byText.data.rows).toHaveLength(1);

    const byNumber = await listServiceOrdersAction({ q: "1" });
    expect(byNumber.ok && byNumber.data.rows.length).toBeGreaterThanOrEqual(1);

    const open = await listServiceOrdersAction({ status: "open" });
    expect(open.ok && open.data.total).toBe(2);
    const done = await listServiceOrdersAction({ status: "completed" });
    expect(done.ok && done.data.total).toBe(0);
  });

  it("persiste osType (exam_type) e workUnitId; detalhe e lista os expõem", async () => {
    const created = await createServiceOrderAction({
      ...CREATE,
      osType: "admissional",
      assignedEmployeeId: PGR_IDS.employeeA,
      workUnitId: PGR_IDS.workUnitA,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const detail = await getServiceOrderAction(created.data.id);
    if (!detail.ok) return;
    expect(detail.data.order.osType).toBe("admissional");
    expect(detail.data.order.workUnitId).toBe(PGR_IDS.workUnitA);

    const list = await listServiceOrdersAction({});
    if (!list.ok) return;
    const row = list.data.rows.find((r) => r.id === created.data.id);
    expect(row?.osTypeLabel).toBe("Admissional");
    expect(row?.companyName).toBe("A Ltda"); // derivado employee → company
    expect(row?.employeeName).toBe("Func A");
  });

  it("workUnit cross-tenant no create → FK_NOT_FOUND (422)", async () => {
    const result = await createServiceOrderAction({
      ...CREATE,
      workUnitId: PGR_IDS.workUnitB, // pertence a org_b
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("FK_NOT_FOUND");
  });

  it("busca por nome do funcionário e por empresa (razão social)", async () => {
    await createServiceOrderAction({
      ...CREATE,
      title: "Sem funcionário",
    });
    await createServiceOrderAction({
      ...CREATE,
      title: "Com funcionário",
      assignedEmployeeId: PGR_IDS.employeeA,
    });

    const byEmployee = await listServiceOrdersAction({ q: "Func A" });
    expect(byEmployee.ok && byEmployee.data.rows).toHaveLength(1);

    const byCompany = await listServiceOrdersAction({ q: "A Ltda" });
    expect(byCompany.ok && byCompany.data.rows).toHaveLength(1);
  });

  it("estado de assinatura derivado + abas Abertas/Assinadas", async () => {
    const pendingOs = await createServiceOrderAction({ ...CREATE, title: "Pendente" });
    const signedOs = await createServiceOrderAction({ ...CREATE, title: "Assinada" });
    if (!pendingOs.ok || !signedOs.ok) return;

    // Solicitação pendente ativa (não expirada) → "Enviada".
    await admin`insert into public.signature_requests
      (org_id, target_type, target_id, token_hash, payload, status, expires_at)
      values ('org_a','service_order',${pendingOs.data.id},'tok-pending','{}'::jsonb,'pending', now() + interval '3 days')`;
    // Solicitação assinada → "Assinada".
    await admin`insert into public.signature_requests
      (org_id, target_type, target_id, token_hash, payload, status, expires_at)
      values ('org_a','service_order',${signedOs.data.id},'tok-signed','{}'::jsonb,'signed', now() + interval '3 days')`;

    const all = await listServiceOrdersAction({});
    if (!all.ok) return;
    const byId = (id: string) => all.data.rows.find((r) => r.id === id);
    expect(byId(pendingOs.data.id)?.signatureLabel).toBe("Enviada");
    expect(byId(signedOs.data.id)?.signatureLabel).toBe("Assinada");

    // Aba "OS Assinadas" (signed=true) só traz a assinada.
    const signedTab = await listServiceOrdersAction({ signed: true });
    expect(signedTab.ok && signedTab.data.rows).toHaveLength(1);
    if (signedTab.ok) expect(signedTab.data.rows[0].id).toBe(signedOs.data.id);

    // Aba "OS Abertas" (signed=false) exclui a assinada.
    const openTab = await listServiceOrdersAction({ signed: false });
    if (openTab.ok) {
      const ids = openTab.data.rows.map((r) => r.id);
      expect(ids).toContain(pendingOs.data.id);
      expect(ids).not.toContain(signedOs.data.id);
    }
  });

  it("atualização substitui a coleção de itens transacionalmente", async () => {
    const created = await createServiceOrderAction({
      ...CREATE,
      items: [{ description: "item antigo", sourceType: "manual" }],
    });
    if (!created.ok) return;
    const updated = await updateServiceOrderAction(created.data.id, {
      title: "OS revisada",
      openedAt: CREATE.openedAt,
      status: "in_progress",
      items: [
        { description: "item novo 1", sourceType: "manual" },
        { description: "item novo 2", sourceType: "manual" },
      ],
    });
    expect(updated.ok).toBe(true);
    const detail = await getServiceOrderAction(created.data.id);
    if (!detail.ok) return;
    expect(detail.data.order.title).toBe("OS revisada");
    expect(detail.data.order.status).toBe("in_progress");
    expect(detail.data.items).toHaveLength(2);
    expect(detail.data.items.map((i) => i.description)).toEqual([
      "item novo 1",
      "item novo 2",
    ]);
  });

  it("exclusão permitida em open; bloqueada em estado terminal (IN_USE)", async () => {
    const created = await createServiceOrderAction(CREATE);
    if (!created.ok) return;

    // Terminal: concluída não pode ser excluída.
    const completed = await createServiceOrderAction(CREATE);
    if (!completed.ok) return;
    await setServiceOrderStatusAction(completed.data.id, "completed");
    const blocked = await deleteServiceOrderAction(completed.data.id);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.error.code).toBe("IN_USE");

    // Open: exclusão permitida.
    const okDelete = await deleteServiceOrderAction(created.data.id);
    expect(okDelete.ok).toBe(true);
  });

  it("status terminal não retrocede (VALIDATION)", async () => {
    const created = await createServiceOrderAction(CREATE);
    if (!created.ok) return;
    await setServiceOrderStatusAction(created.data.id, "completed");
    const back = await setServiceOrderStatusAction(created.data.id, "open");
    expect(back.ok).toBe(false);
    if (!back.ok) expect(back.error.code).toBe("VALIDATION");
  });

  it("RLS: query bare (sem tenant) não enxerga OS de nenhum tenant", async () => {
    await createServiceOrderAction(CREATE);
    const bare = await runtime<{ id: string }[]>`select id from public.service_orders`;
    expect(bare).toHaveLength(0);
  });

  it("papel client → FORBIDDEN (403) nas superfícies protegidas", async () => {
    mockedGate.mockRejectedValue(new ForbiddenError());
    const result = await listServiceOrdersAction({});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("FORBIDDEN");
  });
});
