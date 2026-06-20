import { z } from "zod";

import { toActionError } from "@/shared/server/action-error";
import { ok, fail } from "@/shared/server/result";
import { ForbiddenError } from "@/shared/auth/errors";

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
    expect(mapped?.fields).toMatchObject({ cpf: expect.any(String), risk: expect.any(String) });
  });

  it("AppError → seu próprio code", () => {
    expect(toActionError(new ForbiddenError())).toEqual({
      code: "FORBIDDEN",
      message: "FORBIDDEN",
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

  it("erro inesperado → null (caller relança)", () => {
    expect(toActionError(new Error("boom"))).toBeNull();
    expect(toActionError("oops")).toBeNull();
  });
});
