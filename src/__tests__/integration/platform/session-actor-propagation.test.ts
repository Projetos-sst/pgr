import { sql } from "drizzle-orm";
import { NextRequest } from "next/server";
import type postgres from "postgres";

jest.mock("@/shared/db/env", () => ({
  getDatabaseUrl: () => process.env.INTEGRATION_APP_RUNTIME_URL,
}));
jest.mock("@/shared/auth/require-office-staff", () => ({
  OFFICE_STAFF_ROLES: new Set(["owner", "collaborator"]),
  requireOfficeStaff: jest.fn(),
}));

import { requireOfficeStaff } from "@/shared/auth/require-office-staff";
import { restHandler } from "@/shared/api/rest";
import { runAsActor } from "@/shared/db/session-actor";
import { withOrg } from "@/shared/db/with-org";
import { officeAction } from "@/shared/server/office-action";

import { adminClient, applyMigrations } from "../_helpers/db";
import { seedPgrBase } from "../_helpers/pgr-seed";

const enabled =
  !!process.env.INTEGRATION_APP_RUNTIME_URL && !!process.env.INTEGRATION_DATABASE_URL;

function databaseActor(): Promise<unknown> {
  return withOrg("org_a", async (tx) => {
    const [row] = await tx.execute(
      sql`select nullif(current_setting('app.current_actor', true), '') as actor`,
    );
    return row.actor;
  });
}

function devRequest(user: string): NextRequest {
  return new NextRequest("http://localhost/api/v1/companies", {
    headers: {
      "x-dev-tenant": "org_a",
      "x-dev-role": "collaborator",
      "x-dev-user": user,
    },
  });
}

(enabled ? describe : describe.skip)("session actor reaches the database", () => {
  let admin: ReturnType<typeof postgres>;
  const previous = {
    app: process.env.APP_ENV,
    bypass: process.env.DEV_API_AUTH_BYPASS,
  };

  beforeAll(async () => {
    admin = adminClient();
    await applyMigrations(admin);
    await seedPgrBase(admin);
    process.env.APP_ENV = "local";
    process.env.DEV_API_AUTH_BYPASS = "true";
  });
  afterAll(async () => {
    process.env.APP_ENV = previous.app;
    process.env.DEV_API_AUTH_BYPASS = previous.bypass;
    await admin?.end({ timeout: 5 });
  });

  it("runs background work without an actor", async () => {
    expect(await databaseActor()).toBeNull();
  });

  it("sets the actor of the request in every tenant transaction", async () => {
    expect(await runAsActor("user-1", databaseActor)).toBe("user-1");
    expect(await databaseActor()).toBeNull();
  });

  it("uses the authenticated user of a Server Action", async () => {
    jest.mocked(requireOfficeStaff).mockResolvedValue({
      userId: "action-user",
      tenantId: "org_a",
      role: "collaborator",
      plan: "free",
    });
    const result = await officeAction("test.actor", databaseActor);
    expect(result).toEqual({ ok: true, data: "action-user" });
  });

  it("uses the caller of a REST handler", async () => {
    const response = await restHandler(devRequest("rest-user"), databaseActor);
    expect(await response.json()).toBe("rest-user");
  });
});
