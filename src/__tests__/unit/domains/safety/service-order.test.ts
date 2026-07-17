import {
  canTransitionServiceOrder,
  isServiceOrderEditable,
  isServiceOrderTerminal,
  MAX_ITEM_DESCRIPTION,
  MAX_ITEMS_PER_ORDER,
  serviceOrderCreateSchema,
  serviceOrderItemInputSchema,
  serviceOrderUpdateSchema,
  toServiceOrderListItem,
} from "@/shared/domains/safety/service-order";
import {
  computeDaysOpen,
  nextServiceOrderNumber,
} from "@/shared/domains/safety/service-order-number";

describe("nextServiceOrderNumber (US2)", () => {
  it("começa em 1 quando não há OS (null/undefined)", () => {
    expect(nextServiceOrderNumber(null)).toBe(1);
    expect(nextServiceOrderNumber(undefined)).toBe(1);
  });

  it("incrementa o máximo atual", () => {
    expect(nextServiceOrderNumber(0)).toBe(1);
    expect(nextServiceOrderNumber(7)).toBe(8);
  });

  it("é defensivo contra valores inválidos", () => {
    expect(nextServiceOrderNumber(-3)).toBe(1);
    expect(nextServiceOrderNumber(Number.NaN)).toBe(1);
  });
});

describe("computeDaysOpen (US2, fuso via `today`)", () => {
  it("usa closed_at quando existente", () => {
    expect(computeDaysOpen("2026-07-01", "2026-07-11", "2026-07-16")).toBe(10);
  });

  it("usa `today` enquanto aberta (closed_at null/vazio)", () => {
    expect(computeDaysOpen("2026-07-10", null, "2026-07-16")).toBe(6);
    expect(computeDaysOpen("2026-07-10", "", "2026-07-16")).toBe(6);
  });

  it("nunca é negativo (datas invertidas → 0)", () => {
    expect(computeDaysOpen("2026-07-20", null, "2026-07-16")).toBe(0);
    expect(computeDaysOpen("2026-07-20", "2026-07-10", "2026-07-16")).toBe(0);
  });

  it("data inválida → 0 (defensivo)", () => {
    expect(computeDaysOpen("not-a-date", null, "2026-07-16")).toBe(0);
    expect(computeDaysOpen("2026-07-10", null, "bad")).toBe(0);
  });
});

describe("estados editáveis/terminais (US2, FR-014)", () => {
  it("open/in_progress são editáveis; completed/cancelled são terminais", () => {
    expect(isServiceOrderEditable("open")).toBe(true);
    expect(isServiceOrderEditable("in_progress")).toBe(true);
    expect(isServiceOrderEditable("completed")).toBe(false);
    expect(isServiceOrderEditable("cancelled")).toBe(false);
    expect(isServiceOrderTerminal("completed")).toBe(true);
    expect(isServiceOrderTerminal("cancelled")).toBe(true);
    expect(isServiceOrderTerminal("open")).toBe(false);
  });

  it("transições válidas avançam; terminais não retrocedem", () => {
    expect(canTransitionServiceOrder("open", "in_progress")).toBe(true);
    expect(canTransitionServiceOrder("open", "completed")).toBe(true);
    expect(canTransitionServiceOrder("in_progress", "cancelled")).toBe(true);
    expect(canTransitionServiceOrder("open", "open")).toBe(true); // no-op
    expect(canTransitionServiceOrder("completed", "open")).toBe(false);
    expect(canTransitionServiceOrder("cancelled", "in_progress")).toBe(false);
  });
});

describe("serviceOrderItemInputSchema (US2, snapshot textual)", () => {
  it("aceita item mínimo (default manual/não-feito)", () => {
    const parsed = serviceOrderItemInputSchema.parse({ description: "Entregar capacete" });
    expect(parsed.sourceType).toBe("manual");
    expect(parsed.done).toBe(false);
  });

  it("rejeita descrição vazia e acima de 500 caracteres", () => {
    expect(() => serviceOrderItemInputSchema.parse({ description: "   " })).toThrow();
    expect(() =>
      serviceOrderItemInputSchema.parse({ description: "x".repeat(MAX_ITEM_DESCRIPTION + 1) }),
    ).toThrow();
    expect(
      serviceOrderItemInputSchema.parse({ description: "x".repeat(MAX_ITEM_DESCRIPTION) })
        .description.length,
    ).toBe(MAX_ITEM_DESCRIPTION);
  });

  it("rejeita source_type fora de manual|risk|epi", () => {
    expect(() =>
      serviceOrderItemInputSchema.parse({ description: "x", sourceType: "other" }),
    ).toThrow();
  });

  it("é strict (rejeita campo extra)", () => {
    expect(() =>
      serviceOrderItemInputSchema.parse({ description: "x", orgId: "org_a" }),
    ).toThrow();
  });
});

describe("serviceOrderCreateSchema (US2)", () => {
  const base = { title: "OS teste", openedAt: "2026-07-16" };

  it("aceita criação mínima (sem itens)", () => {
    const parsed = serviceOrderCreateSchema.parse(base);
    expect(parsed.items).toEqual([]);
    expect(parsed.title).toBe("OS teste");
  });

  it("rejeita `number` e `org_id` vindos do cliente (strict)", () => {
    expect(() => serviceOrderCreateSchema.parse({ ...base, number: 5 })).toThrow();
    expect(() => serviceOrderCreateSchema.parse({ ...base, orgId: "org_a" })).toThrow();
    expect(() => serviceOrderCreateSchema.parse({ ...base, status: "completed" })).toThrow();
  });

  it("exige título e data de abertura válida", () => {
    expect(() => serviceOrderCreateSchema.parse({ openedAt: "2026-07-16" })).toThrow();
    expect(() => serviceOrderCreateSchema.parse({ title: "x", openedAt: "16/07" })).toThrow();
  });

  it("limita a coleção de itens", () => {
    const items = Array.from({ length: MAX_ITEMS_PER_ORDER + 1 }, () => ({
      description: "item",
    }));
    expect(() => serviceOrderCreateSchema.parse({ ...base, items })).toThrow();
  });
});

describe("serviceOrderUpdateSchema (US2)", () => {
  it("exige status válido e é strict", () => {
    const ok = serviceOrderUpdateSchema.parse({
      title: "OS",
      openedAt: "2026-07-01",
      status: "in_progress",
      items: [{ description: "a" }],
    });
    expect(ok.status).toBe("in_progress");
    expect(() =>
      serviceOrderUpdateSchema.parse({
        title: "OS",
        openedAt: "2026-07-01",
        status: "bogus",
      }),
    ).toThrow();
  });
});

describe("toServiceOrderListItem (US2)", () => {
  it("expõe daysOpen derivado e statusLabel", () => {
    const item = toServiceOrderListItem(
      {
        id: "id-1",
        number: 3,
        title: "OS",
        status: "open",
        openedAt: "2026-07-10",
        dueDate: null,
        closedAt: null,
        employeeName: "Fulano",
        itemCount: 2,
      },
      "2026-07-16",
    );
    expect(item.daysOpen).toBe(6);
    expect(item.statusLabel).toBe("Aberta");
    expect(item.itemCount).toBe(2);
  });
});
