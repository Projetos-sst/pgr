/**
 * Integração de pastas do GED (US4, fatia 024) contra Postgres efêmero. Cobre
 * criar/renomear, unicidade de irmã (incl. raiz) → DUPLICATE (409), pai
 * inválido/cross-tenant → FK_NOT_FOUND (422), e 404 cross-tenant no renome.
 */
import type postgres from "postgres";

jest.mock("@/shared/db/env", () => ({
  getDatabaseUrl: () => process.env.INTEGRATION_APP_RUNTIME_URL,
}));

import {
  createFolder,
  listFolderTree,
  renameFolder,
} from "@/shared/db/repositories/folders";
import { ReferenceNotFoundError } from "@/shared/errors/reference-not-found-error";

import { adminClient, applyMigrations } from "../_helpers/db";
import { seedPgrBase } from "../_helpers/pgr-seed";

const APP_RUNTIME_URL = process.env.INTEGRATION_APP_RUNTIME_URL;
const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!APP_RUNTIME_URL && !!ADMIN_URL;

(shouldRun ? describe : describe.skip)("GED — pastas (US4)", () => {
  let admin: ReturnType<typeof postgres>;

  beforeAll(async () => {
    admin = adminClient();
    await applyMigrations(admin);
  });

  afterAll(async () => {
    await admin.end();
  });

  beforeEach(async () => {
    await seedPgrBase(admin);
  });

  it("cria pasta na raiz e lista na árvore", async () => {
    const folder = await createFolder("org_a", { name: "Contratos", parentId: null });
    expect(folder.name).toBe("Contratos");

    const tree = await listFolderTree("org_a", null);
    expect(tree.folders.some((f) => f.id === folder.id)).toBe(true);
  });

  it("cria subpasta e o breadcrumb reflete a cadeia raiz→atual", async () => {
    const parent = await createFolder("org_a", { name: "PGR", parentId: null });
    const child = await createFolder("org_a", { name: "2026", parentId: parent.id });

    const tree = await listFolderTree("org_a", child.id);
    expect(tree.breadcrumb.map((b) => b.name)).toEqual(["Início", "PGR", "2026"]);
  });

  it("renomeia pasta", async () => {
    const folder = await createFolder("org_a", { name: "Antigo", parentId: null });
    const renamed = await renameFolder("org_a", folder.id, { name: "Novo nome" });
    expect(renamed?.name).toBe("Novo nome");
  });

  it("nome duplicado entre irmãs na RAIZ → rejeitado (DUPLICATE)", async () => {
    await createFolder("org_a", { name: "Contratos", parentId: null });
    await expect(
      createFolder("org_a", { name: "Contratos", parentId: null }),
    ).rejects.toBeDefined();
  });

  it("nome duplicado entre irmãs sob o MESMO pai → rejeitado; sob pais diferentes é aceito", async () => {
    const parentA = await createFolder("org_a", { name: "PGR", parentId: null });
    const parentB = await createFolder("org_a", { name: "OS", parentId: null });
    await createFolder("org_a", { name: "2026", parentId: parentA.id });

    await expect(
      createFolder("org_a", { name: "2026", parentId: parentA.id }),
    ).rejects.toBeDefined();

    // mesmo nome sob um pai DIFERENTE é aceito.
    const underB = await createFolder("org_a", { name: "2026", parentId: parentB.id });
    expect(underB.name).toBe("2026");
  });

  it("mesmo nome de pasta é aceito em escritórios distintos (sem colisão cross-tenant)", async () => {
    await createFolder("org_a", { name: "Contratos", parentId: null });
    const other = await createFolder("org_b", { name: "Contratos", parentId: null });
    expect(other.name).toBe("Contratos");
  });

  it("pai inválido/de outro tenant → FK_NOT_FOUND", async () => {
    const folderB = await createFolder("org_b", { name: "Pasta B", parentId: null });
    await expect(
      createFolder("org_a", { name: "Filha", parentId: folderB.id }),
    ).rejects.toBeInstanceOf(ReferenceNotFoundError);
  });

  it("renome de pasta de outro tenant → 404 (null, nunca vaza)", async () => {
    const folderB = await createFolder("org_b", { name: "Pasta B", parentId: null });
    const result = await renameFolder("org_a", folderB.id, { name: "Hackeado" });
    expect(result).toBeNull();

    // a pasta original permanece intacta em org_b.
    const treeB = await listFolderTree("org_b", null);
    expect(treeB.folders.find((f) => f.id === folderB.id)?.name).toBe("Pasta B");
  });
});
