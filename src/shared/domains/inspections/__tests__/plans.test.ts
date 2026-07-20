import {
  PLAN_TYPE_LABELS,
  inspectionPlanInputSchema,
  planItemInputSchema,
  planTypeLabel,
  toPlanListItem,
} from "@/shared/domains/inspections/plans";
import type { InspectionPlan } from "@/shared/db/schema";

describe("inspectionPlanInputSchema", () => {
  it("aceita plano válido com itens", () => {
    const parsed = inspectionPlanInputSchema.parse({
      type: "vehicular",
      title: "Checklist diário",
      items: [{ description: "Freios", defaultValue: true }, { description: "Pneus" }],
    });
    expect(parsed.title).toBe("Checklist diário");
    expect(parsed.items).toHaveLength(2);
    expect(parsed.items[0].defaultValue).toBe(true);
    expect(parsed.items[1].defaultValue).toBe(false);
  });

  it("rejeita tipo inválido (safety não usa plano)", () => {
    expect(() =>
      inspectionPlanInputSchema.parse({ type: "safety", title: "X" }),
    ).toThrow();
  });

  it("rejeita título vazio", () => {
    expect(() =>
      inspectionPlanInputSchema.parse({ type: "equipment", title: "   " }),
    ).toThrow();
  });

  it("itens padrão para lista vazia", () => {
    const parsed = inspectionPlanInputSchema.parse({
      type: "equipment",
      title: "Sem itens",
    });
    expect(parsed.items).toEqual([]);
  });
});

describe("planItemInputSchema", () => {
  it("exige descrição do item", () => {
    expect(() => planItemInputSchema.parse({ description: "" })).toThrow();
  });
});

describe("planTypeLabel / toPlanListItem", () => {
  it("mapeia rótulos conhecidos", () => {
    expect(planTypeLabel("vehicular")).toBe(PLAN_TYPE_LABELS.vehicular);
    expect(planTypeLabel("equipment")).toBe("Máquinas e Equipamentos");
    expect(planTypeLabel("desconhecido")).toBe("desconhecido");
  });

  it("projeta linha de listagem", () => {
    const row = {
      id: "p1",
      orgId: "org_a",
      type: "vehicular",
      subtype: null,
      title: "Plano",
      description: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      itemCount: 3,
    } as InspectionPlan & { itemCount: number };
    expect(toPlanListItem(row)).toEqual({
      id: "p1",
      title: "Plano",
      type: "vehicular",
      typeLabel: "Veicular",
      subtype: null,
      itemCount: 3,
    });
  });
});
