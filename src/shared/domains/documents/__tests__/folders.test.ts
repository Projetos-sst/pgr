import {
  buildBreadcrumb,
  createFolderSchema,
  renameFolderSchema,
  ROOT_BREADCRUMB,
  type FolderNode,
} from "@/shared/domains/documents/folders";

describe("buildBreadcrumb", () => {
  it("prefixa sempre com 'Início' mesmo sem cadeia (raiz)", () => {
    expect(buildBreadcrumb([])).toEqual([ROOT_BREADCRUMB]);
  });

  it("monta a trilha raiz→pasta atual preservando a ordem da cadeia", () => {
    const chain: FolderNode[] = [
      { id: "f1", name: "PGR", parentId: null },
      { id: "f2", name: "2026", parentId: "f1" },
    ];
    expect(buildBreadcrumb(chain)).toEqual([
      ROOT_BREADCRUMB,
      { id: "f1", name: "PGR" },
      { id: "f2", name: "2026" },
    ]);
  });
});

describe("createFolderSchema", () => {
  it("aceita nome obrigatório e parentId ausente (default null = raiz)", () => {
    const parsed = createFolderSchema.parse({ name: "Contratos" });
    expect(parsed).toEqual({ name: "Contratos", parentId: null });
  });

  it("trata parentId vazio como raiz (null)", () => {
    expect(
      createFolderSchema.parse({ name: "Contratos", parentId: "" }).parentId,
    ).toBeNull();
  });

  it("aceita parentId de pasta válida (UUID)", () => {
    const parentId = "11111111-1111-1111-1111-111111111111";
    expect(createFolderSchema.parse({ name: "Contratos", parentId }).parentId).toBe(
      parentId,
    );
  });

  it("rejeita parentId em formato inválido", () => {
    expect(() =>
      createFolderSchema.parse({ name: "Contratos", parentId: "not-a-uuid" }),
    ).toThrow();
  });

  it("exige nome não-vazio", () => {
    expect(() => createFolderSchema.parse({ name: "" })).toThrow();
    expect(() => createFolderSchema.parse({ name: "   " })).toThrow();
  });

  it("rejeita nome acima de 255 caracteres", () => {
    expect(() => createFolderSchema.parse({ name: "a".repeat(256) })).toThrow();
  });
});

describe("renameFolderSchema", () => {
  it("aceita nome válido", () => {
    expect(renameFolderSchema.parse({ name: "Novo nome" })).toEqual({
      name: "Novo nome",
    });
  });

  it("exige nome não-vazio", () => {
    expect(() => renameFolderSchema.parse({ name: "" })).toThrow();
  });
});
