/**
 * Validação opt-in: Postgres descartável → template real → Gotenberg real → worker
 * standalone → Storage privado → download assinado do GED. Só auth/cache do Next
 * são substituídos. Usa objetos com UUID novo e os remove mesmo se houver falha.
 * Nunca habilitar contra banco de cliente: o seed trunca o banco de teste.
 */
jest.mock("@/shared/auth/require-office-staff", () => ({
  OFFICE_STAFF_ROLES: new Set(["owner", "collaborator"]),
  requireOfficeStaff: jest.fn(),
}));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));

import { spawn, type ChildProcess } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest } from "next/server";
import type postgres from "postgres";

import { requireOfficeStaff } from "@/shared/auth/require-office-staff";
import { adminClient, applyMigrations } from "../_helpers/db";
import { PGR_IDS, seedPgrBase } from "../_helpers/pgr-seed";

const enabled = process.env.PGR_DOCX_LIVE_TEST === "true";
const gate = jest.mocked(requireOfficeStaff);
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const headers = { "x-dev-tenant": "org_a", "x-dev-role": "owner" };
const context = (id = PGR_IDS.pgrA) => ({ params: Promise.resolve({ id }) });

(enabled ? describe : describe.skip)("DOCX/PDF e GED com serviços reais", () => {
  let routes: typeof import("../../../app/api/v1/pgr/[id]/docx/route");
  let consolidatedRepo: typeof import("@/shared/db/repositories/pgr-consolidated");
  let extrasRepo: typeof import("@/shared/db/repositories/pgr-docx-extras");
  let mapper: typeof import("@/shared/domains/pgr/pgr-docx/from-consolidated");
  let engine: typeof import("@/shared/integrations/docx/template-engine");
  let storage: typeof import("@/shared/integrations/storage/documents-storage");
  let batchAction: typeof import("@/shared/server/actions/documents/pdf-batch");
  let downloadAction: typeof import("@/shared/server/actions/documents/download");
  let admin: ReturnType<typeof postgres>;
  const objects: string[] = [];
  const originalEnv = { ...process.env };

  beforeAll(async () => {
    for (const name of [
      "DATABASE_URL",
      "DATABASE_URL_UNPOOLED",
      "INTEGRATION_DATABASE_URL",
      "INTEGRATION_DATABASE_URL_ADMIN",
      "INTEGRATION_APP_RUNTIME_URL",
    ]) {
      const url = new URL(process.env[name] ?? "");
      if (
        !["127.0.0.1", "localhost"].includes(url.hostname) ||
        url.pathname !== "/sst_test"
      ) {
        throw new Error(`${name} deve apontar para Postgres local descartável /sst_test`);
      }
    }
    if (!process.env.GOTENBERG_URL || !process.env.SUPABASE_SECRET_KEY) {
      throw new Error("Teste real exige Gotenberg e Storage configurados");
    }
    process.env.APP_ENV = "local";
    process.env.DEV_API_AUTH_BYPASS = "true";
    process.env.PGR_DOCX_PDF_PROVIDER = "gotenberg";
    [
      routes,
      consolidatedRepo,
      extrasRepo,
      mapper,
      engine,
      storage,
      batchAction,
      downloadAction,
    ] = await Promise.all([
      import("../../../app/api/v1/pgr/[id]/docx/route"),
      import("@/shared/db/repositories/pgr-consolidated"),
      import("@/shared/db/repositories/pgr-docx-extras"),
      import("@/shared/domains/pgr/pgr-docx/from-consolidated"),
      import("@/shared/integrations/docx/template-engine"),
      import("@/shared/integrations/storage/documents-storage"),
      import("@/shared/server/actions/documents/pdf-batch"),
      import("@/shared/server/actions/documents/download"),
    ]);
    admin = adminClient();
    await applyMigrations(admin);
    await seedPgrBase(admin);
    gate.mockResolvedValue({
      userId: "dev-user",
      tenantId: "org_a",
      role: "owner",
      plan: "free",
    });
  });

  afterAll(async () => {
    try {
      for (const object of objects) await storage.removeDocumentObject(object);
    } finally {
      await admin?.end({ timeout: 5 });
      process.env = originalEnv;
    }
  });

  it("exporta DOCX preenchido e PDF real; ausências não recebem dados de exemplo", async () => {
    const docx = await routes.GET(
      new NextRequest(`http://localhost/api/v1/pgr/${PGR_IDS.pgrA}/docx`, { headers }),
      context(),
    );
    expect(docx.status).toBe(200);
    expect(docx.headers.get("content-disposition")).toMatch(/\.docx"$/);
    const text = engine
      .extractDocxText(Buffer.from(await docx.arrayBuffer()))
      .replace(/\u00A0/g, " ");
    expect(engine.findLeftoverMarkers(text)).toEqual([]);
    for (const value of [
      "A LTDA",
      "Pedreiro",
      "Ruído contínuo",
      "Capacete CA-123",
      "Não informado",
    ]) {
      expect(text).toContain(value);
    }
    expect(text).not.toContain("B LTDA");
    const consolidated = await consolidatedRepo.getPgrConsolidated("org_a", PGR_IDS.pgrA);
    const extras = await extrasRepo.getPgrDocxExtras("org_a", PGR_IDS.pgrA);
    const data = mapper.buildPgrDocxContent(consolidated!, extras!, {
      emittedAt: "14/10/2026 12:00",
    });
    expect(data.company.stateRegistration).toBe("");
    expect(data.responsibles.coauthors).toBe("");
    expect(Object.values(data.contract).every((value) => value === "")).toBe(true);

    const pdf = await routes.GET(
      new NextRequest(`http://localhost/api/v1/pgr/${PGR_IDS.pgrA}/docx?format=pdf`, {
        headers,
      }),
      context(),
    );
    expect(pdf.status).toBe(200);
    expect(pdf.headers.get("content-type")).toBe("application/pdf");
    expect(pdf.headers.get("cache-control")).toBe("no-store");
    const file = Buffer.from(await pdf.arrayBuffer());
    expect(file.subarray(0, 5).toString()).toBe("%PDF-");
    expect(file.length).toBeGreaterThan(10_000);
    if (process.env.PGR_DOCX_QA_DIR) {
      await mkdir(process.env.PGR_DOCX_QA_DIR, { recursive: true });
      await writeFile(path.join(process.env.PGR_DOCX_QA_DIR, "pgr-exportado.pdf"), file);
    }
  }, 60_000);

  it("aplica overrides e valida acesso, formato e campos desconhecidos", async () => {
    const post = (body: unknown) =>
      routes.POST(
        new NextRequest("http://localhost/docx", {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        }),
        context(),
      );
    const response = await post({
      overrides: { titles: { introduction: "1 - APRESENTAÇÃO DA OBRA" } },
    });
    expect(response.status).toBe(200);
    expect(engine.extractDocxText(Buffer.from(await response.arrayBuffer()))).toContain(
      "1 - APRESENTAÇÃO DA OBRA",
    );
    expect((await post({ format: "odt" })).status).toBe(422);
    expect((await post({ overrides: { campoInventado: "teste" } })).status).toBe(422);
    expect(
      (
        await routes.GET(
          new NextRequest("http://localhost/docx", {
            headers: { ...headers, "x-dev-role": "client" },
          }),
          context(),
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await routes.GET(
          new NextRequest("http://localhost/docx", {
            headers: { ...headers, "x-dev-tenant": "org_b" },
          }),
          context(),
        )
      ).status,
    ).toBe(404);
  });

  it("ação do GED → fila → worker standalone → PDF privado → download assinado", async () => {
    const enqueued = await batchAction.enqueuePgrPdfBatchAction([PGR_IDS.pgrA]);
    if (!enqueued.ok) throw new Error(enqueued.error.code);
    const [{ documentId, jobId, format }] = enqueued.data;
    expect(format).toBe("pdf");
    const objectPath = `org_a/documentos/generated/${documentId}.pdf`;
    objects.push(objectPath);
    let worker: ChildProcess | undefined;
    let logs = "";
    try {
      worker = spawn(
        process.execPath,
        ["--conditions=react-server", "--import", "tsx", "worker/index.ts"],
        {
          cwd: process.cwd(),
          env: { ...process.env, WORKER_POLL_IDLE_MS: "100" },
          stdio: ["ignore", "pipe", "pipe"],
        },
      );
      worker.stdout?.on("data", (value: Buffer) => {
        logs += value.toString();
      });
      worker.stderr?.on("data", (value: Buffer) => {
        logs += value.toString();
      });
      const deadline = Date.now() + 45_000;
      let status = "pending";
      while (Date.now() < deadline) {
        const [job] = await admin<
          { status: string }[]
        >`select status from public.jobs where id = ${jobId}`;
        status = job.status;
        if (["done", "failed"].includes(status) || worker.exitCode !== null) break;
        await wait(250);
      }
      if (status !== "done") throw new Error(`Worker: ${status}. ${logs}`);
    } finally {
      if (worker && worker.exitCode === null) {
        const stopped = new Promise<void>((resolve) =>
          worker!.once("exit", () => resolve()),
        );
        worker.kill("SIGTERM");
        await Promise.race([stopped, wait(5000)]);
        if (worker.exitCode === null) {
          worker.kill("SIGKILL");
          await stopped;
        }
      }
    }
    const [doc] = await admin<
      { status: string; storage_path: string; size_bytes: number }[]
    >`
      select status, storage_path, size_bytes::int from public.documents where id = ${documentId}`;
    expect(doc.status).toBe("ready");
    expect(doc.storage_path).toBe(objectPath);
    expect(doc.size_bytes).toBeGreaterThan(10_000);

    const download = await downloadAction.downloadDocumentAction(documentId);
    if (!download.ok) throw new Error(download.error.code);
    const response = await fetch(download.data.url);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    const file = Buffer.from(await response.arrayBuffer());
    expect(file.length).toBe(doc.size_bytes);
    expect(file.subarray(0, 5).toString()).toBe("%PDF-");
    if (process.env.PGR_DOCX_QA_DIR)
      await writeFile(path.join(process.env.PGR_DOCX_QA_DIR, "pgr-ged.pdf"), file);

    gate.mockResolvedValue({
      userId: "dev-user",
      tenantId: "org_b",
      role: "owner",
      plan: "free",
    });
    expect(await downloadAction.downloadDocumentAction(documentId)).toMatchObject({
      ok: false,
      error: { code: "NOT_FOUND" },
    });
    gate.mockResolvedValue({
      userId: "dev-user",
      tenantId: "org_a",
      role: "owner",
      plan: "free",
    });
  }, 60_000);
});
