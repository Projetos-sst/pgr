import PizZip from "pizzip";

export const PGR_DEMONSTRATION_NOTICE = "DEMONSTRAÇÃO — TESTE GRÁTIS";

/** Applied after template rendering/overrides; not a claim of tamper resistance. */
export function markDemonstrationDocx(buffer: Buffer): Buffer {
  const zip = new PizZip(buffer);
  const paragraph = `<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:color w:val="B91C1C"/><w:sz w:val="24"/></w:rPr><w:t>${PGR_DEMONSTRATION_NOTICE}</w:t></w:r></w:p>`;
  const main = zip.file("word/document.xml")?.asText();
  if (!main) throw new Error("Documento DOCX inválido.");
  zip.file(
    "word/document.xml",
    main.replace(/<w:body\b[^>]*>/, (opening) => opening + paragraph),
  );
  for (const part of zip.file(/^word\/(header|footer)[^/]*\.xml$/)) {
    zip.file(
      part.name,
      part.asText().replace(/<w:(hdr|ftr)\b[^>]*>/, (opening) => opening + paragraph),
    );
  }
  return zip.generate({ type: "nodebuffer", compression: "DEFLATE" });
}
