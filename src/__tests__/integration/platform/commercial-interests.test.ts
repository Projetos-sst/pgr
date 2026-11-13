import postgres from "postgres";

jest.mock("@/shared/db/env", () => ({
  getDatabaseUrl: () => process.env.INTEGRATION_APP_RUNTIME_URL,
}));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
const mockStaff = jest.fn();
jest.mock("@/shared/auth/require-office-staff", () => ({
  OFFICE_STAFF_ROLES: new Set(["owner", "collaborator"]),
  requireOfficeStaff: () => mockStaff(),
}));

import { adminClient, applyMigrations } from "../_helpers/db";
import { PGR_IDS as I } from "../_helpers/pgr-seed";
import {
  OTHER_COMPANY,
  UNKNOWN_ID,
  acting,
  clientUser,
  collaborator,
  devRequest,
  errorCode,
  outsider,
  owner,
  routeParams,
  seedCommercialBase,
} from "../_helpers/commercial-seed";
import type { CommercialInterest } from "@/shared/db/repositories/commercial-interests";
import * as core from "@/shared/server/commercial/commercial-core";
import {
  listCommercialInterestsAction,
  markCommercialInterestSeenAction,
  registerCommercialInterestAction,
} from "@/shared/server/actions/commercial/commercial";
import * as interestsRoute from "@/app/api/v1/commercial-interests/route";
import * as seenRoute from "@/app/api/v1/commercial-interests/[id]/seen/route";

const enabled = !!process.env.INTEGRATION_APP_RUNTIME_URL;
const ORIGINAL_MESSAGE = "Quero contratar o PGR para a unidade nova.";

(enabled ? describe : describe.skip)("interesse comercial por empresa", () => {
  let admin: ReturnType<typeof postgres>;
  let runtime: ReturnType<typeof postgres>;
  const oldEnv = { ...process.env };

  const asRuntime = (orgId: string, userId: string, statement: string) =>
    runtime.begin(async (tx) => {
      await tx`select set_config('app.current_org',${orgId},true), set_config('app.current_actor',${userId},true)`;
      return tx.unsafe(statement);
    });
  const register = (input: unknown, ctx = owner) =>
    acting(ctx, (actor) => core.registerInterest(actor, input));
  const list = (filters: unknown = {}, ctx = owner) =>
    acting(ctx, (actor) => core.listInterests(actor, filters));
  const seen = (id: string, ctx = owner) =>
    acting(ctx, (actor) => core.markInterestSeen(actor, id));
  const rows = () =>
    admin<CommercialInterest[]>`select id, company_id as "companyId", service, message,
      seen_at as "seenAt", seen_by as "seenBy" from commercial_interests order by created_at, id`;

  beforeAll(async () => {
    admin = adminClient();
    await admin`set client_min_messages=warning`;
    await applyMigrations(admin);
    runtime = postgres(String(process.env.INTEGRATION_APP_RUNTIME_URL), {
      max: 1,
      prepare: false,
    });
  });
  afterAll(async () => {
    process.env = oldEnv;
    await runtime.end({ timeout: 5 });
    await admin.end({ timeout: 5 });
  });
  beforeEach(async () => {
    await seedCommercialBase(admin);
    await admin`delete from commercial_interests`;
    mockStaff.mockReset();
    mockStaff.mockResolvedValue(owner);
    process.env.APP_ENV = "local";
    process.env.DEV_API_AUTH_BYPASS = "true";
    process.env.COMMERCIAL_CATALOG_ENABLED = "true";
  });

  describe("registro e deduplicação", () => {
    it("registra o interesse aberto e o lê de volta", async () => {
      const result = await register({
        companyId: I.companyA,
        service: "pgr",
        message: ORIGINAL_MESSAGE,
      });
      expect(result.created).toBe(true);
      expect(result.interest).toMatchObject({
        companyId: I.companyA,
        service: "pgr",
        message: ORIGINAL_MESSAGE,
        createdBy: "owner",
        seenAt: null,
        seenBy: null,
      });
    });

    it("repetir o mesmo interesse aberto devolve o existente e preserva a mensagem original", async () => {
      const first = await register({
        companyId: I.companyA,
        service: "pgr",
        message: ORIGINAL_MESSAGE,
      });
      const second = await register(
        { companyId: I.companyA, service: "pgr", message: "Outra mensagem." },
        collaborator,
      );
      expect(second.created).toBe(false);
      expect(second.interest.id).toBe(first.interest.id);
      expect(second.interest.message).toBe(ORIGINAL_MESSAGE);
      const stored = await rows();
      expect(stored).toHaveLength(1);
      expect(stored[0].message).toBe(ORIGINAL_MESSAGE);
    });

    it("serviços e empresas diferentes coexistem abertos", async () => {
      await register({ companyId: I.companyA, service: "pgr" });
      await register({ companyId: I.companyA, service: "medicine" });
      await register({ companyId: OTHER_COMPANY, service: "pgr" });
      expect(await rows()).toHaveLength(3);
    });

    it("depois de visto, um novo registro cria outro interesse aberto", async () => {
      const first = await register({ companyId: I.companyA, service: "pro" });
      await seen(first.interest.id);
      const again = await register({ companyId: I.companyA, service: "pro" });
      expect(again.created).toBe(true);
      expect(again.interest.id).not.toBe(first.interest.id);
      expect(await rows()).toHaveLength(2);
    });

    it("a mensagem vazia é gravada como ausente", async () => {
      const result = await register({
        companyId: I.companyA,
        service: "one_off",
        message: "   ",
      });
      expect(result.interest.message).toBeNull();
    });

    it("recusa canal externo, serviço inválido e mensagem acima do limite", async () => {
      expect(
        await errorCode(() =>
          register({ companyId: I.companyA, service: "pgr", whatsapp: "11999999999" }),
        ),
      ).toBe("VALIDATION");
      expect(
        await errorCode(() => register({ companyId: I.companyA, service: "x" })),
      ).toBe("VALIDATION");
      expect(
        await errorCode(() =>
          register({ companyId: I.companyA, service: "pgr", message: "a".repeat(501) }),
        ),
      ).toBe("VALIDATION");
      expect(await rows()).toHaveLength(0);
    });

    it("empresa de outro escritório ou inexistente dá FK_NOT_FOUND", async () => {
      expect(
        await errorCode(() => register({ companyId: I.companyB, service: "pgr" })),
      ).toBe("FK_NOT_FOUND");
      expect(
        await errorCode(() => register({ companyId: UNKNOWN_ID, service: "pgr" })),
      ).toBe("FK_NOT_FOUND");
    });
  });

  describe("marcar como visto", () => {
    it("é idempotente: visto em e visto por não mudam na segunda chamada", async () => {
      const { interest } = await register({ companyId: I.companyA, service: "pgr" });
      const first = await seen(interest.id);
      expect(first.seenAt).toBeInstanceOf(Date);
      expect(first.seenBy).toBe("owner");
      const second = await seen(interest.id, { ...owner, userId: "other_owner" });
      expect(second.seenAt?.getTime()).toBe(first.seenAt?.getTime());
      expect(second.seenBy).toBe("owner");
    });

    it("id de outro escritório ou inexistente dá NOT_FOUND", async () => {
      const { interest } = await register({ companyId: I.companyA, service: "pgr" });
      expect(await errorCode(() => seen(interest.id, outsider))).toBe("NOT_FOUND");
      expect(await errorCode(() => seen(UNKNOWN_ID))).toBe("NOT_FOUND");
      expect((await rows())[0].seenAt).toBeNull();
    });
  });

  describe("listagem", () => {
    it("pagina e filtra por empresa e por situação", async () => {
      const a = await register({ companyId: I.companyA, service: "pgr" });
      await register({ companyId: I.companyA, service: "medicine" });
      await register({ companyId: OTHER_COMPANY, service: "pgr" });
      await seen(a.interest.id);

      expect((await list()).total).toBe(3);
      expect((await list({ pageSize: 2 })).rows).toHaveLength(2);
      expect((await list({ companyId: I.companyA })).total).toBe(2);
      const open = await list({ status: "open" });
      expect(open.total).toBe(2);
      expect(open.rows.every((row) => row.seenAt === null)).toBe(true);
      const done = await list({ status: "seen" });
      expect(done.rows.map((row) => row.id)).toEqual([a.interest.id]);
      expect((await list({ companyId: OTHER_COMPANY, status: "seen" })).total).toBe(0);
    });

    it("não mostra interesses de outro escritório", async () => {
      await register({ companyId: I.companyA, service: "pgr" });
      expect((await list({}, outsider)).total).toBe(0);
    });
  });

  describe("papéis e flag", () => {
    it("collaborator registra, mas não lista nem marca como visto", async () => {
      const { interest } = await register(
        { companyId: I.companyA, service: "pgr" },
        collaborator,
      );
      expect(await errorCode(() => list({}, collaborator))).toBe("FORBIDDEN");
      expect(await errorCode(() => seen(interest.id, collaborator))).toBe("FORBIDDEN");
    });

    it("client recebe FORBIDDEN em tudo", async () => {
      const { interest } = await register({ companyId: I.companyA, service: "pgr" });
      expect(
        await errorCode(() =>
          register({ companyId: I.companyA, service: "medicine" }, clientUser),
        ),
      ).toBe("FORBIDDEN");
      expect(await errorCode(() => list({}, clientUser))).toBe("FORBIDDEN");
      expect(await errorCode(() => seen(interest.id, clientUser))).toBe("FORBIDDEN");
      expect(await rows()).toHaveLength(1);
    });

    it("com a flag desligada tudo responde FORBIDDEN", async () => {
      const { interest } = await register({ companyId: I.companyA, service: "pgr" });
      process.env.COMMERCIAL_CATALOG_ENABLED = "false";
      expect(
        await errorCode(() => register({ companyId: I.companyA, service: "pro" })),
      ).toBe("FORBIDDEN");
      expect(await errorCode(() => list())).toBe("FORBIDDEN");
      expect(await errorCode(() => seen(interest.id))).toBe("FORBIDDEN");
      expect(await rows()).toHaveLength(1);
    });
  });

  describe("Server Actions", () => {
    it("devolvem o contrato ActionResult", async () => {
      const registered = await registerCommercialInterestAction({
        companyId: I.companyA,
        service: "pgr",
      });
      expect(registered).toMatchObject({ ok: true, data: { created: true } });
      const id = registered.ok ? registered.data.interest.id : UNKNOWN_ID;
      expect(await listCommercialInterestsAction({ status: "open" })).toMatchObject({
        ok: true,
        data: { total: 1 },
      });
      expect(await markCommercialInterestSeenAction(id)).toMatchObject({ ok: true });
      mockStaff.mockResolvedValue(clientUser);
      expect(await listCommercialInterestsAction()).toMatchObject({
        ok: false,
        error: { code: "FORBIDDEN" },
      });
    });
  });

  describe("REST /api/v1/commercial-interests", () => {
    it("POST responde 201 ao criar e 200 ao devolver o aberto existente", async () => {
      const body = { companyId: I.companyA, service: "pgr", message: ORIGINAL_MESSAGE };
      const created = await interestsRoute.POST(
        devRequest("/api/v1/commercial-interests", "POST", body),
      );
      expect(created.status).toBe(201);
      const existing = await interestsRoute.POST(
        devRequest("/api/v1/commercial-interests", "POST", {
          ...body,
          message: "Outra.",
        }),
      );
      expect(existing.status).toBe(200);
      const payload = await existing.json();
      expect(payload.created).toBe(false);
      expect(payload.interest.message).toBe(ORIGINAL_MESSAGE);
    });

    it("POST com canal externo responde 422 e client responde 403", async () => {
      const external = await interestsRoute.POST(
        devRequest("/api/v1/commercial-interests", "POST", {
          companyId: I.companyA,
          service: "pgr",
          channel: "whatsapp",
        }),
      );
      expect(external.status).toBe(422);
      const forbidden = await interestsRoute.POST(
        devRequest(
          "/api/v1/commercial-interests",
          "POST",
          { companyId: I.companyA, service: "pgr" },
          "client",
        ),
      );
      expect(forbidden.status).toBe(403);
    });

    it("GET lista com filtros e só para owner", async () => {
      await register({ companyId: I.companyA, service: "pgr" });
      const ok = await interestsRoute.GET(
        devRequest(
          `/api/v1/commercial-interests?companyId=${I.companyA}&status=open`,
          "GET",
        ),
      );
      expect(ok.status).toBe(200);
      expect((await ok.json()).total).toBe(1);
      const denied = await interestsRoute.GET(
        devRequest("/api/v1/commercial-interests", "GET", undefined, "collaborator"),
      );
      expect(denied.status).toBe(403);
    });

    it("POST /[id]/seen responde 200 idempotente e 404 para id de outro escritório", async () => {
      const { interest } = await register({ companyId: I.companyA, service: "pgr" });
      const url = `/api/v1/commercial-interests/${interest.id}/seen`;
      const first = await seenRoute.POST(
        devRequest(url, "POST"),
        routeParams(interest.id),
      );
      const second = await seenRoute.POST(
        devRequest(url, "POST"),
        routeParams(interest.id),
      );
      expect(first.status).toBe(200);
      expect((await second.json()).seenAt).toBe((await first.json()).seenAt);
      const crossTenant = await seenRoute.POST(
        devRequest(url, "POST", undefined, "owner", "org_b"),
        routeParams(interest.id),
      );
      expect(crossTenant.status).toBe(404);
    });
  });

  describe("banco", () => {
    it("o UNIQUE parcial impede dois abertos e permite um aberto depois de visto", async () => {
      const insert = (seenAt: string | null) =>
        admin.unsafe(
          `insert into commercial_interests (org_id, company_id, service, created_by, seen_at, seen_by)
           values ('org_a', '${I.companyA}', 'pgr', 'owner', ${seenAt ? `'${seenAt}'` : "null"}, ${seenAt ? "'owner'" : "null"})`,
        );
      await insert(null);
      await expect(insert(null)).rejects.toMatchObject({ code: "23505" });
      await insert("2026-11-13T10:00:00Z");
      await insert("2026-11-13T11:00:00Z");
    });

    it("recusa empresa de outro escritório, seen_at sem seen_by e mensagem vazia", async () => {
      await expect(
        admin.unsafe(
          `insert into commercial_interests (org_id, company_id, service, created_by)
           values ('org_a', '${I.companyB}', 'pgr', 'owner')`,
        ),
      ).rejects.toMatchObject({ code: "23503" });
      await expect(
        admin.unsafe(
          `insert into commercial_interests (org_id, company_id, service, created_by, seen_at)
           values ('org_a', '${I.companyA}', 'pgr', 'owner', now())`,
        ),
      ).rejects.toMatchObject({ code: "23514" });
      await expect(
        admin.unsafe(
          `insert into commercial_interests (org_id, company_id, service, created_by, message)
           values ('org_a', '${I.companyA}', 'pgr', 'owner', '  ')`,
        ),
      ).rejects.toMatchObject({ code: "23514" });
    });

    it("o runtime só enxerga o próprio escritório e só insere como o próprio ator", async () => {
      await register({ companyId: I.companyA, service: "pgr" });
      const own = await asRuntime(
        "org_a",
        "owner",
        "select id from commercial_interests",
      );
      expect(own).toHaveLength(1);
      const other = await asRuntime(
        "org_b",
        "owner_b",
        "select id from commercial_interests",
      );
      expect(other).toHaveLength(0);
      await expect(
        asRuntime(
          "org_a",
          "owner",
          `insert into commercial_interests (org_id, company_id, service, created_by)
           values ('org_a', '${I.companyA}', 'medicine', 'someone-else')`,
        ),
      ).rejects.toThrow(/row-level security/);
    });

    it("membro com escopo só vê e registra interesse das empresas do seu escopo", async () => {
      await admin`insert into member_access_scopes (org_id, user_id, company_id, area, granted_by)
        values ('org_a', 'collab', ${I.companyA}, 'safety', 'owner')`;
      await register({ companyId: I.companyA, service: "pgr" });
      await register({ companyId: OTHER_COMPANY, service: "pgr" });

      const visible = await asRuntime(
        "org_a",
        "collab",
        "select company_id from commercial_interests",
      );
      expect(visible.map((row) => row.company_id)).toEqual([I.companyA]);

      expect(
        await errorCode(() =>
          register({ companyId: OTHER_COMPANY, service: "medicine" }, collaborator),
        ),
      ).toBe("FK_NOT_FOUND");
      await expect(
        asRuntime(
          "org_a",
          "collab",
          `insert into commercial_interests (org_id, company_id, service, created_by)
           values ('org_a', '${OTHER_COMPANY}', 'medicine', 'collab')`,
        ),
      ).rejects.toThrow(/row-level security/);
      const inScope = await register(
        { companyId: I.companyA, service: "medicine" },
        collaborator,
      );
      expect(inScope.created).toBe(true);
    });
  });
});
