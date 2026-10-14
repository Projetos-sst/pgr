import type PizZip from "pizzip";

/**
 * Troca de imagem num DOCX já renderizado, sem módulo pago do docxtemplater: o
 * template carrega uma imagem placeholder com `docPr name` conhecido; aqui achamos o
 * desenho por esse nome, gravamos a imagem nova como mídia própria e reajustamos a
 * extensão para caber PROPORCIONAL na caixa do placeholder (mesmo cálculo do
 * `insertInlineImage` com ajuste de caixa do Salesbud). Sem `server-only`: usado
 * também pelos scripts tsx de geração.
 */

export type ImageInfo = { width: number; height: number; extension: "png" | "jpeg" };

/** Lê largura/altura do cabeçalho PNG (IHDR) ou JPEG (SOFn). `null` = formato não suportado. */
export function readImageInfo(data: Buffer): ImageInfo | null {
  if (data.length > 24 && data.readUInt32BE(0) === 0x89504e47) {
    return {
      width: data.readUInt32BE(16),
      height: data.readUInt32BE(20),
      extension: "png",
    };
  }
  if (data.length > 4 && data[0] === 0xff && data[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < data.length) {
      if (data[offset] !== 0xff) return null;
      const marker = data[offset + 1];
      const length = data.readUInt16BE(offset + 2);
      const isSof =
        marker >= 0xc0 &&
        marker <= 0xcf &&
        marker !== 0xc4 &&
        marker !== 0xc8 &&
        marker !== 0xcc;
      if (isSof) {
        return {
          height: data.readUInt16BE(offset + 5),
          width: data.readUInt16BE(offset + 7),
          extension: "jpeg",
        };
      }
      offset += 2 + length;
    }
  }
  return null;
}

/** Cabe `image` dentro da caixa `box` mantendo a proporção (EMU inteiros). */
export function fitInBox(
  image: { width: number; height: number },
  box: { cx: number; cy: number },
) {
  const scale = Math.min(box.cx / image.width, box.cy / image.height);
  return { cx: Math.round(image.width * scale), cy: Math.round(image.height * scale) };
}

const XML_PARTS = /^word\/(document|header\d*|footer\d*)\.xml$/;

/**
 * Substitui TODAS as ocorrências da imagem cujo `wp:docPr` tem `name="<name>"` (o logo
 * aparece em mais de um cabeçalho). Retorna quantas ocorrências foram trocadas.
 */
export function replaceImageByName(zip: PizZip, name: string, data: Buffer): number {
  const info = readImageInfo(data);
  if (!info) return 0;
  const mediaPath = `media/${name}.${info.extension === "jpeg" ? "jpeg" : "png"}`;
  zip.file(`word/${mediaPath}`, data);
  ensureContentType(zip, info.extension);

  let replaced = 0;
  for (const partName of Object.keys(zip.files).filter((file) => XML_PARTS.test(file))) {
    const xml = zip.file(partName)?.asText();
    if (!xml || !xml.includes(`name="${name}"`)) continue;
    const relsName = partName.replace(/^word\//, "word/_rels/") + ".rels";
    let rels = zip.file(relsName)?.asText() ?? "";

    const updated = xml.replace(/<w:drawing>[\s\S]*?<\/w:drawing>/g, (drawing) => {
      if (!drawing.includes(`name="${name}"`)) return drawing;
      const embed = drawing.match(/r:embed="([^"]+)"/)?.[1];
      const extent = drawing.match(/<wp:extent cx="(\d+)" cy="(\d+)"\/>/);
      if (!embed || !extent) return drawing;
      rels = rels.replace(
        new RegExp(`(<Relationship[^>]*Id="${embed}"[^>]*Target=")[^"]+(")`),
        `$1${mediaPath}$2`,
      );
      const { cx, cy } = fitInBox(info, { cx: Number(extent[1]), cy: Number(extent[2]) });
      replaced += 1;
      return drawing
        .replace(/<wp:extent cx="\d+" cy="\d+"\/>/, `<wp:extent cx="${cx}" cy="${cy}"/>`)
        .replace(/<a:ext cx="\d+" cy="\d+"\/>/, `<a:ext cx="${cx}" cy="${cy}"/>`);
    });
    zip.file(partName, updated);
    if (rels) zip.file(relsName, rels);
  }
  return replaced;
}

function ensureContentType(zip: PizZip, extension: "png" | "jpeg") {
  const types = zip.file("[Content_Types].xml")?.asText();
  if (!types || types.includes(`Extension="${extension}"`)) return;
  zip.file(
    "[Content_Types].xml",
    types.replace(
      "</Types>",
      `<Default Extension="${extension}" ContentType="image/${extension}"/></Types>`,
    ),
  );
}
