import { computeDocumentKpis, validityDateBounds } from "@/shared/domains/documents/kpis";
import { DOCUMENT_DUE_WINDOW_DAYS } from "@/shared/domains/documents/documents";
import { classifyDocumentValidity } from "@/shared/domains/documents/validity";

describe("computeDocumentKpis", () => {
  it("repassa as contagens já apuradas (assembla o shape)", () => {
    expect(
      computeDocumentKpis({ documents: 10, folders: 3, dueSoon: 2, expired: 1 }),
    ).toEqual({ documents: 10, folders: 3, dueSoon: 2, expired: 1 });
  });

  it("aceita todas as contagens zeradas", () => {
    expect(
      computeDocumentKpis({ documents: 0, folders: 0, dueSoon: 0, expired: 0 }),
    ).toEqual({ documents: 0, folders: 0, dueSoon: 0, expired: 0 });
  });
});

describe("validityDateBounds", () => {
  it("usa a janela padrão (DOCUMENT_DUE_WINDOW_DAYS = 30)", () => {
    const bounds = validityDateBounds("2026-01-01");
    expect(bounds.today).toBe("2026-01-01");
    expect(bounds.dueLimit).toBe("2026-01-31");
  });

  it("aceita janela customizada", () => {
    expect(validityDateBounds("2026-01-01", 7)).toEqual({
      today: "2026-01-01",
      dueLimit: "2026-01-08",
    });
  });

  it("atravessa mudança de mês corretamente", () => {
    expect(validityDateBounds("2026-01-20", 30).dueLimit).toBe("2026-02-19");
  });

  /**
   * As fronteiras aqui usadas para os KPIs (`dueLimit`) devem bater exatamente
   * com o que `classifyDocumentValidity` considera `due_soon`/`expired` — senão
   * o contador do dashboard diverge do filtro da listagem (mesma fonte, doc do
   * módulo). Prova a igualdade nas bordas inclusivas.
   */
  it("dueLimit é consistente com classifyDocumentValidity (fronteiras inclusivas)", () => {
    const today = "2026-03-10";
    const { dueLimit } = validityDateBounds(today, DOCUMENT_DUE_WINDOW_DAYS);
    const oneDayPastDueLimit = new Date(`${dueLimit}T00:00:00Z`);
    oneDayPastDueLimit.setUTCDate(oneDayPastDueLimit.getUTCDate() + 1);
    const oneDayPast = oneDayPastDueLimit.toISOString().slice(0, 10);

    expect(
      classifyDocumentValidity(dueLimit, {
        today,
        dueWindowDays: DOCUMENT_DUE_WINDOW_DAYS,
      }),
    ).toBe("due_soon");

    expect(
      classifyDocumentValidity(oneDayPast, {
        today,
        dueWindowDays: DOCUMENT_DUE_WINDOW_DAYS,
      }),
    ).toBe("ok");
  });
});
