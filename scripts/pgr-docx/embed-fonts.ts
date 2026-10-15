import { randomUUID } from "node:crypto";

import PizZip from "pizzip";

export type EmbeddedFont = {
  name: string;
  regular: Buffer;
  bold?: Buffer;
};

const W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const R_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const PACKAGE_RELS_NS = "http://schemas.openxmlformats.org/package/2006/relationships";
const REL_FONT = `${R_NS}/font`;
const REL_FONT_TABLE = `${R_NS}/fontTable`;
const CT_FONT = "application/vnd.openxmlformats-officedocument.obfuscatedFont";
const CT_FONT_TABLE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.fontTable+xml";
const CONTENT_TYPES = "[Content_Types].xml";
const SETTINGS = "word/settings.xml";
const FONT_TABLE = "word/fontTable.xml";
const FONT_TABLE_RELS = "word/_rels/fontTable.xml.rels";
const DOCUMENT_RELS = "word/_rels/document.xml.rels";
const EMBED_FLAG = "<w:embedTrueTypeFonts/>";

export function obfuscateFont(font: Buffer, guid: string): Buffer {
  const key = Buffer.from(guid.replace(/[{}-]/g, ""), "hex").reverse();
  if (key.length !== 16) throw new Error(`GUID inválido para ofuscar fonte: ${guid}`);
  const out = Buffer.from(font);
  for (let i = 0; i < Math.min(32, out.length); i++) out[i] ^= key[i % 16];
  return out;
}

export async function embedFonts(docx: Buffer, fonts: EmbeddedFont[]): Promise<Buffer> {
  if (fonts.length === 0) return docx;
  const zip = new PizZip(docx);
  ensureFontTable(zip);
  const settings = readPart(zip, SETTINGS);
  if (settings === undefined) {
    throw new Error("word/settings.xml ausente: o DOCX não foi gerado pela lib docx");
  }

  let fontTable = readPart(zip, FONT_TABLE) ?? "";
  let rels = readPart(zip, FONT_TABLE_RELS) ?? emptyRelationships();
  for (const font of fonts) {
    const faces = [
      { tag: "w:embedRegular", weight: "regular", data: font.regular },
      ...(font.bold ? [{ tag: "w:embedBold", weight: "bold", data: font.bold }] : []),
    ];
    const embeds = faces.map(({ tag, weight, data }) => {
      const guid = randomUUID().toUpperCase();
      const id = nextRelationshipId(rels);
      const target = `fonts/${font.name.replace(/\s+/g, "")}-${weight}.odttf`;
      zip.file(`word/${target}`, obfuscateFont(data, guid));
      rels = appendChild(
        rels,
        "Relationships",
        `<Relationship Id="${id}" Type="${REL_FONT}" Target="${target}"/>`,
      );
      return `<${tag} r:id="${id}" w:fontKey="{${guid}}"/>`;
    });
    fontTable = appendChild(
      fontTable,
      "w:fonts",
      `<w:font w:name="${font.name}"><w:charset w:val="00"/><w:family w:val="swiss"/><w:pitch w:val="variable"/>${embeds.join("")}</w:font>`,
    );
  }

  zip.file(FONT_TABLE, fontTable);
  zip.file(FONT_TABLE_RELS, rels);
  ensureContentType(
    zip,
    'Extension="odttf"',
    `<Default Extension="odttf" ContentType="${CT_FONT}"/>`,
  );
  ensureContentType(
    zip,
    'PartName="/word/fontTable.xml"',
    `<Override PartName="/word/fontTable.xml" ContentType="${CT_FONT_TABLE}"/>`,
  );
  zip.file(SETTINGS, withEmbedFlag(settings));
  return zip.generate({ type: "nodebuffer", compression: "DEFLATE" });
}

function readPart(zip: PizZip, name: string): string | undefined {
  return zip.file(name)?.asText();
}

function emptyRelationships() {
  return `<Relationships xmlns="${PACKAGE_RELS_NS}"></Relationships>`;
}

function ensureFontTable(zip: PizZip) {
  if (zip.file(FONT_TABLE)) return;
  zip.file(
    FONT_TABLE,
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:fonts xmlns:w="${W_NS}" xmlns:r="${R_NS}"></w:fonts>`,
  );
  const rels = readPart(zip, DOCUMENT_RELS) ?? emptyRelationships();
  if (rels.includes(REL_FONT_TABLE)) return;
  zip.file(
    DOCUMENT_RELS,
    appendChild(
      rels,
      "Relationships",
      `<Relationship Id="${nextRelationshipId(rels)}" Type="${REL_FONT_TABLE}" Target="fontTable.xml"/>`,
    ),
  );
}

function ensureContentType(zip: PizZip, marker: string, entry: string) {
  const types = readPart(zip, CONTENT_TYPES) ?? "";
  if (types.includes(marker)) return;
  zip.file(
    CONTENT_TYPES,
    types.replace("</Types>", () => `${entry}</Types>`),
  );
}

function withEmbedFlag(settings: string) {
  if (settings.includes("<w:embedTrueTypeFonts")) return settings;
  const background = /<w:displayBackgroundShape\b[^>]*\/>/;
  if (background.test(settings)) {
    return settings.replace(background, (tag) => `${tag}${EMBED_FLAG}`);
  }
  return settings.replace(
    /<w:(?:defaultTabStop|compat)\b|<\/w:settings>/,
    (tag) => `${EMBED_FLAG}${tag}`,
  );
}

function appendChild(xml: string, root: string, child: string) {
  const selfClosing = new RegExp(`<${root}((?:\\s[^>]*)?)\\/>`);
  if (selfClosing.test(xml)) {
    return xml.replace(
      selfClosing,
      (_, attrs: string) => `<${root}${attrs}>${child}</${root}>`,
    );
  }
  return xml.replace(`</${root}>`, () => `${child}</${root}>`);
}

function nextRelationshipId(rels: string) {
  const ids = [...rels.matchAll(/Id="rId(\d+)"/g)].map((match) => Number(match[1]));
  return `rId${Math.max(0, ...ids) + 1}`;
}
