import {
  pdfBatchPayloadSchema,
  enqueuePgrPdfBatchSchema,
} from "@/shared/domains/documents/pdf-batch";

const UUID = "11111111-1111-1111-1111-111111111111";

describe("pdfBatchPayloadSchema", () => {
  it("aceita payload válido", () => {
    const parsed = pdfBatchPayloadSchema.parse({
      documentId: UUID,
      kind: "pgr",
      pgrId: UUID,
    });
    expect(parsed.kind).toBe("pgr");
  });

  it("rejeita kind desconhecido", () => {
    expect(() =>
      pdfBatchPayloadSchema.parse({ documentId: UUID, kind: "os", pgrId: UUID }),
    ).toThrow();
  });

  it("rejeita uuid inválido", () => {
    expect(() =>
      pdfBatchPayloadSchema.parse({ documentId: "x", kind: "pgr", pgrId: UUID }),
    ).toThrow();
  });
});

describe("enqueuePgrPdfBatchSchema", () => {
  it("aceita lista não-vazia de uuids", () => {
    expect(enqueuePgrPdfBatchSchema.parse([UUID])).toEqual([UUID]);
  });

  it("rejeita lista vazia", () => {
    expect(() => enqueuePgrPdfBatchSchema.parse([])).toThrow();
  });

  it("rejeita uuid inválido na lista", () => {
    expect(() => enqueuePgrPdfBatchSchema.parse([UUID, "nope"])).toThrow();
  });
});
