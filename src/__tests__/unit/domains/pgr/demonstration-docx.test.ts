/** @jest-environment node */
import PizZip from "pizzip";
import {
  markDemonstrationDocx,
  PGR_DEMONSTRATION_NOTICE,
} from "@/shared/domains/pgr/pgr-docx/demonstration";

it("marks body and all section headers/footers after rendering while preserving other archive entries", () => {
  const zip = new PizZip();
  zip.file(
    "word/document.xml",
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Conteúdo</w:t></w:r></w:p></w:body></w:document>',
  );
  for (const [part, root] of [
    ["header1", "hdr"],
    ["header2", "hdr"],
    ["footer1", "ftr"],
  ])
    zip.file(
      `word/${part}.xml`,
      `<w:${root} xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"></w:${root}>`,
    );
  zip.file("word/media/logo.png", Buffer.from("synthetic-logo"));
  const result = new PizZip(markDemonstrationDocx(zip.generate({ type: "nodebuffer" })));
  for (const part of ["document", "header1", "header2", "footer1"])
    expect(result.file(`word/${part}.xml`)!.asText()).toContain(PGR_DEMONSTRATION_NOTICE);
  expect(result.file("word/document.xml")!.asText()).toContain("Conteúdo");
  expect(result.file("word/media/logo.png")!.asNodeBuffer().toString()).toBe(
    "synthetic-logo",
  );
});
