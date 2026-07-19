import {
  classifyDocumentValidity,
  documentRelatedEntityTypeSchema,
} from "@/shared/domains/documents/validity";

const TODAY = "2026-07-08";
const WINDOW_30 = { today: TODAY, dueWindowDays: 30 };

describe("classifyDocumentValidity", () => {
  it("valid_until null → no_expiry (fora da classificação de vencimento)", () => {
    expect(classifyDocumentValidity(null, WINDOW_30)).toBe("no_expiry");
  });

  it("valid_until < hoje → expired", () => {
    expect(classifyDocumentValidity("2026-07-07", WINDOW_30)).toBe("expired");
    expect(classifyDocumentValidity("2020-01-01", WINDOW_30)).toBe("expired");
  });

  it("fronteira: vence HOJE → ainda não vencido (inclusivo) → due_soon", () => {
    expect(classifyDocumentValidity(TODAY, WINDOW_30)).toBe("due_soon");
  });

  it("dentro da janela → due_soon", () => {
    expect(classifyDocumentValidity("2026-07-20", WINDOW_30)).toBe("due_soon");
  });

  it("fronteira: vence exatamente em hoje+30 → due_soon (janela inclusiva)", () => {
    expect(classifyDocumentValidity("2026-08-07", WINDOW_30)).toBe("due_soon");
  });

  it("um dia além da janela de 30 → ok", () => {
    expect(classifyDocumentValidity("2026-08-08", WINDOW_30)).toBe("ok");
  });

  it("janela de 60/90 muda o corte (fronteira inclusiva por janela)", () => {
    const at90 = "2026-10-06"; // hoje + 90
    expect(classifyDocumentValidity(at90, { today: TODAY, dueWindowDays: 60 })).toBe(
      "ok",
    );
    expect(classifyDocumentValidity(at90, { today: TODAY, dueWindowDays: 90 })).toBe(
      "due_soon",
    );
  });

  it("virada de mês/ano no cálculo da janela (sem drift de fuso)", () => {
    const endOfYear = { today: "2026-12-20", dueWindowDays: 30 };
    expect(classifyDocumentValidity("2027-01-19", endOfYear)).toBe("due_soon");
    expect(classifyDocumentValidity("2027-01-20", endOfYear)).toBe("ok");
  });
});

describe("documentRelatedEntityTypeSchema (conjunto fechado — FR-005)", () => {
  it("aceita 'pgr'", () => {
    expect(documentRelatedEntityTypeSchema.parse("pgr")).toBe("pgr");
  });

  it("rejeita tipo desconhecido", () => {
    expect(documentRelatedEntityTypeSchema.safeParse("os").success).toBe(false);
    expect(documentRelatedEntityTypeSchema.safeParse("").success).toBe(false);
  });
});
