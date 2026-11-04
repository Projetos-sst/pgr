/**
 * Entrega do ASO (NOB-165): entrada, comprovante pelos bytes, data da entrega e situação derivada
 * (registrada × comprovada × ciência confirmada; via física pendente; substituição). Fictício.
 */
import {
  asoDeliveryInputSchema,
  checkDeliveryEvidence,
  evidenceTypeOf,
  occurredAtProblem,
  summarizeDelivery,
  type AsoDeliveryEvent,
} from "@/shared/domains/medicine/aso-delivery";

const bytes = (...b: number[]) => Uint8Array.from(b);
const ascii = (s: string) => Uint8Array.from(s, (c) => c.charCodeAt(0));

describe("asoDeliveryInputSchema", () => {
  const base = {
    kind: "made_available",
    method: "physical_copy",
    occurredAt: "2026-10-22T10:30",
    evidenceReference: "Entregue em mãos",
  };
  it("converte a hora local (Brasília) e exige método e evidência na entrega", () => {
    expect(asoDeliveryInputSchema.parse(base).occurredAt.toISOString()).toBe(
      "2026-10-22T13:30:00.000Z",
    );
    expect(() => asoDeliveryInputSchema.parse({ ...base, method: undefined })).toThrow(
      /método/,
    );
    expect(() =>
      asoDeliveryInputSchema.parse({ ...base, evidenceReference: "" }),
    ).toThrow(/evidência/);
    expect(() =>
      asoDeliveryInputSchema.parse({ ...base, method: "digital_copy" }),
    ).toThrow(/canal/);
    expect(() =>
      asoDeliveryInputSchema.parse({ ...base, occurredAt: "2026-10-22" }),
    ).toThrow();
  });
  it("pedido de via física: sem método e sem comprovante", () => {
    const req = { kind: "physical_copy_requested", occurredAt: "2026-10-23T08:00" };
    expect(asoDeliveryInputSchema.parse(req).kind).toBe("physical_copy_requested");
    expect(() =>
      asoDeliveryInputSchema.parse({ ...req, method: "physical_copy" }),
    ).toThrow();
    expect(() =>
      asoDeliveryInputSchema.parse({ ...req, evidenceKind: "signed_receipt" }),
    ).toThrow();
  });
});

describe("comprovante", () => {
  it("reconhece PDF, JPEG e PNG pelos bytes; recusa o resto, vazio e acima de 10 MB", () => {
    expect(evidenceTypeOf(ascii("%PDF-1.7"))).toBe("application/pdf");
    expect(evidenceTypeOf(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg");
    expect(evidenceTypeOf(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe(
      "image/png",
    );
    expect(evidenceTypeOf(ascii("PK\u0003\u0004"))).toBeNull();
    expect(checkDeliveryEvidence(new Uint8Array())).toMatchObject({ ok: false });
    const big = new Uint8Array(10 * 1024 * 1024 + 1);
    big.set(ascii("%PDF-"));
    expect(checkDeliveryEvidence(big)).toMatchObject({ ok: false });
  });
});

describe("occurredAtProblem", () => {
  const now = new Date("2026-10-25T12:00:00Z");
  it("não futura (5 min de tolerância) e não anterior à assinatura (data local)", () => {
    expect(
      occurredAtProblem(new Date("2026-10-25T12:04:00Z"), "2026-10-21", now),
    ).toBeNull();
    expect(
      occurredAtProblem(new Date("2026-10-25T12:06:00Z"), "2026-10-21", now),
    ).toMatch(/futura/);
    // 21/10 às 01:00 em Brasília = 21/10 04:00Z: mesmo dia da assinatura, aceito.
    expect(
      occurredAtProblem(new Date("2026-10-21T04:00:00Z"), "2026-10-21", now),
    ).toBeNull();
    // 20/10 às 23:00 em Brasília = 21/10 02:00Z: dia anterior, recusado.
    expect(
      occurredAtProblem(new Date("2026-10-21T02:00:00Z"), "2026-10-21", now),
    ).toMatch(/anterior/);
  });
});

describe("summarizeDelivery", () => {
  const ev = (o: Partial<AsoDeliveryEvent>): AsoDeliveryEvent => ({
    id: Math.random().toString(36),
    signedDocumentId: "v2",
    kind: "made_available",
    method: "physical_copy",
    occurredAt: "2026-10-22T13:00:00.000Z",
    evidenceKind: null,
    hasEvidence: false,
    voidsId: null,
    ...o,
  });
  it("registrada, comprovada e ciência só com recibo assinado", () => {
    expect(summarizeDelivery([], "v2").state).toBe("none");
    expect(summarizeDelivery([ev({})], "v2").state).toBe("registered");
    expect(
      summarizeDelivery(
        [ev({ hasEvidence: true, evidenceKind: "channel_confirmation" })],
        "v2",
      ).state,
    ).toBe("proven");
    expect(
      summarizeDelivery([ev({ hasEvidence: true, evidenceKind: "signed_receipt" })], "v2")
        .state,
    ).toBe("acknowledged");
  });
  it("registro corrigido não conta; entrega da versão anterior pede nova entrega", () => {
    const d = ev({});
    expect(
      summarizeDelivery([d, ev({ kind: "voided", voidsId: d.id })], "v2").state,
    ).toBe("none");
    expect(summarizeDelivery([ev({ signedDocumentId: "v1" })], "v2")).toEqual({
      state: "none",
      physicalCopyPending: false,
      previousVersionDelivered: true,
    });
  });
  it("via física pendente até uma via física entregue depois do pedido", () => {
    const request = ev({
      kind: "physical_copy_requested",
      method: null,
      occurredAt: "2026-10-23T11:00:00.000Z",
    });
    expect(summarizeDelivery([request], "v2").physicalCopyPending).toBe(true);
    expect(
      summarizeDelivery(
        [request, ev({ method: "digital_copy", occurredAt: "2026-10-24T11:00:00.000Z" })],
        "v2",
      ).physicalCopyPending,
    ).toBe(true);
    expect(
      summarizeDelivery([request, ev({ occurredAt: "2026-10-24T11:00:00.000Z" })], "v2")
        .physicalCopyPending,
    ).toBe(false);
  });
});
