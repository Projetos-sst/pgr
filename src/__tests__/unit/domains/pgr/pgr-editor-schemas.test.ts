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
  it("aceita revisão válida (número ≥1, data, notas)", () => {
    const parsed = pgrRevisionInputSchema.safeParse({
      revisionNumber: 2,
      revisedAt: "2026-07-12",
      notes: "Revisão anual",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.revisionNumber).toBe(2);
      expect(parsed.data.notes).toBe("Revisão anual");
    }
  });

  it("coage número em string ('3' → 3)", () => {
    const parsed = pgrRevisionInputSchema.safeParse({
      revisionNumber: "3",
      revisedAt: "2026-07-12",
    });
    expect(parsed.success && parsed.data.revisionNumber).toBe(3);
  });

  it("rejeita revisionNumber < 1 e não-inteiro", () => {
    expect(
      pgrRevisionInputSchema.safeParse({ revisionNumber: 0, revisedAt: "2026-07-12" })
        .success,
    ).toBe(false);
    expect(
      pgrRevisionInputSchema.safeParse({ revisionNumber: 1.5, revisedAt: "2026-07-12" })
        .success,
    ).toBe(false);
  });

  it("exige revisedAt válido (calendário)", () => {
    expect(
      pgrRevisionInputSchema.safeParse({ revisionNumber: 1, revisedAt: "" }).success,
    ).toBe(false);
    expect(
      pgrRevisionInputSchema.safeParse({ revisionNumber: 1, revisedAt: "2026-13-45" })
        .success,
    ).toBe(false);
  });

  it("notes é opcional ('' → undefined)", () => {
    const parsed = pgrRevisionInputSchema.safeParse({
      revisionNumber: 1,
      revisedAt: "2026-07-12",
      notes: "",
    });
    expect(parsed.success && parsed.data.notes).toBeUndefined();
  });
});
