import { epiRecordQuerySchema, returnedFilterFor } from "@/shared/domains/pgr/epi-record";
import { signatureStatusLabel } from "@/shared/domains/pgr/epi-deliveries";

describe("returnedFilterFor (status → filtro de returned_at)", () => {
  it("pendente ⇒ exige returned_at NULL", () => {
    expect(returnedFilterFor("pendente")).toBe(false);
  });

  it("devolvido ⇒ exige returned_at NOT NULL", () => {
    expect(returnedFilterFor("devolvido")).toBe(true);
  });

  it("todos ⇒ sem filtro", () => {
    expect(returnedFilterFor("todos")).toBeNull();
  });
});

describe("epiRecordQuerySchema", () => {
  it("default: status todos, sem período", () => {
    const parsed = epiRecordQuerySchema.parse({});
    expect(parsed.status).toBe("todos");
    expect(parsed.from).toBeUndefined();
    expect(parsed.to).toBeUndefined();
  });

  it("aceita período ISO e coage page/pageSize de string (query REST)", () => {
    const parsed = epiRecordQuerySchema.parse({
      status: "devolvido",
      from: "2026-01-01",
      to: "2026-06-30",
      page: "2",
      pageSize: "20",
    });
    expect(parsed).toMatchObject({
      status: "devolvido",
      from: "2026-01-01",
      to: "2026-06-30",
      page: 2,
      pageSize: 20,
    });
  });

  it("rejeita status desconhecido e data malformada", () => {
    expect(epiRecordQuerySchema.safeParse({ status: "ativos" }).success).toBe(false);
    expect(epiRecordQuerySchema.safeParse({ from: "01/06/2026" }).success).toBe(false);
    expect(epiRecordQuerySchema.safeParse({ page: "0" }).success).toBe(false);
  });
});

describe("signatureLabel na ficha", () => {
  it("reusa os rótulos pt-BR do status de assinatura", () => {
    expect(signatureStatusLabel("pending")).toBe("Pendente de assinatura");
    expect(signatureStatusLabel("signed_qr")).toBe("Assinada (QR Code)");
    expect(signatureStatusLabel("signed_link")).toBe("Assinada (link)");
    expect(signatureStatusLabel("signed_manual")).toBe("Assinada (manual)");
  });
});
