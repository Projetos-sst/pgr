import {
  DEFAULT_PDF_BATCH_FORMAT,
  LEGACY_PDF_BATCH_FORMAT,
  pdfBatchFormatSchema,
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

  it("payload legado sem format continua válido e vira pdf (path .pdf já pré-gravado)", () => {
    const parsed = pdfBatchPayloadSchema.parse({
      documentId: UUID,
      kind: "pgr",
      pgrId: UUID,
    });
    expect(parsed.format).toBe("pdf");
    expect(LEGACY_PDF_BATCH_FORMAT).toBe("pdf");
  });

  it("preserva o format explícito do job novo (docx)", () => {
    const parsed = pdfBatchPayloadSchema.parse({
      documentId: UUID,
      kind: "pgr",
      pgrId: UUID,
      format: "docx",
    });
    expect(parsed.format).toBe("docx");
  });

  it("rejeita format desconhecido", () => {
    expect(() =>
      pdfBatchPayloadSchema.parse({
        documentId: UUID,
        kind: "pgr",
        pgrId: UUID,
        format: "odt",
      }),
    ).toThrow();
  });
});

describe("pdfBatchFormatSchema", () => {
  it("aceita só docx e pdf; jobs novos saem em pdf por padrão", () => {
    expect(pdfBatchFormatSchema.options).toEqual(["docx", "pdf"]);
    expect(DEFAULT_PDF_BATCH_FORMAT).toBe("pdf");
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
