import {
  resolveExposedTotal,
  buildExposedWorkersMap,
} from "@/shared/domains/pgr/exposed-workers";

describe("exposed workers aggregation (R1 / FR-019/020)", () => {
  describe("resolveExposedTotal", () => {
    it("returns 0 when there are no associations (undefined row)", () => {
      expect(resolveExposedTotal(undefined)).toBe(0);
    });

    it("returns 0 when the coalesced sum is null", () => {
      expect(resolveExposedTotal({ total: null })).toBe(0);
    });

    it("returns the summed worker_count when present", () => {
      expect(resolveExposedTotal({ total: 5 })).toBe(5);
    });

    it("never yields null nor throws", () => {
      expect(resolveExposedTotal({ total: 0 })).toBe(0);
      expect(typeof resolveExposedTotal(undefined)).toBe("number");
    });
  });

  describe("buildExposedWorkersMap", () => {
    it("includes GES with no associations as 0 (LEFT JOIN → null → 0)", () => {
      const map = buildExposedWorkersMap([
        { gesId: "ges_1", total: 5 },
        { gesId: "ges_2", total: null },
      ]);
      expect(map).toEqual({ ges_1: 5, ges_2: 0 });
    });

    it("maps each GES to its summed worker_count", () => {
      const map = buildExposedWorkersMap([
        { gesId: "ges_a", total: 3 },
        { gesId: "ges_b", total: 2 },
      ]);
      expect(map.ges_a).toBe(3);
      expect(map.ges_b).toBe(2);
    });

    it("returns an empty object when there are no GES", () => {
      expect(buildExposedWorkersMap([])).toEqual({});
    });
  });
});
