/**
 * Integração REST do histórico de versões do GED (#56) contra Postgres efêmero, via bypass dev.
 * `GET /api/v1/documents/{id}/versions` e a trava de somente leitura em `PUT /documents/{id}`.
 * O `POST /versions` usa o mesmo repositório, coberto em `documents-versions.test.ts`.
 */
import type postgres from "postgres";
import { NextRequest } from "next/server";

jest.mock("@/shared/db/env", () => ({
  getDatabaseUrl: () => process.env.INTEGRATION_APP_RUNTIME_URL,
}));
// Mantém os exports reais (o bypass dev do `restHandler` lê `OFFICE_STAFF_ROLES`); só o gate
// de sessão é substituído, já que a autenticação vem dos headers `x-dev-*`.
jest.mock("@/shared/auth/require-office-staff", () => ({
  ...jest.requireActual("@/shared/auth/require-office-staff"),
  requireOfficeStaff: jest.fn(),
}));

import { GET as LIST_VERSIONS } from "@/app/api/v1/documents/[id]/versions/route";
import { PUT as PUT_DOCUMENT } from "@/app/api/v1/documents/[id]/route";

import { adminClient, applyMigrations } from "../_helpers/db";
import { seedPgrBase } from "../_helpers/pgr-seed";

const APP_RUNTIME_URL = process.env.INTEGRATION_APP_RUNTIME_URL;
const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!APP_RUNTIME_URL && !!ADMIN_URL;

const GROUP = "ffffffff-0000-0000-0000-00000000000a";
const V1 = "ffffffff-0000-0000-0000-000000000001";
const V2 = "ffffffff-0000-0000-0000-000000000002";

function req(opts: { method: string; body?: string; tenant?: string }) {
  const { method, body, tenant = "org_a" } = opts;
  return new NextRequest("http://localhost/api/v1", {
    method,
    body,
    headers: {
      "content-type": "application/json",
      "x-dev-tenant": tenant,
      "x-dev-role": "owner",
    },
  });
}

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

(shouldRun ? describe : describe.skip)("REST GED — versões (#56)", () => {
  let admin: ReturnType<typeof postgres>;

  beforeAll(async () => {
    admin = adminClient();
    await applyMigrations(admin);
    process.env.APP_ENV = "local";
    process.env.DEV_API_AUTH_BYPASS = "true";
  });

  afterAll(async () => {
    await admin.end({ timeout: 5 });
    delete process.env.DEV_API_AUTH_BYPASS;
  });

  beforeEach(async () => {
    await seedPgrBase(admin);
    await admin.unsafe(`
      insert into public.documents
        (id, org_id, folder_id, document_group_id, name, doc_type, version, storage_path, size_bytes)
      values
        ('${V1}', 'org_a', null, '${GROUP}', 'Laudo', 'Laudo', 1, 'org_a/documentos/${GROUP}/v1.pdf', 100),
        ('${V2}', 'org_a', null, '${GROUP}', 'Laudo', 'Laudo', 2, 'org_a/documentos/${GROUP}/v2.pdf', 200);
    `);
  });

  it("GET /documents/{id}/versions → 200 com a vigente marcada", async () => {
    const res = await LIST_VERSIONS(req({ method: "GET" }), ctx(V1));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { version: number; isCurrent: boolean }[];
    expect(body.map((v) => [v.version, v.isCurrent])).toEqual([
      [2, true],
      [1, false],
    ]);
  });

  it("GET de documento de outro escritório → 404", async () => {
    const res = await LIST_VERSIONS(req({ method: "GET", tenant: "org_b" }), ctx(V2));
    expect(res.status).toBe(404);
  });

  it("PUT em versão antiga → 409 DOCUMENT_VERSION_READ_ONLY", async () => {
    const res = await PUT_DOCUMENT(
      req({ method: "PUT", body: JSON.stringify({ name: "Reescrita" }) }),
      ctx(V1),
    );
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("DOCUMENT_VERSION_READ_ONLY");
  });

  it("PUT na versão vigente → 200", async () => {
    const res = await PUT_DOCUMENT(
      req({ method: "PUT", body: JSON.stringify({ name: "Laudo revisado" }) }),
      ctx(V2),
    );
    expect(res.status).toBe(200);
  });
});
