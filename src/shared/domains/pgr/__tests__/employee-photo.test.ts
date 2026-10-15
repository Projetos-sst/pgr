import { MAX_PHOTO_BYTES, validatePhotoFile } from "@/shared/domains/pgr/employee-photo";

const validFile = { name: "foto.png", size: 1024, type: "image/png" };

describe("validatePhotoFile", () => {
  it("aceita PNG dentro do teto", () => {
    expect(validatePhotoFile(validFile)).toEqual({ ok: true, extension: "png" });
  });

  it("aceita JPG dentro do teto", () => {
    expect(validatePhotoFile({ ...validFile, type: "image/jpeg" })).toEqual({
      ok: true,
      extension: "jpg",
    });
  });

  it("rejeita arquivo ausente", () => {
    expect(validatePhotoFile(null)).toMatchObject({ reason: "MISSING_FILE" });
    expect(validatePhotoFile(undefined)).toMatchObject({ reason: "MISSING_FILE" });
  });

  it("rejeita arquivo vazio (size <= 0)", () => {
    expect(validatePhotoFile({ ...validFile, size: 0 })).toMatchObject({
      reason: "EMPTY_FILE",
    });
    expect(validatePhotoFile({ ...validFile, size: -1 })).toMatchObject({
      reason: "EMPTY_FILE",
    });
  });

  it("rejeita tipo não permitido (ex.: PDF)", () => {
    expect(validatePhotoFile({ ...validFile, type: "application/pdf" })).toMatchObject({
      reason: "TYPE_NOT_ALLOWED",
    });
  });

  it("aceita exatamente no teto de tamanho (5 MB)", () => {
    expect(validatePhotoFile({ ...validFile, size: MAX_PHOTO_BYTES })).toEqual({
      ok: true,
      extension: "png",
    });
  });

  it("rejeita acima do teto de tamanho", () => {
    expect(validatePhotoFile({ ...validFile, size: MAX_PHOTO_BYTES + 1 })).toMatchObject({
      reason: "TOO_LARGE",
    });
  });
});
