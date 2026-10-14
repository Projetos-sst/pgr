/**
 * @jest-environment node
 */
import { fitInBox, readImageInfo } from "@/shared/integrations/docx/image";

describe("readImageInfo", () => {
  it("lê PNG pelo IHDR", () => {
    const png = Buffer.alloc(33);
    png.writeUInt32BE(0x89504e47, 0);
    png.writeUInt32BE(277, 16);
    png.writeUInt32BE(108, 20);
    expect(readImageInfo(png)).toEqual({ width: 277, height: 108, extension: "png" });
  });

  it("lê JPEG pelo marcador SOF0, pulando os segmentos anteriores", () => {
    const jpeg = Buffer.from(
      [
        "ffd8", // SOI
        "ffe0" + "0004" + "0000", // APP0 (tamanho 4)
        "ffc0" + "0011" + "08" + "0064" + "00c8" + "03", // SOF0: altura 100, largura 200
        "00".repeat(10),
      ].join(""),
      "hex",
    );
    expect(readImageInfo(jpeg)).toEqual({ width: 200, height: 100, extension: "jpeg" });
  });

  it("formato desconhecido → null", () => {
    expect(readImageInfo(Buffer.from("GIF89a"))).toBeNull();
  });
});

describe("fitInBox", () => {
  it("cabe pela largura ou pela altura, mantendo a proporção", () => {
    expect(fitInBox({ width: 400, height: 100 }, { cx: 2000, cy: 1000 })).toEqual({
      cx: 2000,
      cy: 500,
    });
    expect(fitInBox({ width: 100, height: 400 }, { cx: 2000, cy: 1000 })).toEqual({
      cx: 250,
      cy: 1000,
    });
  });
});
