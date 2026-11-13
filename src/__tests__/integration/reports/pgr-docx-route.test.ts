jest.mock("@/shared/server/platform/pgr-docx-core", () => ({
  generatePgrDocx: jest.fn(),
}));
jest.mock("@/shared/auth/require-office-staff", () => ({
  OFFICE_STAFF_ROLES: new Set(["owner", "collaborator"]),
  requireOfficeStaff: jest.fn(),
}));

import { NextRequest } from "next/server";
import { requireOfficeStaff } from "@/shared/auth/require-office-staff";
import { UnauthorizedError } from "@/shared/auth/errors";
import { NotFoundError } from "@/shared/errors/not-found-error";
import { ReportUnavailableError } from "@/shared/errors/report-unavailable-error";
import { generatePgrDocx } from "@/shared/server/platform/pgr-docx-core";
import { GET, POST } from "../../../app/api/v1/pgr/[id]/docx/route";

const gate = jest.mocked(requireOfficeStaff);
const generate = jest.mocked(generatePgrDocx);
const originalEnv = { ...process.env };
const PGR_ID = "11111111-1111-4111-8111-111111111111";
const context = { params: Promise.resolve({ id: PGR_ID }) };
const headers = { "x-dev-tenant": "org_a", "x-dev-role": "owner" };
const get = (query = "", customHeaders = headers) =>
  GET(
    new NextRequest(`http://localhost/docx${query}`, { headers: customHeaders }),
    context,
  );

beforeEach(() => {
  process.env = { ...originalEnv, APP_ENV: "local", DEV_API_AUTH_BYPASS: "true" };
  gate.mockReset().mockRejectedValue(new UnauthorizedError());
  generate.mockReset().mockResolvedValue({
    fileName: "pgr-1.pdf",
    contentType: "application/pdf",
    file: Buffer.from("%PDF-1.4"),
    title: "PGR",
    missingTags: [],
    provenance: {
      pgrId: PGR_ID,
      generatedAt: "2026-10-20T12:00:00.000Z",
      templateSha256: "a".repeat(64),
      textsSha256: "d".repeat(64),
      sourceSha256: "b".repeat(64),
      fileSha256: "c".repeat(64),
    },
  });
});
afterAll(() => {
  process.env = originalEnv;
});

describe("exportação pelo template DOCX", () => {
  it("encaminha PDF, tenant e headers de download sem cache", async () => {
    const response = await get("?format=pdf");
    expect(response.status).toBe(200);
    expect(generate).toHaveBeenCalledWith("org_a", PGR_ID, { format: "pdf" });
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="pgr-1.pdf"',
    );
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-pgr-generated-at")).toBe("2026-10-20T12:00:00.000Z");
    expect(response.headers.get("x-pgr-texts-sha256")).toBe("d".repeat(64));
    expect(response.headers.get("x-pgr-template-sha256")).toBe("a".repeat(64));
    expect(response.headers.get("x-pgr-source-sha256")).toBe("b".repeat(64));
    expect(response.headers.get("x-pgr-file-sha256")).toBe("c".repeat(64));
  });

  it("mantém download DOCX quando formato não é informado", async () => {
    expect((await get()).status).toBe(200);
    expect(generate).toHaveBeenCalledWith("org_a", PGR_ID, { format: "docx" });
  });

  it("produção ignora bypass e exige sessão real → 401", async () => {
    process.env.APP_ENV = "production";
    expect((await get()).status).toBe(401);
    expect(gate).toHaveBeenCalledTimes(1);
    expect(generate).not.toHaveBeenCalled();
  });

  it("client é bloqueado antes de gerar o arquivo → 403", async () => {
    expect((await get("", { ...headers, "x-dev-role": "client" })).status).toBe(403);
    expect(generate).not.toHaveBeenCalled();
  });

  it("formato desconhecido e JSON inválido → 422", async () => {
    expect((await get("?format=odt")).status).toBe(422);
    expect(
      (
        await POST(
          new NextRequest("http://localhost/docx", {
            method: "POST",
            headers,
            body: "{",
          }),
          context,
        )
      ).status,
    ).toBe(422);
    expect(generate).not.toHaveBeenCalled();
  });

  it("POST encaminha somente overrides validados", async () => {
    const overrides = { titles: { introduction: "1 - APRESENTAÇÃO" } };
    expect(
      (
        await POST(
          new NextRequest("http://localhost/docx", {
            method: "POST",
            headers,
            body: JSON.stringify({ format: "pdf", overrides }),
          }),
          context,
        )
      ).status,
    ).toBe(200);
    expect(generate).toHaveBeenCalledWith("org_a", PGR_ID, { format: "pdf", overrides });
  });

  it("PGR inexistente → 404; conversor indisponível → 503", async () => {
    generate.mockRejectedValueOnce(new NotFoundError());
    expect((await get()).status).toBe(404);
    generate.mockRejectedValueOnce(new ReportUnavailableError());
    expect((await get("?format=pdf")).status).toBe(503);
  });
});
