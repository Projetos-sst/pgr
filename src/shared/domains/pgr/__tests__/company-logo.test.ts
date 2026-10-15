import { MAX_LOGO_BYTES, validateLogoFile } from "@/shared/domains/pgr/company-logo";

const validFile = { name: "logo.png", size: 1024, type: "image/png" };

describe("validateLogoFile", () => {
  it("aceita PNG dentro do teto", () => {
    expect(validateLogoFile(validFile)).toEqual({ ok: true, extension: "png" });
  });

  it("aceita JPG dentro do teto", () => {
    expect(validateLogoFile({ ...validFile, type: "image/jpeg" })).toEqual({
      ok: true,
      extension: "jpg",
    });
  });

  it("rejeita arquivo ausente", () => {
    expect(validateLogoFile(null)).toMatchObject({ reason: "MISSING_FILE" });
    expect(validateLogoFile(undefined)).toMatchObject({ reason: "MISSING_FILE" });
  });

  it("rejeita arquivo vazio (size <= 0)", () => {
    expect(validateLogoFile({ ...validFile, size: 0 })).toMatchObject({
      reason: "EMPTY_FILE",
    });
    expect(validateLogoFile({ ...validFile, size: -1 })).toMatchObject({
      reason: "EMPTY_FILE",
    });
  });

  it("rejeita tipo não permitido (ex.: PDF)", () => {
    expect(validateLogoFile({ ...validFile, type: "application/pdf" })).toMatchObject({
      reason: "TYPE_NOT_ALLOWED",
    });
  });

  it("aceita exatamente no teto de tamanho (5 MB)", () => {
    expect(validateLogoFile({ ...validFile, size: MAX_LOGO_BYTES })).toEqual({
      ok: true,
      extension: "png",
    });
  });

  it("rejeita acima do teto de tamanho", () => {
    expect(validateLogoFile({ ...validFile, size: MAX_LOGO_BYTES + 1 })).toMatchObject({
      reason: "TOO_LARGE",
    });
  });
});
