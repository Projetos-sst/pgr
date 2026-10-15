import { toDocumentVersionHistory } from "@/shared/domains/documents/versions";

const TODAY = "2026-09-16";
const GROUP = "cccccccc-0000-0000-0000-00000000000a";

function row(version: number, overrides: Partial<{ validUntil: string | null }> = {}) {
  return {
    id: `cccccccc-0000-0000-0000-00000000000${version}`,
    documentGroupId: GROUP,
    name: `Laudo v${version}`,
    docType: "Laudo",
    version,
    sizeBytes: version * 100,
    folderId: null,
    validUntil: overrides.validUntil ?? null,
    createdAt: new Date(`2026-09-0${version}T12:00:00.000Z`),
  };
}

describe("toDocumentVersionHistory (#56)", () => {
  it("ordena da versão mais nova para a mais antiga, independentemente da entrada", () => {
    const history = toDocumentVersionHistory([row(1), row(3), row(2)], 3, TODAY);
    expect(history.map((v) => v.version)).toEqual([3, 2, 1]);
  });

  it("marca exatamente uma versão como vigente — a informada pelo repositório", () => {
    const history = toDocumentVersionHistory([row(1), row(2), row(3)], 3, TODAY);
    expect(history.filter((v) => v.isCurrent)).toHaveLength(1);
    expect(history.find((v) => v.isCurrent)?.version).toBe(3);
  });

  it("não assume 'maior versão': a regra de vigência vem de fora (#54 pode trocá-la)", () => {
    const history = toDocumentVersionHistory([row(1), row(2), row(3)], 2, TODAY);
    expect(history.find((v) => v.isCurrent)?.version).toBe(2);
    expect(history.find((v) => v.version === 3)?.isCurrent).toBe(false);
  });

  it("mantém o DTO da listagem: data ISO e validade derivada", () => {
    const [latest] = toDocumentVersionHistory(
      [row(1), row(2, { validUntil: "2026-09-01" })],
      2,
      TODAY,
    );
    expect(latest).toMatchObject({
      id: "cccccccc-0000-0000-0000-000000000002",
      documentGroupId: GROUP,
      name: "Laudo v2",
      docType: "Laudo",
      version: 2,
      sizeBytes: 200,
      folderId: null,
      validUntil: "2026-09-01",
      validityStatus: "expired",
      isCurrent: true,
    });
    expect(latest.createdAt).toBe("2026-09-02T12:00:00.000Z");
  });

  it("não altera o array de entrada", () => {
    const input = [row(1), row(2)];
    toDocumentVersionHistory(input, 2, TODAY);
    expect(input.map((r) => r.version)).toEqual([1, 2]);
  });
});
