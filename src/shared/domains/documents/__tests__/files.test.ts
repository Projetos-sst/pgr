import { MAX_FILE_BYTES, validateFile } from "@/shared/domains/documents/files";

const validFile = { name: "laudo.pdf", size: 1024, type: "application/pdf" };

describe("validateFile", () => {
  it("aceita PDF dentro do teto", () => {
    expect(validateFile(validFile)).toEqual({ ok: true, extension: "pdf" });
  });

  it.each([
    ["image/png", "png"],
    ["image/jpeg", "jpg"],
    ["application/msword", "doc"],
    ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "docx"],
    ["application/vnd.ms-excel", "xls"],
    ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "xlsx"],
  ])("aceita tipo permitido %s → extensão %s", (type, extension) => {
    expect(validateFile({ name: "arquivo", size: 10, type })).toEqual({
      ok: true,
      extension,
    });
  });

  it("rejeita arquivo ausente", () => {
    expect(validateFile(null)).toEqual({
      ok: false,
      reason: "MISSING_FILE",
      message: expect.any(String),
    });
    expect(validateFile(undefined)).toMatchObject({ reason: "MISSING_FILE" });
  });

  it("rejeita arquivo sem nome", () => {
    expect(validateFile({ ...validFile, name: "" })).toMatchObject({
      reason: "MISSING_NAME",
    });
    expect(validateFile({ ...validFile, name: "   " })).toMatchObject({
      reason: "MISSING_NAME",
    });
  });

  it("rejeita arquivo vazio (size <= 0)", () => {
    expect(validateFile({ ...validFile, size: 0 })).toMatchObject({
      reason: "EMPTY_FILE",
    });
    expect(validateFile({ ...validFile, size: -1 })).toMatchObject({
      reason: "EMPTY_FILE",
    });
  });

  it("rejeita tipo não permitido", () => {
    expect(validateFile({ ...validFile, type: "application/zip" })).toMatchObject({
      reason: "TYPE_NOT_ALLOWED",
    });
  });

  it("aceita exatamente no teto de tamanho (25 MB)", () => {
    expect(validateFile({ ...validFile, size: MAX_FILE_BYTES })).toEqual({
      ok: true,
      extension: "pdf",
    });
  });

  it("rejeita arquivo acima do teto de 25 MB", () => {
    expect(validateFile({ ...validFile, size: MAX_FILE_BYTES + 1 })).toMatchObject({
      reason: "TOO_LARGE",
    });
  });
});
