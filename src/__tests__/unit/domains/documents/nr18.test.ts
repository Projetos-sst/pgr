/**
 * Documentos complementares da NR-18 (#48): lista fechada de tipos, casamento com o
 * `doc_type` do GED, checklist informativo e a regra de unidade Obra/Canteiro.
 */
import {
  NR18_ATTACHED_LABEL,
  NR18_DOCUMENT_TYPES,
  NR18_DOC_TYPE_LABELS,
  NR18_MISSING_LABEL,
  buildNr18Checklist,
  isNr18ApplicableUnitType,
  matchNr18DocumentType,
  nr18DocumentType,
  nr18StatusLabel,
  nr18StatusTone,
  type Nr18ChecklistDocument,
} from "@/shared/domains/documents/nr18";

function doc(
  docType: string,
  overrides: Partial<Nr18ChecklistDocument> = {},
): Nr18ChecklistDocument {
  return {
    id: "d-1",
    documentGroupId: "g-1",
    name: "Arquivo",
    docType,
    version: 1,
    createdAt: "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("NR-18 — tipos de documento", () => {
  it("tem exatamente os quatro tipos do item 18.4.3", () => {
    expect(NR18_DOCUMENT_TYPES.map((t) => t.key)).toEqual([
      "living_area_project",
      "temporary_electrical_project",
      "collective_protection_project",
      "spiq_project",
    ]);
    expect(NR18_DOC_TYPE_LABELS).toEqual([
      "Projeto da área de vivência",
      "Projeto elétrico das instalações temporárias",
      "Projetos de proteção coletiva",
      "Projeto de SPIQ",
    ]);
  });

  it("só o SPIQ é condicional (a norma diz 'quando aplicável')", () => {
    const conditional = NR18_DOCUMENT_TYPES.filter((t) => t.conditional);
    expect(conditional.map((t) => t.key)).toEqual(["spiq_project"]);
  });

  it("resolve o tipo por chave e devolve null para chave desconhecida", () => {
    expect(nr18DocumentType("spiq_project")?.label).toBe("Projeto de SPIQ");
    expect(nr18DocumentType("inexistente")).toBeNull();
  });

  it("casa o doc_type ignorando caixa e espaços, e nada além disso", () => {
    expect(matchNr18DocumentType("Projeto de SPIQ")?.key).toBe("spiq_project");
    expect(matchNr18DocumentType("  projeto de spiq ")?.key).toBe("spiq_project");
    expect(matchNr18DocumentType("Projeto SPIQ")).toBeNull();
    expect(matchNr18DocumentType("Laudo de insalubridade")).toBeNull();
    expect(matchNr18DocumentType("")).toBeNull();
  });
});

describe("NR-18 — checklist", () => {
  it("sem documentos, os quatro requisitos ficam faltando", () => {
    const checklist = buildNr18Checklist([]);
    expect(checklist.totalCount).toBe(4);
    expect(checklist.attachedCount).toBe(0);
    expect(checklist.missingCount).toBe(4);
    expect(checklist.items.every((i) => !i.attached)).toBe(true);
    expect(checklist.items.every((i) => i.documents.length === 0)).toBe(true);
  });

  it("documento do tipo marca o requisito como anexado", () => {
    const checklist = buildNr18Checklist([
      doc("Projeto elétrico das instalações temporárias", {
        name: "Elétrico provisório",
      }),
    ]);
    const item = checklist.items.find((i) => i.key === "temporary_electrical_project");
    expect(item?.attached).toBe(true);
    expect(item?.documents[0].name).toBe("Elétrico provisório");
    expect(checklist.attachedCount).toBe(1);
    expect(checklist.missingCount).toBe(3);
  });

  it("nova versão do mesmo documento continua um requisito atendido, não dois anexos", () => {
    const checklist = buildNr18Checklist([
      doc("Projeto da área de vivência", {
        id: "d-2",
        documentGroupId: "g-9",
        version: 3,
        name: "Área de vivência",
      }),
    ]);
    const item = checklist.items.find((i) => i.key === "living_area_project");
    expect(item?.attached).toBe(true);
    expect(item?.documents).toHaveLength(1);
    expect(item?.documents[0].version).toBe(3);
  });

  it("documento de tipo fora da NR-18 não satisfaz requisito nenhum", () => {
    const checklist = buildNr18Checklist([doc("ART"), doc("Laudo de insalubridade")]);
    expect(checklist.attachedCount).toBe(0);
  });

  it("dois grupos do mesmo tipo aparecem como dois documentos do mesmo requisito", () => {
    const checklist = buildNr18Checklist([
      doc("Projetos de proteção coletiva", {
        id: "a",
        documentGroupId: "ga",
        name: "Guarda-corpo",
      }),
      doc("Projetos de proteção coletiva", {
        id: "b",
        documentGroupId: "gb",
        name: "Bandeja",
      }),
    ]);
    const item = checklist.items.find((i) => i.key === "collective_protection_project");
    expect(item?.documents.map((d) => d.name)).toEqual(["Bandeja", "Guarda-corpo"]);
    expect(checklist.attachedCount).toBe(1);
  });

  it("rótulo e tom: anexado verde, faltante âmbar, SPIQ ausente é 'quando aplicável'", () => {
    const checklist = buildNr18Checklist([doc("Projeto de SPIQ")]);
    const spiq = checklist.items.find((i) => i.key === "spiq_project")!;
    expect(nr18StatusLabel(spiq)).toBe(NR18_ATTACHED_LABEL);
    expect(nr18StatusTone(spiq)).toBe("green");

    const empty = buildNr18Checklist([]);
    const spiqEmpty = empty.items.find((i) => i.key === "spiq_project")!;
    const eletrico = empty.items.find((i) => i.key === "temporary_electrical_project")!;
    expect(nr18StatusLabel(spiqEmpty)).toBe(`${NR18_MISSING_LABEL} — quando aplicável`);
    expect(nr18StatusTone(spiqEmpty)).toBe("neutral");
    expect(nr18StatusLabel(eletrico)).toBe(NR18_MISSING_LABEL);
    expect(nr18StatusTone(eletrico)).toBe("amber");
  });

  it("a ordem dos itens é sempre a da norma", () => {
    const checklist = buildNr18Checklist([doc("Projeto de SPIQ")]);
    expect(checklist.items.map((i) => i.key)).toEqual(
      NR18_DOCUMENT_TYPES.map((t) => t.key),
    );
  });
});

describe("NR-18 — aplicabilidade por unidade", () => {
  it("só unidade do tipo Obra/Canteiro exibe o checklist", () => {
    expect(isNr18ApplicableUnitType("site")).toBe(true);
    expect(isNr18ApplicableUnitType("branch")).toBe(false);
    expect(isNr18ApplicableUnitType("workfront")).toBe(false);
    expect(isNr18ApplicableUnitType(null)).toBe(false);
    expect(isNr18ApplicableUnitType(undefined)).toBe(false);
  });
});
