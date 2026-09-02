import {
  PLAN_TYPE_LABELS,
  formatPlanCode,
  inspectionPlanInputSchema,
  nextPlanNumber,
  planItemInputSchema,
  planStatusLabel,
  planStatusSchema,
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

  it("projeta linha de listagem (código, frequência e status derivados)", () => {
    const row = {
      id: "p1",
      orgId: "org_a",
      number: 14,
      type: "vehicular",
      subtype: "Frota",
      title: "Plano",
      description: null,
      frequency: "biweekly",
      status: "draft",
      createdAt: new Date(),
      updatedAt: new Date(),
      itemCount: 3,
    } as InspectionPlan & { itemCount: number };
    expect(toPlanListItem(row)).toEqual({
      id: "p1",
      number: 14,
      code: "PI-0014",
      title: "Plano",
      type: "vehicular",
      typeLabel: "Veicular",
      subtype: "Frota",
      frequency: "biweekly",
      frequencyLabel: "Quinzenal",
      status: "draft",
      statusLabel: "Rascunho",
      itemCount: 3,
    });
  });
});

describe("nextPlanNumber / formatPlanCode", () => {
  it("sequência começa em 1 e incrementa; defensivo", () => {
    expect(nextPlanNumber(null)).toBe(1);
    expect(nextPlanNumber(13)).toBe(14);
    expect(nextPlanNumber(-2)).toBe(1);
    expect(nextPlanNumber(Number.NaN)).toBe(1);
  });
  it("formata como PI-0014", () => {
    expect(formatPlanCode(1)).toBe("PI-0001");
    expect(formatPlanCode(14)).toBe("PI-0014");
  });
});

describe("status e frequência do plano", () => {
  it("status aceita active/draft/inactive e rotula em pt-BR", () => {
    expect(planStatusSchema.parse("draft")).toBe("draft");
    expect(() => planStatusSchema.parse("bogus")).toThrow();
    expect(planStatusLabel("active")).toBe("Ativo");
    expect(planStatusLabel("inactive")).toBe("Inativo");
    expect(planStatusLabel(null)).toBe("—");
  });
  it("input aceita frequência biweekly e status opcional (default no repo)", () => {
    const parsed = inspectionPlanInputSchema.parse({
      type: "vehicular",
      title: "X",
      frequency: "biweekly",
    });
    expect(parsed.frequency).toBe("biweekly");
    expect(parsed.status).toBeUndefined();
    expect(() =>
      inspectionPlanInputSchema.parse({
        type: "vehicular",
        title: "X",
        frequency: "hourly",
      }),
    ).toThrow();
  });
});
