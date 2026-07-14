/**
 * Integração do CRUD de agendamentos (schedule_events) contra Postgres efêmero.
 * Prova o isolamento multi-tenant (org_b não vê/acessa o evento de org_a).
 */
import type postgres from "postgres";

jest.mock("@/shared/db/env", () => ({
  getDatabaseUrl: () => process.env.INTEGRATION_APP_RUNTIME_URL,
}));

import {
  createScheduleEvent,
  deleteScheduleEvent,
  getScheduleEventById,
  listScheduleEvents,
  updateScheduleEvent,
} from "@/shared/db/repositories/schedule-events";
import type { ScheduleEventValues } from "@/shared/domains/platform/scheduling";

import { adminClient, applyMigrations } from "../_helpers/db";
import { seedPgrBase } from "../_helpers/pgr-seed";

const APP_RUNTIME_URL = process.env.INTEGRATION_APP_RUNTIME_URL;
const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!APP_RUNTIME_URL && !!ADMIN_URL;

function input(overrides: Partial<ScheduleEventValues> = {}): ScheduleEventValues {
  return {
    eventType: "inspection",
    title: "Inspeção do canteiro",
    eventDate: "2026-08-01",
    description: undefined,
    referenceUrl: undefined,
    ...overrides,
  };
}

(shouldRun ? describe : describe.skip)("schedule_events — CRUD + isolamento", () => {
  let admin: ReturnType<typeof postgres>;

  beforeAll(async () => {
    admin = adminClient();
    await applyMigrations(admin);
  });

  beforeEach(async () => {
    await seedPgrBase(admin);
  });

  afterAll(async () => {
    await admin.end();
  });

  it("cria e lista escopado ao tenant", async () => {
    await createScheduleEvent("org_a", input());
    const listA = await listScheduleEvents("org_a");
    expect(listA.total).toBe(1);
    const listB = await listScheduleEvents("org_b");
    expect(listB.total).toBe(0);
  });

  it("não acessa nem atualiza/deleta evento de outro tenant", async () => {
    const created = await createScheduleEvent("org_a", input());
    expect(await getScheduleEventById("org_b", created.id)).toBeNull();
    expect(
      await updateScheduleEvent("org_b", created.id, input({ title: "x" })),
    ).toBeNull();
    expect(await deleteScheduleEvent("org_b", created.id)).toBe(false);
    // Continua intacto para o dono.
    expect(await getScheduleEventById("org_a", created.id)).not.toBeNull();
  });

  it("filtra por tipo", async () => {
    await createScheduleEvent("org_a", input({ eventType: "inspection" }));
    await createScheduleEvent("org_a", input({ eventType: "exam", title: "ASO" }));
    const exams = await listScheduleEvents("org_a", { eventType: "exam" });
    expect(exams.total).toBe(1);
    expect(exams.rows[0].title).toBe("ASO");
  });
});
