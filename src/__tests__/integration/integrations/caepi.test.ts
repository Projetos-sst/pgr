/**
 * Integração da fatia 011 (CAEPI) contra Postgres EFÊMERO — três suítes no
 * mesmo arquivo (T017 consulta · T023 ingestão · T025 GRANT), porque todas
 * compartilham o setup da tabela global. `caepi_certificates` fica fora do
 * `truncateAll` (tabela global, sem tenant) — a limpeza é local ao setup.
 */
import { createReadStream } from "node:fs";
import path from "node:path";

jest.mock("@/shared/db/env", () => ({
  getDatabaseUrl: () => process.env.INTEGRATION_APP_RUNTIME_URL,
}));

import type { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { GET } from "@/app/api/integrations/caepi/[ca]/route";
import { getByCa } from "@/shared/db/repositories/caepi";
import { upsertMany } from "@/shared/db/repositories/caepi-upsert";
import { lookupCaRecord } from "@/shared/integrations/caepi/lookup";
import { parseCaepiCsv } from "@/shared/integrations/caepi/parse";
import { todayInSaoPaulo } from "@/shared/integrations/caepi/validate-ca";
import type { CaepiParsedRow } from "@/shared/integrations/caepi/types";
import { lookupCa } from "@/shared/server/actions/epi/lookup-ca";

import { adminClient, applyMigrations } from "../_helpers/db";

const APP_RUNTIME_URL = process.env.INTEGRATION_APP_RUNTIME_URL;
const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!APP_RUNTIME_URL && !!ADMIN_URL;

const FIXTURES_DIR = path.resolve(process.cwd(), "src/__tests__/integration/_fixtures");
const SYNCED_AT = new Date("2026-07-01T12:00:00Z");

const mockAuth = auth as unknown as jest.Mock;

function setAuthenticated(authenticated: boolean) {
  mockAuth.mockResolvedValue(
    authenticated
      ? { isAuthenticated: true, userId: "u1", sessionId: "s1" }
      : { isAuthenticated: false, userId: null, sessionId: null },
  );
}

function callRest(ca: string) {
  return GET({} as unknown as NextRequest, { params: Promise.resolve({ ca }) });
}

function row(overrides: Partial<CaepiParsedRow> & { ca: string }): CaepiParsedRow {
  return {
    validUntil: "2031-01-16",
    situation: "VÁLIDO",
    manufacturerName: "TEC LUVAS LTDA",
    manufacturerCnpj: "39280192000172",
    equipmentName: "LUVA DE MALHA DE AÇO",
    description: null,
    nature: "Nacional",
    norms: "ABNT NBR 16621:2017",
    ...overrides,
  };
}

(shouldRun ? describe : describe.skip)("CAEPI — integração (fatia 011)", () => {
  let admin: ReturnType<typeof postgres>;
  let runtime: ReturnType<typeof postgres>;
  let adminDb: ReturnType<typeof drizzle>;

  beforeAll(async () => {
    admin = adminClient();
    await applyMigrations(admin);
    adminDb = drizzle(admin);
    runtime = postgres(APP_RUNTIME_URL!, { max: 1, prepare: false });
  });

  afterAll(async () => {
    await runtime.end({ timeout: 5 });
    await admin.end({ timeout: 5 });
  });

  beforeEach(async () => {
    await admin`delete from caepi_certificates`;
    setAuthenticated(true);
  });

  async function seed(rows: CaepiParsedRow[]) {
    await upsertMany(adminDb, rows, SYNCED_AT);
  }

  describe("US1 — consulta local (getByCa/lookupCaRecord + surfaces)", () => {
    it("getByCa devolve os 3 estados e o sinal de base vazia", async () => {
      await seed([
        row({ ca: "53080" }),
        row({ ca: "13", validUntil: "2006-06-26", situation: "VENCIDO" }),
      ]);

      const found = await getByCa("53080");
      expect(found.record?.ca).toBe("53080");
      expect(found.record?.validUntil).toBe("2031-01-16");

      const missing = await getByCa("99999");
      expect(missing.record).toBeNull();
      if (missing.record === null) expect(missing.baseEmpty).toBe(false);
    });

    it("base vazia → not_found com baseUnsynced (nunca erro)", async () => {
      const result = await lookupCaRecord("53080");
      expect(result).toEqual({ status: "not_found", ca: "53080", baseUnsynced: true });
    });

    it("lookupCaRecord deriva valid/expired/not_found, com limite == hoje → valid", async () => {
      await seed([
        row({ ca: "53080" }),
        row({ ca: "13", validUntil: "2006-06-26", situation: "VENCIDO" }),
        row({ ca: "777", validUntil: todayInSaoPaulo() }),
      ]);

      const valid = await lookupCaRecord("53080");
      expect(valid.status).toBe("valid");
      if (valid.status === "valid") {
        expect(valid.manufacturer).toBe("TEC LUVAS LTDA");
        expect(valid.norm).toBe("ABNT NBR 16621:2017");
        expect(valid.validUntil).toBe("2031-01-16");
        expect(valid.equipmentName).toBe("LUVA DE MALHA DE AÇO");
      }

      expect((await lookupCaRecord("13")).status).toBe("expired");
      expect((await lookupCaRecord("777")).status).toBe("valid");
      expect(await lookupCaRecord("99999")).toEqual({
        status: "not_found",
        ca: "99999",
      });
    });

    it("REST: 200 com payload nos 3 estados (divergência consciente do 404 de CEP/CNPJ)", async () => {
      await seed([
        row({ ca: "53080" }),
        row({ ca: "13", validUntil: "2006-06-26", situation: "VENCIDO" }),
      ]);

      const valid = await callRest("53080");
      expect(valid.status).toBe(200);
      expect(valid.headers.get("Cache-Control")).toBe("no-store");
      const validBody = await valid.json();
      expect(validBody.ok).toBe(true);
      expect(validBody.data.status).toBe("valid");

      const expired = await callRest("13");
      expect(expired.status).toBe(200);
      expect((await expired.json()).data.status).toBe("expired");

      const notFound = await callRest("99999");
      expect(notFound.status).toBe(200);
      expect((await notFound.json()).data.status).toBe("not_found");
    });

    it("REST: formato inválido → 422 VALIDATION; aceita máscara leve (normaliza)", async () => {
      await seed([row({ ca: "53080" })]);

      const invalid = await callRest("abc123");
      expect(invalid.status).toBe(422);
      expect((await invalid.json()).error.code).toBe("VALIDATION");

      const masked = await callRest("53.080");
      expect(masked.status).toBe(200);
      expect((await masked.json()).data.ca).toBe("53080");
    });

    it("guarda de sessão nas DUAS surfaces (SC-008): sem sessão → 401/UNAUTHORIZED", async () => {
      setAuthenticated(false);

      const rest = await callRest("53080");
      expect(rest.status).toBe(401);
      expect((await rest.json()).error.code).toBe("UNAUTHORIZED");

      const action = await lookupCa("53080");
      expect(action.ok).toBe(false);
      if (!action.ok) expect(action.error.code).toBe("UNAUTHORIZED");
    });

    it("Server Action: sessão comum (sem papel/tenant — ex.: papel client) consulta normalmente", async () => {
      await seed([row({ ca: "53080" })]);

      const result = await lookupCa(" 53.080 ");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.status).toBe("valid");
        expect(result.data.ca).toBe("53080");
      }

      const invalid = await lookupCa("abc");
      expect(invalid.ok).toBe(false);
      if (!invalid.ok) expect(invalid.error.code).toBe("VALIDATION");
    });
  });

  describe("US2 — ingestão (parse fixture real + upsert idempotente + fail-safe)", () => {
    async function ingestFixture(name: string) {
      let upserted = 0;
      const stats = await parseCaepiCsv(
        createReadStream(path.join(FIXTURES_DIR, name)),
        async (rows) => {
          const result = await upsertMany(adminDb, rows, SYNCED_AT);
          upserted += result.upserted;
        },
      );
      return { stats, upserted };
    }

    it("ingere a fixture real: válidas gravadas com colunas D8, corrompidas descartadas", async () => {
      const { stats } = await ingestFixture("caepi-sample.csv.gz");
      expect(stats).toEqual({ parsed: 5, discarded: 2 });

      const rows = await admin`
        select ca, valid_until, situation, manufacturer_name, norms
        from caepi_certificates order by ca
      `;
      expect(rows).toHaveLength(5);
      expect(rows.map((r) => r.ca).sort()).toEqual(["126", "13", "29", "31469", "53080"]);

      const ca31469 = rows.find((r) => r.ca === "31469");
      expect(ca31469?.situation).toBe("VÁLIDO");
      expect(ca31469?.manufacturer_name).toBe("PLASTCOR DO BRASIL LTDA");
    });

    it("idempotência: 2ª execução → mesma contagem e mesmos valores, zero duplicatas", async () => {
      await ingestFixture("caepi-sample.csv.gz");
      const before = await admin`
        select ca, valid_until, situation, manufacturer_name from caepi_certificates order by ca
      `;

      await ingestFixture("caepi-sample.csv.gz");
      const after = await admin`
        select ca, valid_until, situation, manufacturer_name from caepi_certificates order by ca
      `;

      expect(after).toHaveLength(before.length);
      expect(JSON.stringify(after)).toBe(JSON.stringify(before));
    });

    it("update in-place: 2ª carga com situation/valid_until novos atualiza sem duplicar", async () => {
      await seed([row({ ca: "53080" })]);

      await upsertMany(
        adminDb,
        [row({ ca: "53080", situation: "VENCIDO", validUntil: "2026-01-01" })],
        new Date("2026-07-02T12:00:00Z"),
      );

      const rows = await admin`
        select ca, situation, valid_until, synced_at from caepi_certificates where ca = '53080'
      `;
      expect(rows).toHaveLength(1);
      expect(rows[0].situation).toBe("VENCIDO");
    });

    it("duplicata de ca no mesmo lote: vence a última ocorrência (data-model §2)", async () => {
      await upsertMany(
        adminDb,
        [row({ ca: "53080", situation: "VENCIDO" }), row({ ca: "53080" })],
        SYNCED_AT,
      );
      const rows = await admin`
        select situation from caepi_certificates where ca = '53080'
      `;
      expect(rows).toHaveLength(1);
      expect(rows[0].situation).toBe("VÁLIDO");
    });

    it("fail-safe: gzip truncado falha ANTES de escrever — base semeada intocada", async () => {
      await seed([row({ ca: "53080" })]);

      await expect(ingestFixture("caepi-sample-truncated.csv.gz")).rejects.toThrow();

      const rows = await admin`select ca, situation from caepi_certificates`;
      expect(rows).toHaveLength(1);
      expect(rows[0].ca).toBe("53080");
      expect(rows[0].situation).toBe("VÁLIDO");
    });
  });

  describe("US3 — GRANT por papel (exceção contida)", () => {
    it("app_runtime lê (SELECT + policy global) e NÃO escreve (42501)", async () => {
      await seed([row({ ca: "53080" })]);

      const selected = await runtime`
        select ca, situation from caepi_certificates where ca = '53080'
      `;
      expect(selected).toHaveLength(1);

      const expect42501 = async (promise: Promise<unknown>) => {
        await expect(promise).rejects.toMatchObject({ code: "42501" });
      };
      await expect42501(
        runtime`insert into caepi_certificates (ca, valid_until, situation, synced_at)
                values ('999999999', '2030-01-01', 'VÁLIDO', now())`,
      );
      await expect42501(
        runtime`update caepi_certificates set situation = 'X' where ca = '53080'`,
      );
      await expect42501(runtime`delete from caepi_certificates where ca = '53080'`);
    });

    it("conexão owner/admin escreve normalmente (o caminho do job)", async () => {
      const { upserted } = await upsertMany(adminDb, [row({ ca: "424242" })], SYNCED_AT);
      expect(upserted).toBe(1);
      const rows = await admin`select ca from caepi_certificates where ca = '424242'`;
      expect(rows).toHaveLength(1);
    });
  });
});
