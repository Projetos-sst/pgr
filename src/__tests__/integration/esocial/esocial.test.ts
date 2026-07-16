/**
 * Integração do módulo eSocial SST (Fase 10) contra Postgres efêmero. Cobre
 * geração/persistência de eventos, fontes (funcionário/risco) escopadas ao
 * tenant, envio em lote (só pending), consulta de retorno e isolamento.
 */
import type postgres from "postgres";

jest.mock("@/shared/db/env", () => ({
  getDatabaseUrl: () => process.env.INTEGRATION_APP_RUNTIME_URL,
}));

import * as repo from "@/shared/db/repositories/esocial-events";
import { buildEsocialXml } from "@/shared/domains/esocial/builders";

import { adminClient, applyMigrations } from "../_helpers/db";
import { seedPgrBase } from "../_helpers/pgr-seed";

const APP_RUNTIME_URL = process.env.INTEGRATION_APP_RUNTIME_URL;
const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!APP_RUNTIME_URL && !!ADMIN_URL;

const EMPLOYEE_A = "11111111-1111-1111-1111-1111111111a4";
const EMPLOYEE_B = "22222222-2222-2222-2222-2222222222b4";
const RISK_A = "11111111-1111-1111-1111-1111111111d1";

async function seedEvent(status: "pending" | "draft" = "pending"): Promise<string> {
  const payload = buildEsocialXml("S-2210", {
    cpf: "12345678901",
    dataAcidente: "2026-02-01",
    descricao: "Teste",
  });
  const { id } = await repo.createEvent("org_a", { eventType: "S-2210", payload });
  if (status === "draft") {
    // createEvent nasce pending; nada a fazer para pending
  }
  return id;
}

(shouldRun ? describe : describe.skip)("eSocial — eventos e lote", () => {
  let admin: ReturnType<typeof postgres>;

  beforeAll(async () => {
    admin = adminClient();
    await applyMigrations(admin);
    await seedPgrBase(admin);
    // dá código eSocial ao risco A (o seed não preenche)
    await admin.unsafe(
      `update public.risks set noxious_agent_code = '01.01.001', measurement_unit = 'db_a' where id = '${RISK_A}'`,
    );
  });

  afterAll(async () => {
    await admin.end();
  });

  it("cria evento (pending), lê e isola cross-tenant", async () => {
    const id = await seedEvent();
    const ev = await repo.getEvent("org_a", id);
    expect(ev!.status).toBe("pending");
    expect(ev!.payload).toContain("ambientePadrao");
    expect(await repo.getEvent("org_b", id)).toBeNull();
  });

  it("fontes funcionário/risco escopadas ao tenant (cross-tenant → null)", async () => {
    expect(await repo.getEmployeeSource("org_a", EMPLOYEE_A)).not.toBeNull();
    expect(await repo.getEmployeeSource("org_a", EMPLOYEE_B)).toBeNull();

    const risk = await repo.getRiskSource("org_a", RISK_A);
    expect(risk!.noxiousAgentCode).toBe("01.01.001");
    expect(await repo.getRiskSource("org_b", RISK_A)).toBeNull();

    // gera S-2240 a partir do risco + funcionário (como a Server Action faz)
    const xml = buildEsocialXml("S-2240", {
      cpf: (await repo.getEmployeeSource("org_a", EMPLOYEE_A))!.cpf,
      dataInicio: "2026-01-10",
      codigoAgenteNocivo: risk!.noxiousAgentCode!,
      unidadeMedida: risk!.measurementUnit ?? undefined,
    });
    expect(xml).toContain("<codAgNoc>01.01.001</codAgNoc>");
  });

  it("envia lote (só pending) e consulta retorno", async () => {
    const a = await seedEvent();
    const b = await seedEvent();

    const result = await repo.sendBatch("org_a", [a, b]);
    expect(result!.count).toBe(2);
    expect(result!.protocolNumber).toMatch(/^PROT-/);
    const evA = await repo.getEvent("org_a", a);
    expect(evA!.status).toBe("sent");
    expect(evA!.batchId).toBe(result!.batchId);

    // reenviar os mesmos (agora sent) → nenhum elegível
    expect(await repo.sendBatch("org_a", [a, b])).toBeNull();

    // consulta retorno → aceitos
    const ret = await repo.queryBatchReturn("org_a", result!.batchId);
    expect(ret!.updated).toBe(2);
    expect((await repo.getEvent("org_a", a))!.status).toBe("accepted");
  });

  it("sendBatch ignora ids de outro tenant", async () => {
    const mine = await seedEvent();
    const otherPayload = buildEsocialXml("S-2210", {
      cpf: "99999999999",
      dataAcidente: "2026-02-01",
      descricao: "B",
    });
    const other = await repo.createEvent("org_b", {
      eventType: "S-2210",
      payload: otherPayload,
    });
    // org_a tenta enviar incluindo o evento de org_b → só o próprio entra
    const result = await repo.sendBatch("org_a", [mine, other.id]);
    expect(result!.count).toBe(1);
    // o evento de org_b permanece pending
    expect((await repo.getEvent("org_b", other.id))!.status).toBe("pending");
  });

  it("lista filtra por status", async () => {
    const accepted = await repo.listEvents("org_a", { status: "accepted" });
    expect(accepted.rows.every((r) => r.status === "accepted")).toBe(true);
    const pending = await repo.listEvents("org_a", { status: "pending" });
    expect(pending.rows.every((r) => r.status === "pending")).toBe(true);
  });
});
