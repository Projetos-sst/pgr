import {
  SIGNATURE_TARGET_TYPES,
  getPayloadSchema,
  isSignatureTargetType,
  signatureTargetRegistry,
} from "@/shared/domains/signatures/contract";
import {
  serviceOrderSignaturePayloadSchema,
  type ServiceOrderSignaturePayload,
} from "@/shared/domains/signatures/targets/service-order";
import {
  buildServiceOrderDocumentTitle,
  deriveServiceOrderSignatureState,
  isServiceOrderSigned,
  SERVICE_ORDER_TARGET_TYPE,
  serviceOrderSignatureRequestSchema,
} from "@/shared/domains/safety/service-order-signature";

const VALID: ServiceOrderSignaturePayload = {
  documentTitle: "Ordem de Serviço nº 7 — Entrega de EPIs",
  serviceOrderNumber: 7,
  companyName: "A Ltda",
  employeeName: "Func A",
  issuedAt: "2026-07-10",
  items: [{ description: "Risco: Ruído contínuo" }],
};

const future = new Date(Date.now() + 60_000);
const past = new Date(Date.now() - 60_000);

describe("signatures/targets/service-order — payload público", () => {
  it("aceita o payload mínimo válido", () => {
    expect(serviceOrderSignaturePayloadSchema.safeParse(VALID).success).toBe(true);
  });

  it("expõe EXATAMENTE 6 campos", () => {
    const parsed = serviceOrderSignaturePayloadSchema.parse(VALID);
    expect(Object.keys(parsed).sort()).toEqual(
      [
        "companyName",
        "documentTitle",
        "employeeName",
        "issuedAt",
        "items",
        "serviceOrderNumber",
      ].sort(),
    );
  });

  it("é .strict(): rejeita qualquer campo extra (PII/ids internos/token)", () => {
    for (const extra of [
      { orgId: "org_a" },
      { serviceOrderId: "11111111-1111-1111-1111-111111111111" },
      { employeeId: "11111111-1111-1111-1111-111111111111" },
      { companyId: "11111111-1111-1111-1111-111111111111" },
      { cpf: "12345678901" },
      { token: "abc" },
      { tokenHash: "abc" },
    ]) {
      expect(
        serviceOrderSignaturePayloadSchema.safeParse({ ...VALID, ...extra }).success,
      ).toBe(false);
    }
  });

  it("item público não admite source_type/source_id nem outros extras", () => {
    const withSource = {
      ...VALID,
      items: [
        {
          description: "Risco: Ruído",
          sourceType: "risk",
          sourceId: "11111111-1111-1111-1111-111111111111",
        },
      ],
    };
    expect(serviceOrderSignaturePayloadSchema.safeParse(withSource).success).toBe(false);
  });

  it("items: aceita 100, rejeita 101 e rejeita lista vazia", () => {
    const item = { description: "x" };
    expect(
      serviceOrderSignaturePayloadSchema.safeParse({
        ...VALID,
        items: Array.from({ length: 100 }, () => item),
      }).success,
    ).toBe(true);
    expect(
      serviceOrderSignaturePayloadSchema.safeParse({
        ...VALID,
        items: Array.from({ length: 101 }, () => item),
      }).success,
    ).toBe(false);
    expect(
      serviceOrderSignaturePayloadSchema.safeParse({ ...VALID, items: [] }).success,
    ).toBe(false);
  });

  it("description: aceita 500, rejeita 501 e rejeita vazio", () => {
    const withDescription = (len: number) => ({
      ...VALID,
      items: [{ description: "a".repeat(len) }],
    });
    expect(
      serviceOrderSignaturePayloadSchema.safeParse(withDescription(500)).success,
    ).toBe(true);
    expect(
      serviceOrderSignaturePayloadSchema.safeParse(withDescription(501)).success,
    ).toBe(false);
    expect(
      serviceOrderSignaturePayloadSchema.safeParse({
        ...VALID,
        items: [{ description: "  " }],
      }).success,
    ).toBe(false);
  });

  it("rejeita número não-positivo e data fora de AAAA-MM-DD", () => {
    expect(
      serviceOrderSignaturePayloadSchema.safeParse({ ...VALID, serviceOrderNumber: 0 })
        .success,
    ).toBe(false);
    expect(
      serviceOrderSignaturePayloadSchema.safeParse({ ...VALID, issuedAt: "10/07/2026" })
        .success,
    ).toBe(false);
  });
});

describe("signatures/contract — registry exaustivo", () => {
  it("reconhece service_order como target", () => {
    expect(isSignatureTargetType(SERVICE_ORDER_TARGET_TYPE)).toBe(true);
    expect(SIGNATURE_TARGET_TYPES).toContain("service_order");
  });

  it("todos os targets continuam resolvendo um payloadSchema", () => {
    for (const type of SIGNATURE_TARGET_TYPES) {
      expect(signatureTargetRegistry[type]).toBeDefined();
      expect(getPayloadSchema(type)).toBeDefined();
    }
    expect(SIGNATURE_TARGET_TYPES).toEqual(
      expect.arrayContaining(["demo", "inspection", "pgr", "service_order"]),
    );
  });

  it("target desconhecido é rejeitado", () => {
    expect(isSignatureTargetType("service-order")).toBe(false);
    expect(isSignatureTargetType("nope")).toBe(false);
  });

  it("o schema do registry para service_order é o payload da OS", () => {
    expect(getPayloadSchema("service_order").safeParse(VALID).success).toBe(true);
    expect(
      getPayloadSchema("service_order").safeParse({ ...VALID, cpf: "1" }).success,
    ).toBe(false);
  });
});

describe("safety/service-order-signature — estado derivado e regras", () => {
  it("none quando não há solicitação", () => {
    expect(deriveServiceOrderSignatureState(null)).toBe("none");
  });

  it("pending enquanto não vence; expired depois do prazo", () => {
    expect(
      deriveServiceOrderSignatureState({ status: "pending", expiresAt: future }),
    ).toBe("pending");
    expect(deriveServiceOrderSignatureState({ status: "pending", expiresAt: past })).toBe(
      "expired",
    );
  });

  it("signed/cancelled nunca viram expired", () => {
    expect(deriveServiceOrderSignatureState({ status: "signed", expiresAt: past })).toBe(
      "signed",
    );
    expect(
      deriveServiceOrderSignatureState({ status: "cancelled", expiresAt: past }),
    ).toBe("cancelled");
  });

  it("isServiceOrderSigned só é verdadeiro em signed", () => {
    expect(isServiceOrderSigned("signed")).toBe(true);
    for (const state of ["none", "pending", "expired", "cancelled"] as const) {
      expect(isServiceOrderSigned(state)).toBe(false);
    }
  });

  it("compõe o título do documento no servidor", () => {
    expect(buildServiceOrderDocumentTitle({ number: 7, title: "Entrega de EPIs" })).toBe(
      "Ordem de Serviço nº 7 — Entrega de EPIs",
    );
  });

  it("input do pedido é strict: só ttlSeconds positivo", () => {
    expect(serviceOrderSignatureRequestSchema.safeParse({}).success).toBe(true);
    expect(
      serviceOrderSignatureRequestSchema.safeParse({ ttlSeconds: 3600 }).success,
    ).toBe(true);
    expect(serviceOrderSignatureRequestSchema.safeParse({ ttlSeconds: 0 }).success).toBe(
      false,
    );
    expect(
      serviceOrderSignatureRequestSchema.safeParse({ payload: { cpf: "1" } }).success,
    ).toBe(false);
  });
});
