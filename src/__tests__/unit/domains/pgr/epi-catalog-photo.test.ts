import { validateEpiCatalogPhotoFile } from "@/shared/domains/pgr/epi-catalog-photo";

describe("validateEpiCatalogPhotoFile (issue #30)", () => {
  it("aceita PNG/JPG dentro do limite de 5 MB", () => {
    const png = validateEpiCatalogPhotoFile({ size: 1024, type: "image/png" });
    expect(png).toEqual({ ok: true, extension: "png" });

    const jpg = validateEpiCatalogPhotoFile({ size: 1024, type: "image/jpeg" });
    expect(jpg).toEqual({ ok: true, extension: "jpg" });
  });

  it("rejeita arquivo ausente/vazio", () => {
    expect(validateEpiCatalogPhotoFile(null).ok).toBe(false);
    expect(validateEpiCatalogPhotoFile({ size: 0, type: "image/png" }).ok).toBe(false);
  });

  it("rejeita tipo fora de PNG/JPG", () => {
    const result = validateEpiCatalogPhotoFile({ size: 1024, type: "application/pdf" });
    expect(result.ok).toBe(false);
  });

  it("rejeita acima de 5 MB", () => {
    const result = validateEpiCatalogPhotoFile({
      size: 5 * 1024 * 1024 + 1,
      type: "image/png",
    });
    expect(result.ok).toBe(false);
  });
});
