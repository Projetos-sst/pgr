import { z } from "zod";

import { toActionError } from "@/shared/server/action-error";
import { ok, fail } from "@/shared/server/result";
import { ForbiddenError } from "@/shared/auth/errors";
import { DuplicateError } from "@/shared/errors/duplicate-error";
import { EntityInUseError } from "@/shared/errors/entity-in-use-error";

it("maps a wrapped company CNPJ constraint to its field, preserving other duplicate errors", () => {
  const duplicate = {
    cause: { code: "23505", constraint_name: "uq_companies_org_id_cnpj" },
  };
  expect(toActionError(duplicate)).toEqual({
    code: "DUPLICATE",
    message: "CNPJ já cadastrado neste escritório.",
    fields: { cnpj: "CNPJ já cadastrado neste escritório." },
  });
  expect(
    toActionError({ cause: { code: "23505", constraint_name: "other" } }),
  ).not.toHaveProperty("fields");
});

describe("ok/fail (ActionResult)", () => {
  it("ok envelopa os dados", () => {
    expect(ok({ id: "1" })).toEqual({ ok: true, data: { id: "1" } });
  });

  it("fail produz erro com code/message e omite fields quando ausente", () => {
    expect(fail("NOT_FOUND", "não encontrado")).toEqual({
      ok: false,
      error: { code: "NOT_FOUND", message: "não encontrado" },
    });
  });

  it("fail inclui fields quando fornecido", () => {
    expect(fail("VALIDATION", "inválido", { cpf: "obrigatório" })).toEqual({
      ok: false,
      error: { code: "VALIDATION", message: "inválido", fields: { cpf: "obrigatório" } },
    });
  });
});

describe("toActionError", () => {
  it("ZodError → VALIDATION com fields por caminho", () => {
    const schema = z.object({ cpf: z.string().min(11), risk: z.number().int().min(1) });
    const result = schema.safeParse({ cpf: "1", risk: 0 });
    expect(result.success).toBe(false);
    const mapped = toActionError(result.error);
    expect(mapped?.code).toBe("VALIDATION");
    expect(mapped?.fields).toMatchObject({
      cpf: expect.any(String),
      risk: expect.any(String),
    });
  });

  it("AppError → seu próprio code", () => {
    expect(toActionError(new ForbiddenError())).toEqual({
      code: "FORBIDDEN",
      message: "FORBIDDEN",
    });
  });

  it("DuplicateError com campo leva a mensagem ao campo; sem campo, sem fields", () => {
    const withField = new DuplicateError("Registro repetido.", { field: "crm" });
    expect(toActionError(withField)).toEqual({
      code: "DUPLICATE",
      message: "Registro repetido.",
      fields: { crm: "Registro repetido." },
    });
    expect(toActionError(new DuplicateError("Registro repetido."))).toEqual({
      code: "DUPLICATE",
      message: "Registro repetido.",
    });
  });

  it("UNIQUE violation (23505) → DUPLICATE", () => {
    expect(toActionError({ code: "23505" })?.code).toBe("DUPLICATE");
  });

  it("FK violation (23503) → FK_NOT_FOUND", () => {
    expect(toActionError({ code: "23503" })?.code).toBe("FK_NOT_FOUND");
  });

  it("CHECK violation (23514) → VALIDATION", () => {
    expect(toActionError({ code: "23514" })?.code).toBe("VALIDATION");
  });

  it("invalid text representation / uuid cru (22P02) → VALIDATION (§13)", () => {
    expect(toActionError({ code: "22P02" })?.code).toBe("VALIDATION");
  });

  it("erro do Postgres embrulhado pelo Drizzle (code em .cause) → mapeia", () => {
    const drizzleError = Object.assign(new Error("Failed query: insert into ..."), {
      cause: Object.assign(new Error("violates foreign key constraint"), {
        code: "23503",
      }),
    });
    expect(toActionError(drizzleError)?.code).toBe("FK_NOT_FOUND");
  });

  it("EntityInUseError → IN_USE (≈409), sem vazar exceção crua (010)", () => {
    const mapped = toActionError(new EntityInUseError());
    expect(mapped?.code).toBe("IN_USE");
    expect(typeof mapped?.message).toBe("string");
    expect(mapped?.message.length).toBeGreaterThan(0);
  });

  it("EntityInUseError preserva mensagem customizada", () => {
    expect(toActionError(new EntityInUseError("Em uso por entrega"))).toEqual({
      code: "IN_USE",
      message: "Em uso por entrega",
    });
  });

  it("erro inesperado → null (caller relança)", () => {
    expect(toActionError(new Error("boom"))).toBeNull();
    expect(toActionError("oops")).toBeNull();
  });
});
