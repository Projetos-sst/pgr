import { withBarPercents } from "@/shared/domains/platform/dashboard";

describe("withBarPercents", () => {
  it("calcula o percentual relativo ao maior valor da série", () => {
    const out = withBarPercents([
      { key: "a", label: "A", count: 10 },
      { key: "b", label: "B", count: 5 },
      { key: "c", label: "C", count: 0 },
    ]);
    expect(out.map((r) => r.percent)).toEqual([100, 50, 0]);
  });

  it("série toda zerada → todos 0% (sem divisão por zero)", () => {
    const out = withBarPercents([
      { key: "a", label: "A", count: 0 },
      { key: "b", label: "B", count: 0 },
    ]);
    expect(out.every((r) => r.percent === 0)).toBe(true);
  });
});
