import {
  MACHINE_ATTACHMENT_TYPES,
  documentMetadataSchema,
  downloadFileName,
  isMachineAttachmentType,
  moveDocumentSchema,
  parseRelatedEntityFilter,
  toDocumentListItem,
  updateDocumentSchema,
} from "@/shared/domains/documents/documents";

const FOLDER_ID = "11111111-1111-1111-1111-111111111111";
const PGR_ID = "22222222-2222-2222-2222-222222222222";

describe("documentMetadataSchema", () => {
  const base = { name: "Laudo técnico", docType: "Laudo" };

  it("aceita entrada mínima válida (sem pasta/validade/vínculo)", () => {
    const parsed = documentMetadataSchema.parse(base);
    expect(parsed.name).toBe("Laudo técnico");
    expect(parsed.docType).toBe("Laudo");
    expect(parsed.folderId).toBeNull();
    expect(parsed.validUntil).toBeUndefined();
    expect(parsed.relatedEntityType).toBeUndefined();
    expect(parsed.relatedEntityId).toBeNull();
  });

  it("exige nome e tipo", () => {
    expect(() => documentMetadataSchema.parse({ docType: "Laudo" })).toThrow();
    expect(() => documentMetadataSchema.parse({ name: "Laudo" })).toThrow();
  });

  it("trata folderId vazio como raiz (null)", () => {
    expect(documentMetadataSchema.parse({ ...base, folderId: "" }).folderId).toBeNull();
  });

  it("aceita folderId de pasta válida", () => {
    expect(documentMetadataSchema.parse({ ...base, folderId: FOLDER_ID }).folderId).toBe(
      FOLDER_ID,
    );
  });

  it("rejeita folderId em formato inválido", () => {
    expect(() =>
      documentMetadataSchema.parse({ ...base, folderId: "not-a-uuid" }),
    ).toThrow();
  });

  it("aceita vínculo polimórfico completo (tipo + id)", () => {
    const parsed = documentMetadataSchema.parse({
      ...base,
      relatedEntityType: "pgr",
      relatedEntityId: PGR_ID,
    });
    expect(parsed.relatedEntityType).toBe("pgr");
    expect(parsed.relatedEntityId).toBe(PGR_ID);
  });

  it("rejeita vínculo incompleto (tipo sem id) — refine completo-ou-vazio", () => {
    expect(() =>
      documentMetadataSchema.parse({ ...base, relatedEntityType: "pgr" }),
    ).toThrow();
  });

  it("rejeita vínculo incompleto (id sem tipo) — refine completo-ou-vazio", () => {
    expect(() =>
      documentMetadataSchema.parse({ ...base, relatedEntityId: PGR_ID }),
    ).toThrow();
  });

  it("aceita vínculo totalmente ausente (nem tipo nem id)", () => {
    expect(() => documentMetadataSchema.parse(base)).not.toThrow();
  });
});

describe("updateDocumentSchema (edição parcial)", () => {
  it("aceita objeto vazio (nada muda)", () => {
    expect(updateDocumentSchema.parse({})).toEqual({});
  });

  it("aceita name isolado", () => {
    expect(updateDocumentSchema.parse({ name: "Novo nome" })).toEqual({
      name: "Novo nome",
    });
  });

  it("mantém o refine completo-ou-vazio quando o vínculo é tocado", () => {
    expect(() => updateDocumentSchema.parse({ relatedEntityType: "pgr" })).toThrow();
    expect(() =>
      updateDocumentSchema.parse({ relatedEntityType: "pgr", relatedEntityId: PGR_ID }),
    ).not.toThrow();
  });

  it("permite limpar o vínculo explicitamente (ambos null)", () => {
    const parsed = updateDocumentSchema.parse({
      relatedEntityType: null,
      relatedEntityId: null,
    });
    expect(parsed.relatedEntityType).toBeNull();
    expect(parsed.relatedEntityId).toBeNull();
  });
});

describe("moveDocumentSchema", () => {
  it("aceita folderId de pasta válida", () => {
    expect(moveDocumentSchema.parse({ folderId: FOLDER_ID })).toEqual({
      folderId: FOLDER_ID,
    });
  });

  it("aceita folderId null (mover para a raiz)", () => {
    expect(moveDocumentSchema.parse({ folderId: null })).toEqual({ folderId: null });
  });

  it("trata folderId vazio como raiz (null)", () => {
    expect(moveDocumentSchema.parse({ folderId: "" })).toEqual({ folderId: null });
  });
});

describe("toDocumentListItem (integração com classifyDocumentValidity)", () => {
  const row = {
    id: "d1",
    documentGroupId: "g1",
    name: "Laudo",
    docType: "Laudo",
    version: 1,
    sizeBytes: 1024,
    folderId: null,
    validUntil: null as string | null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
  };

  it("sem validade → no_expiry", () => {
    expect(toDocumentListItem(row, "2026-06-01").validityStatus).toBe("no_expiry");
  });

  it("vencido → expired", () => {
    expect(
      toDocumentListItem({ ...row, validUntil: "2026-01-01" }, "2026-06-01")
        .validityStatus,
    ).toBe("expired");
  });

  it("a vencer dentro da janela de 30 dias → due_soon", () => {
    expect(
      toDocumentListItem({ ...row, validUntil: "2026-06-10" }, "2026-06-01")
        .validityStatus,
    ).toBe("due_soon");
  });

  it("vencimento distante → ok", () => {
    expect(
      toDocumentListItem({ ...row, validUntil: "2027-01-01" }, "2026-06-01")
        .validityStatus,
    ).toBe("ok");
  });

  it("normaliza createdAt Date para ISO string", () => {
    expect(toDocumentListItem(row, "2026-06-01").createdAt).toBe(
      "2026-01-01T00:00:00.000Z",
    );
  });

  it("aceita createdAt já como string", () => {
    expect(
      toDocumentListItem({ ...row, createdAt: "2026-01-01T00:00:00.000Z" }, "2026-06-01")
        .createdAt,
    ).toBe("2026-01-01T00:00:00.000Z");
  });
});

describe("downloadFileName (issue #35 — nome de exibição do download)", () => {
  it("acrescenta a extensão real do arquivo quando o nome não tem", () => {
    expect(downloadFileName("Laudo Ergonômico", "org_a/documentos/g1/v1-laudo.pdf")).toBe(
      "Laudo Ergonômico.pdf",
    );
  });

  it("não duplica a extensão quando o nome já termina com ela", () => {
    expect(downloadFileName("laudo.pdf", "org_a/documentos/g1/v1-laudo.pdf")).toBe(
      "laudo.pdf",
    );
  });

  it("é case-insensitive ao comparar a extensão já presente", () => {
    expect(downloadFileName("Laudo.PDF", "org_a/documentos/g1/v1-laudo.pdf")).toBe(
      "Laudo.PDF",
    );
  });

  it("sem extensão detectável no path, devolve o nome como está", () => {
    expect(downloadFileName("Laudo", "org_a/documentos/g1/v1-semextensao")).toBe("Laudo");
  });
});

describe("parseRelatedEntityFilter (filtro de listagem por vínculo)", () => {
  it("aceita o par completo e bem formado", () => {
    expect(parseRelatedEntityFilter("pgr", PGR_ID)).toEqual({
      relatedEntityType: "pgr",
      relatedEntityId: PGR_ID,
    });
  });

  it("ignora o par incompleto (espelha o CHECK completo-ou-vazio)", () => {
    expect(parseRelatedEntityFilter("pgr", null)).toEqual({});
    expect(parseRelatedEntityFilter(null, PGR_ID)).toEqual({});
  });

  it("ignora tipo fora do conjunto fechado", () => {
    expect(parseRelatedEntityFilter("employee", PGR_ID)).toEqual({});
  });

  it("ignora id que não é UUID — evitaria 22P02 (500) na coluna uuid", () => {
    expect(parseRelatedEntityFilter("pgr", "abc")).toEqual({});
    expect(parseRelatedEntityFilter("pgr", "'; drop table documents; --")).toEqual({});
  });
});

describe("anexos de máquina (SEG-22)", () => {
  it("aceita o vínculo com máquina e reconhece só os tipos confirmados", () => {
    const parsed = documentMetadataSchema.parse({
      name: "Manual da betoneira",
      docType: "Manual",
      relatedEntityType: "machine_installation",
      relatedEntityId: PGR_ID,
    });
    expect(parsed.relatedEntityType).toBe("machine_installation");
    expect(MACHINE_ATTACHMENT_TYPES).toHaveLength(9);
    expect(MACHINE_ATTACHMENT_TYPES.every(isMachineAttachmentType)).toBe(true);
    expect(isMachineAttachmentType("Contrato")).toBe(false);
    expect(isMachineAttachmentType("manual")).toBe(false);
  });
});
