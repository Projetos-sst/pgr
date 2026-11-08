/**
 * Cadastro duplicado por formatação do registro (NOB-110/NOB-112) contra Postgres efêmero:
 * - mesmo escritório + categoria + UF + número canônico ("12.345" = "12345") → DUPLICATE no
 *   campo `crm`, sem gravar nada (criação, edição e REST);
 * - outra UF, outra categoria, zero à esquerda a mais ou outro escritório → permitido;
 * - cadastro antigo sem UF com o mesmo número bloqueia um novo; completar a UF dele é permitido;
 * - duplicatas antigas continuam editáveis sem mudar o registro (nada é juntado nem apagado);
 * - duas gravações concorrentes de números equivalentes, em conexões separadas: só uma passa;
 * - contagem só-leitura de grupos de possíveis duplicatas, sem dado pessoal.
 * Dados fictícios.
 */
import type postgres from "postgres";
import { NextRequest } from "next/server";

jest.mock("@/shared/db/env", () => ({
  getDatabaseUrl: () => process.env.INTEGRATION_APP_RUNTIME_URL,
}));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("@/shared/auth/require-office-staff", () => ({
  OFFICE_STAFF_ROLES: new Set(["owner", "collaborator"]),
  requireOfficeStaff: jest.fn(),
}));

import { requireOfficeStaff } from "@/shared/auth/require-office-staff";
import { ForbiddenError } from "@/shared/auth/errors";
import {
  createMedicoAction,
  updateMedicoAction,
} from "@/shared/server/actions/pgr/medicos";
import * as repo from "@/shared/db/repositories/medicos";
import {
  medicoInputSchema,
  MEDICO_CRM_TAKEN_MESSAGE,
  MEDICO_REGISTRATION_DUPLICATE_MESSAGE,
  MEDICO_REGISTRATION_MISSING_UF_DUPLICATE_MESSAGE,
  type MedicoInput,
} from "@/shared/domains/pgr/medicos";
import { POST as CREATE } from "@/app/api/v1/medicos/route";
import { PUT as UPDATE } from "@/app/api/v1/medicos/[id]/route";

import { adminClient, applyMigrations } from "../_helpers/db";
import { seedPgrBase } from "../_helpers/pgr-seed";

const APP_RUNTIME_URL = process.env.INTEGRATION_APP_RUNTIME_URL;
const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!APP_RUNTIME_URL && !!ADMIN_URL;

const mockedGate = requireOfficeStaff as jest.MockedFunction<typeof requireOfficeStaff>;
const asOwner = (tenantId: string) =>
  mockedGate.mockResolvedValue({ userId: "u", tenantId, plan: "free", role: "owner" });

const medico = (crm: string, overrides: Partial<MedicoInput> = {}): MedicoInput => ({
  name: "Dra. Fictícia Exemplo",
  crm,
  registrationUf: "MA",
  profession: "physician",
  ...overrides,
});

const req = (method: string, body: unknown, role = "owner", tenant = "org_a") =>
  new NextRequest("http://localhost/api/v1/medicos", {
    method,
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      "x-dev-tenant": tenant,
      "x-dev-user": "u",
      "x-dev-role": role,
    },
  });
const params = (id: string) => ({ params: Promise.resolve({ id }) });

(shouldRun ? describe : describe.skip)("Médicos — registro duplicado", () => {
  let admin: ReturnType<typeof postgres>;
  const originalEnv = { ...process.env };

  beforeAll(async () => {
    admin = adminClient();
    await applyMigrations(admin);
  });
  afterAll(async () => {
    process.env = originalEnv;
    await admin.end({ timeout: 5 });
  });
  beforeEach(async () => {
    await seedPgrBase(admin);
    mockedGate.mockReset();
    asOwner("org_a");
    process.env.APP_ENV = "local";
    process.env.DEV_API_AUTH_BYPASS = "true";
  });

  const countMedicos = async (org = "org_a") => {
    const [{ total }] = await admin<{ total: number }[]>`
      select count(*)::int as total from medicos where org_id = ${org}`;
    return total;
  };

  /** Cadastro antigo gravado direto no banco (owner), como os anteriores à regra. */
  const legacy = async (crm: string, uf: string | null, name = "Dr. Legado") => {
    const [row] = await admin<{ id: string }[]>`
      insert into medicos (org_id, name, crm, profession, registration_uf)
      values ('org_a', ${name}, ${crm}, 'physician', ${uf}) returning id`;
    return row.id;
  };

  it("mesmo número com outra formatação, mesma categoria e UF → DUPLICATE no campo crm, nada gravado", async () => {
    expect((await createMedicoAction(medico("12.345"))).ok).toBe(true);
    for (const crm of ["12345", " 12 345 ", "12-345", "1/2345"]) {
      const dup = await createMedicoAction(medico(crm, { registrationUf: "ma" }));
      expect(dup.ok).toBe(false);
      if (!dup.ok) {
        expect(dup.error.code).toBe("DUPLICATE");
        expect(dup.error.message).toBe(MEDICO_REGISTRATION_DUPLICATE_MESSAGE);
        expect(dup.error.fields).toEqual({ crm: MEDICO_REGISTRATION_DUPLICATE_MESSAGE });
      }
    }
    expect(await countMedicos()).toBe(1);
  });

  it("outra UF, zero à esquerda, outra categoria e outro escritório são registros diferentes", async () => {
    expect((await createMedicoAction(medico("12.345"))).ok).toBe(true);
    expect((await createMedicoAction(medico("12345", { registrationUf: "PI" }))).ok).toBe(
      true,
    );
    expect((await createMedicoAction(medico("012345"))).ok).toBe(true);
    expect(
      (await createMedicoAction(medico("12 345", { profession: "psychologist" }))).ok,
    ).toBe(true);
    expect(await countMedicos()).toBe(4);

    asOwner("org_b");
    expect((await createMedicoAction(medico("12-345"))).ok).toBe(true);
    expect(await countMedicos("org_b")).toBe(1);
  });

  it("editar outro médico para um número equivalente → DUPLICATE; o cadastro não muda", async () => {
    const first = await createMedicoAction(medico("23.456"));
    const second = await createMedicoAction(medico("99999", { name: "Dr. Outro" }));
    expect(first.ok && second.ok).toBe(true);
    if (!second.ok) return;

    const res = await updateMedicoAction(second.data.id, medico("23456"));
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe("DUPLICATE");
      expect(res.error.fields?.crm).toBe(MEDICO_REGISTRATION_DUPLICATE_MESSAGE);
    }
    const [row] = await admin<{ crm: string; name: string }[]>`
      select crm, name from medicos where id = ${second.data.id}`;
    expect(row).toEqual({ crm: "99999", name: "Dr. Outro" });

    // O próprio cadastro pode ser reformatado (não conflita consigo mesmo).
    if (!first.ok) return;
    const self = await updateMedicoAction(first.data.id, medico("23456"));
    expect(self.ok && self.data.crm).toBe("23456");
  });

  it("duplicata antiga continua editável sem mudar o registro; nada é juntado nem apagado", async () => {
    const a = await legacy("45.678", "MA", "Dr. Legado A");
    const b = await legacy("45678", "MA", "Dr. Legado B");

    const edited = await updateMedicoAction(
      b,
      medico("45678", { name: "Dr. Legado B (revisado)", status: "inactive" }),
    );
    expect(edited.ok && edited.data.status).toBe("inactive");
    // Reformatar o número sem mudar o registro também segue permitido.
    const reformatted = await updateMedicoAction(a, medico("45 678"));
    expect(reformatted.ok).toBe(true);
    // Trocar para outra UF também é registro novo e passa pela conferência.
    expect(
      (await updateMedicoAction(b, medico("45678", { registrationUf: "PI" }))).ok,
    ).toBe(true);
    const back = await updateMedicoAction(b, medico("45678"));
    expect(back.ok).toBe(false);
    if (!back.ok) expect(back.error.code).toBe("DUPLICATE");
    expect(await countMedicos()).toBe(2);
  });

  it("cadastro antigo sem UF bloqueia um novo com o mesmo número; completar a UF dele é permitido", async () => {
    const old = await legacy("56.789", null);

    const dup = await createMedicoAction(medico("56789", { registrationUf: "SP" }));
    expect(dup.ok).toBe(false);
    if (!dup.ok) {
      expect(dup.error.code).toBe("DUPLICATE");
      expect(dup.error.fields).toEqual({
        crm: MEDICO_REGISTRATION_MISSING_UF_DUPLICATE_MESSAGE,
      });
    }
    expect(await countMedicos()).toBe(1);

    const completed = await updateMedicoAction(
      old,
      medico("56.789", { registrationUf: "SP" }),
    );
    expect(completed.ok && completed.data.registrationUf).toBe("SP");
    // Com a UF completa, outra UF é outro registro.
    expect((await createMedicoAction(medico("56789", { registrationUf: "PI" }))).ok).toBe(
      true,
    );
  });

  it("mesmo texto de registro (índice bruto) → DUPLICATE com mensagem no campo crm", async () => {
    expect((await createMedicoAction(medico("CRM 01.111/MA"))).ok).toBe(true);
    const dup = await createMedicoAction(
      medico("CRM 01.111/MA", { registrationUf: "PI" }),
    );
    expect(dup.ok).toBe(false);
    if (!dup.ok) {
      expect(dup.error.code).toBe("DUPLICATE");
      expect(dup.error.fields?.crm).toBe(MEDICO_CRM_TAKEN_MESSAGE);
    }
  });

  it("duas criações concorrentes de números equivalentes, em conexões separadas: só uma passa", async () => {
    // Segunda cópia do repositório, com o próprio cliente postgres: transações paralelas.
    const holder: { repo?: typeof repo } = {};
    await jest.isolateModulesAsync(async () => {
      holder.repo = await import("@/shared/db/repositories/medicos");
    });
    const isolated = holder.repo;
    expect(isolated).toBeDefined();
    expect(isolated).not.toBe(repo);
    if (!isolated) return;
    const values = (crm: string) => medicoInputSchema.parse(medico(crm));

    for (const [left, right] of [
      ["34.567", "34567"],
      ["78-901", "78 901"],
    ]) {
      const results = await Promise.allSettled([
        repo.createMedico("org_a", values(left)),
        isolated.createMedico("org_a", values(right)),
      ]);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      const rejected = results.find((r) => r.status === "rejected");
      expect(rejected?.status === "rejected" && rejected.reason).toMatchObject({
        code: "DUPLICATE",
        fields: { crm: MEDICO_REGISTRATION_DUPLICATE_MESSAGE },
      });
    }
    expect(await countMedicos()).toBe(2);
  });

  it("REST: POST e PUT de número equivalente → 409 com a mensagem no campo crm", async () => {
    const created = await CREATE(req("POST", medico("67.890")));
    expect(created.status).toBe(201);
    const other = await CREATE(req("POST", medico("11111")));
    expect(other.status).toBe(201);
    const { id } = (await other.json()) as { id: string };

    const dup = await CREATE(req("POST", medico("67890")));
    expect(dup.status).toBe(409);
    expect(await dup.json()).toEqual({
      error: {
        code: "DUPLICATE",
        message: MEDICO_REGISTRATION_DUPLICATE_MESSAGE,
        fields: { crm: MEDICO_REGISTRATION_DUPLICATE_MESSAGE },
      },
    });
    const put = await UPDATE(req("PUT", medico("6.7890")), params(id));
    expect(put.status).toBe(409);
    expect(await countMedicos()).toBe(2);

    const otherTenant = await CREATE(req("POST", medico("67890"), "owner", "org_b"));
    expect(otherTenant.status).toBe(201);
  });

  it("papel client continua FORBIDDEN (Server Action e REST)", async () => {
    mockedGate.mockRejectedValue(new ForbiddenError());
    const res = await createMedicoAction(medico("12345"));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("FORBIDDEN");
    expect((await CREATE(req("POST", medico("12345"), "client"))).status).toBe(403);
    expect(await countMedicos()).toBe(0);
  });

  it("contagem só-leitura de grupos de possíveis duplicatas, por escritório", async () => {
    expect(await repo.countMedicoRegistrationDuplicateGroups("org_a")).toBe(0);
    await legacy("45.678", "MA");
    await legacy("45678", "MA");
    await legacy("56.789", null);
    await legacy("56789", "SP");
    await legacy("90.000", "MA");
    expect(await repo.countMedicoRegistrationDuplicateGroups("org_a")).toBe(2);
    expect(await repo.countMedicoRegistrationDuplicateGroups("org_b")).toBe(0);
  });
});
