import { z } from "zod";

import { ValidationError } from "../errors";
import { parseOrThrow } from "../parse";

describe("parseOrThrow", () => {
  const schema = z.object({
    email: z.string().email(),
    age: z.number().int().nonnegative(),
  });

  it("retorna o valor parseado tipado no happy path (U1.a)", () => {
    const out = parseOrThrow(schema, { email: "a@b.com", age: 30 });
    expect(out).toEqual({ email: "a@b.com", age: 30 });
  });

  it("lança ValidationError sem vazar campo nem input original (U1.b → FR-020)", () => {
    const badInput = { email: "not-an-email", age: -1, secret: "leak-me" };

    try {
      parseOrThrow(schema, badInput);
      fail("deveria ter lançado");
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
      const e = err as ValidationError;
      expect(e.code).toBe("VALIDATION_ERROR");
      expect(e.message).toBe("VALIDATION_ERROR");
      const payload = { code: e.code, message: e.message };
      const serialized = JSON.stringify(payload);
      expect(serialized).not.toContain("not-an-email");
      expect(serialized).not.toContain("leak-me");
      expect(serialized).not.toContain('"email"');
      expect(serialized).not.toContain('"age"');
      expect(e).not.toHaveProperty("issues");
      expect(e).not.toHaveProperty("path");
      expect(e).not.toHaveProperty("input");
    }
  });

  it("compila tipos estritos (U1.c)", () => {
    const result: { email: string; age: number } = parseOrThrow(schema, {
      email: "a@b.com",
      age: 1,
    });
    expect(result.age).toBe(1);
  });
});
