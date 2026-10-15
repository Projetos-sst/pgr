/**
 * @jest-environment node
 */
import { Document, Packer, Paragraph } from "docx";
import PizZip from "pizzip";

import { embedFonts, obfuscateFont } from "../../../../../scripts/pgr-docx/embed-fonts";

const regular = Buffer.from(Array.from({ length: 96 }, (_, i) => (i * 7 + 3) % 256));
const bold = Buffer.from(Array.from({ length: 80 }, (_, i) => (i * 13 + 5) % 256));
const GUID = "0A1B2C3D-4E5F-6071-8293-A4B5C6D7E8F9";
const FONT_REL =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships/font";

async function minimalDocx() {
  const doc = new Document({ sections: [{ children: [new Paragraph("Teste")] }] });
  return Packer.toBuffer(doc);
}

function part(zip: PizZip, name: string): string {
  return zip.file(name)?.asText() ?? "";
}

function embedded(fontTable: string, tag: "embedRegular" | "embedBold") {
  const match = fontTable.match(
    new RegExp(`<w:${tag} r:id="(rId\\d+)" w:fontKey="\\{([0-9A-F-]{36})\\}"/>`),
  );
  if (!match) throw new Error(`${tag} ausente no fontTable`);
  return { id: match[1], key: match[2] };
}

describe("obfuscateFont", () => {
  it("altera só os 32 primeiros bytes e é reversível com a mesma chave", () => {
    const once = obfuscateFont(regular, GUID);
    expect(once.subarray(32)).toEqual(regular.subarray(32));
    expect(once.subarray(0, 32)).not.toEqual(regular.subarray(0, 32));
    expect(obfuscateFont(once, GUID)).toEqual(regular);
  });

  it("recusa GUID que não tem 32 dígitos hexadecimais", () => {
    expect(() => obfuscateFont(regular, "1234")).toThrow("GUID inválido");
  });
});

describe("embedFonts", () => {
  it("grava regular e bold ofuscadas e as relações do fontTable", async () => {
    const out = await embedFonts(await minimalDocx(), [
      { name: "Manrope", regular, bold },
    ]);
    const zip = new PizZip(out);
    const fontTable = part(zip, "word/fontTable.xml");
    const rels = part(zip, "word/_rels/fontTable.xml.rels");
    const reg = embedded(fontTable, "embedRegular");
    const bol = embedded(fontTable, "embedBold");

    expect(fontTable).toContain('<w:font w:name="Manrope">');
    expect(fontTable).toContain("<w:charset");
    expect(fontTable).toContain('<w:family w:val="swiss"/>');
    expect(fontTable).toContain('<w:pitch w:val="variable"/>');
    expect(fontTable.indexOf("<w:embedRegular")).toBeLessThan(
      fontTable.indexOf("<w:embedBold"),
    );
    expect(rels).toContain(
      `Id="${reg.id}" Type="${FONT_REL}" Target="fonts/Manrope-regular.odttf"`,
    );
    expect(rels).toContain(
      `Id="${bol.id}" Type="${FONT_REL}" Target="fonts/Manrope-bold.odttf"`,
    );
    expect(zip.file("word/fonts/Manrope-regular.odttf")).not.toBeNull();
    expect(zip.file("word/fonts/Manrope-bold.odttf")).not.toBeNull();
  });

  it("desofuscar com a chave do fontTable devolve o TTF original", async () => {
    const zip = new PizZip(
      await embedFonts(await minimalDocx(), [{ name: "Manrope", regular, bold }]),
    );
    const reg = embedded(part(zip, "word/fontTable.xml"), "embedRegular");
    const odttf = zip.file("word/fonts/Manrope-regular.odttf")?.asNodeBuffer();
    if (!odttf) throw new Error("odttf regular ausente");
    const key = Buffer.from(reg.key.replace(/-/g, ""), "hex").reverse();
    const plain = Buffer.from(odttf);
    for (let i = 0; i < 32; i++) plain[i] ^= key[i % 16];
    expect(plain).toEqual(regular);
  });

  it("sem bold grava só a regular", async () => {
    const zip = new PizZip(
      await embedFonts(await minimalDocx(), [{ name: "Manrope", regular }]),
    );
    const fontTable = part(zip, "word/fontTable.xml");
    expect(fontTable).toContain("<w:embedRegular");
    expect(fontTable).not.toContain("<w:embedBold");
    expect(zip.file("word/fonts/Manrope-bold.odttf")).toBeNull();
  });

  it("registra o content type e o embedTrueTypeFonts sem duplicar a extensão", async () => {
    const zip = new PizZip(
      await embedFonts(await minimalDocx(), [{ name: "Manrope", regular, bold }]),
    );
    const types = part(zip, "[Content_Types].xml");
    const settings = part(zip, "word/settings.xml");

    expect(types).toContain(
      'ContentType="application/vnd.openxmlformats-officedocument.obfuscatedFont"',
    );
    expect(types.split('Extension="odttf"').length - 1).toBe(1);
    expect(settings).toContain("<w:embedTrueTypeFonts/>");
    expect(settings.indexOf("<w:displayBackgroundShape")).toBeLessThan(
      settings.indexOf("<w:embedTrueTypeFonts/>"),
    );
    expect(settings.indexOf("<w:embedTrueTypeFonts/>")).toBeLessThan(
      settings.indexOf("<w:compat"),
    );
  });

  it("cria o fontTable e registra no document.xml.rels quando faltam", async () => {
    const base = new PizZip(await minimalDocx());
    base.remove("word/fontTable.xml");
    base.remove("word/_rels/fontTable.xml.rels");
    const zip = new PizZip(
      await embedFonts(base.generate({ type: "nodebuffer" }), [
        { name: "Manrope", regular },
      ]),
    );

    const docRels = part(zip, "word/_rels/document.xml.rels");
    expect(part(zip, "word/fontTable.xml")).toContain('<w:font w:name="Manrope">');
    expect(part(zip, "word/_rels/fontTable.xml.rels")).toContain(
      "fonts/Manrope-regular.odttf",
    );
    expect(docRels.split("relationships/fontTable").length - 1).toBe(1);
  });

  it("recusa DOCX sem settings.xml", async () => {
    const base = new PizZip(await minimalDocx());
    base.remove("word/settings.xml");
    await expect(
      embedFonts(base.generate({ type: "nodebuffer" }), [{ name: "Manrope", regular }]),
    ).rejects.toThrow("word/settings.xml");
  });

  it("sem fontes devolve o próprio DOCX", async () => {
    const docx = await minimalDocx();
    expect(await embedFonts(docx, [])).toBe(docx);
  });
});
