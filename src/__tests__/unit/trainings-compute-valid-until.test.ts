import { computeValidUntil } from "@/shared/domains/pgr/trainings";

describe("computeValidUntil (D1)", () => {
  it("annual → +1 ano", () => {
    expect(computeValidUntil("2026-03-15", "annual")).toBe("2027-03-15");
  });

  it("biennial → +2 anos", () => {
    expect(computeValidUntil("2026-03-15", "biennial")).toBe("2028-03-15");
  });

  it("triennial → +3 anos", () => {
    expect(computeValidUntil("2026-03-15", "triennial")).toBe("2029-03-15");
  });

  it("quinquennial → +5 anos", () => {
    expect(computeValidUntil("2026-03-15", "quinquennial")).toBe("2031-03-15");
  });

  it("single → null (não expira)", () => {
    expect(computeValidUntil("2026-03-15", "single")).toBeNull();
  });

  it("é date-only: preserva o dia do mês na virada de ano", () => {
    expect(computeValidUntil("2025-12-31", "annual")).toBe("2026-12-31");
    expect(computeValidUntil("2026-01-01", "quinquennial")).toBe("2031-01-01");
  });

  it("29 de fevereiro cai em ano não-bissexto → rola para 1º de março (determinístico)", () => {
    expect(computeValidUntil("2024-02-29", "annual")).toBe("2025-03-01");
  });
});
