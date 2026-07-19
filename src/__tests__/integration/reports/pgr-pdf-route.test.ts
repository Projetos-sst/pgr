/**
 * Route handler `/api/v1/pgr/[id]/pdf` (#40) — gate de auth + mapeamento de status.
 * Cobre os 2 bugs do QA: (1) honra o dev bypass via `resolveContext`; (2)
 * `UNAUTHORIZED → 401` (antes caía no else → 400). `generatePgrPdf` mockado (sem DB).
 */
jest.mock("@/shared/server/platform/pgr-pdf-core", () => ({
  generatePgrPdf: jest.fn(),
}));
jest.mock("@/shared/auth/require-office-staff", () => ({
  OFFICE_STAFF_ROLES: new Set(["owner", "collaborator"]),
  requireOfficeStaff: jest.fn(),
}));

import { NextRequest } from "next/server";

import { requireOfficeStaff } from "@/shared/auth/require-office-staff";
import { generatePgrPdf } from "@/shared/server/platform/pgr-pdf-core";
import {
  UnauthorizedError,
  ForbiddenError,
  NoTenantContextError,
} from "@/shared/auth/errors";
import { NotFoundError } from "@/shared/errors/not-found-error";

import { GET } from "../../../app/api/v1/pgr/[id]/pdf/route";

const mockedGate = requireOfficeStaff as jest.MockedFunction<typeof requireOfficeStaff>;
const mockedGen = generatePgrPdf as jest.MockedFunction<typeof generatePgrPdf>;

function get(id: string, headers: Record<string, string> = {}) {
  const req = new NextRequest(`http://localhost/api/v1/pgr/${id}/pdf`, { headers });
  return GET(req, { params: Promise.resolve({ id }) });
}

const ENV = process.env;

beforeEach(() => {
  process.env = { ...ENV, APP_ENV: "local", DEV_API_AUTH_BYPASS: "false" };
  mockedGate.mockReset();
  mockedGen.mockReset().mockResolvedValue({
    fileName: "pgr-1.pdf",
    pdf: Buffer.from("%PDF-1.4"),
  });
});
afterAll(() => {
  process.env = ENV;
});

describe("GET /api/v1/pgr/[id]/pdf", () => {
  it("honra o dev bypass (sem chamar requireOfficeStaff) → 200", async () => {
    process.env.DEV_API_AUTH_BYPASS = "true";
    const res = await get("pgr-1", { "x-dev-tenant": "org_a", "x-dev-role": "owner" });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(mockedGate).not.toHaveBeenCalled();
    expect(mockedGen).toHaveBeenCalledWith("org_a", "pgr-1", { coverColor: undefined });
  });

  it("sem sessão → UNAUTHORIZED mapeia para 401 (não 400)", async () => {
    mockedGate.mockRejectedValue(new UnauthorizedError());
    const res = await get("pgr-1");
    expect(res.status).toBe(401);
  });

  it("papel sem acesso → FORBIDDEN → 403", async () => {
    mockedGate.mockRejectedValue(new ForbiddenError());
    expect((await get("pgr-1")).status).toBe(403);
  });

  it("sem tenant → NO_TENANT_CONTEXT → 403", async () => {
    mockedGate.mockRejectedValue(new NoTenantContextError());
    expect((await get("pgr-1")).status).toBe(403);
  });

  it("PGR inexistente → NOT_FOUND → 404", async () => {
    mockedGate.mockResolvedValue({
      userId: "u",
      tenantId: "org_a",
      plan: "free",
      role: "owner",
    });
    mockedGen.mockRejectedValue(new NotFoundError());
    expect((await get("pgr-1")).status).toBe(404);
  });
});
