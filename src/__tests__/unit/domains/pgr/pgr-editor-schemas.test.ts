import { pgrGesInputSchema } from "@/shared/domains/pgr/pgr-ges";
import { pgrRevisionInputSchema } from "@/shared/domains/pgr/pgr-revision";

const UUID = "11111111-1111-1111-1111-1111111111a2";

describe("pgrGesInputSchema", () => {
  it("aceita gesId UUID válido", () => {
    expect(pgrGesInputSchema.safeParse({ gesId: UUID }).success).toBe(true);
  });
  it("rejeita gesId ausente ou não-UUID", () => {
    expect(pgrGesInputSchema.safeParse({}).success).toBe(false);
    expect(pgrGesInputSchema.safeParse({ gesId: "abc" }).success).toBe(false);
  });
});

describe("pgrRevisionInputSchema", () => {
  it("aceita revisão válida (data + notas) SEM revisionNumber", () => {
    const parsed = pgrRevisionInputSchema.safeParse({
      revisedAt: "2026-07-12",
      notes: "Revisão anual",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.notes).toBe("Revisão anual");
      // O número NÃO é aceito do cliente (contrato server-side).
      expect("revisionNumber" in parsed.data).toBe(false);
    }
  });

  it("rejeita revisionNumber no input (schema estrito → VALIDATION)", () => {
    expect(
      pgrRevisionInputSchema.safeParse({
        revisedAt: "2026-07-12",
        revisionNumber: 99,
      }).success,
    ).toBe(false);
  });

  it("rejeita qualquer campo desconhecido (estrito)", () => {
    expect(
      pgrRevisionInputSchema.safeParse({ revisedAt: "2026-07-12", foo: "bar" }).success,
    ).toBe(false);
  });

  it("exige revisedAt válido (calendário)", () => {
    expect(pgrRevisionInputSchema.safeParse({ revisedAt: "" }).success).toBe(false);
    expect(pgrRevisionInputSchema.safeParse({ revisedAt: "2026-13-45" }).success).toBe(
      false,
    );
  });

  it("notes é opcional ('' → undefined)", () => {
    const parsed = pgrRevisionInputSchema.safeParse({
      revisedAt: "2026-07-12",
      notes: "",
    });
    expect(parsed.success && parsed.data.notes).toBeUndefined();
  });
});
