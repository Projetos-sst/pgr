/**
 * @jest-environment node
 *
 * Guarda da ordem das migrations: o `migrate` do Drizzle pula sem erro a migration cujo `when`
 * não supera o da última aplicada. Lê o journal real e os arquivos pelo próprio leitor do
 * drizzle (`readMigrationFiles`), o mesmo usado pelo CD.
 */
import fs from "node:fs";
import path from "node:path";

import { readMigrationFiles } from "drizzle-orm/migrator";

import { outOfOrder, silentlySkipped } from "@/shared/db/migration-order";

const FOLDER = path.resolve("src/shared/db/migrations");
const journal: { entries: { idx: number; tag: string; when: number }[] } = JSON.parse(
  fs.readFileSync(path.join(FOLDER, "meta/_journal.json"), "utf8"),
);
const entries = journal.entries;

/**
 * Herança anterior a esta guarda. `0026_user_is_master` tem `when` escrito à mão
 * (1784600000000), maior que o da `0027_form_controls`: num banco parado exatamente na 0026,
 * a 0027 seria pulada. Homologação e produção já passaram da 0027 (produção está na 0052), então
 * a exceção vale só para esse caso histórico. Nenhuma migration nova pode entrar aqui.
 */
const LEGACY_OUT_OF_ORDER = ["0027_form_controls"];
/** Snapshot da 0019 não encadeia na 0018 (reconciliação do journal corrompido, fatia 023). */
const LEGACY_SNAPSHOT_BREAKS = ["0019"];
const FIRST_GUARDED = entries.findIndex((e) => e.tag === "0027_form_controls") + 1;

describe("journal das migrations", () => {
  it("idx contínuo, tag com o número do idx e SQL existente para cada entrada", () => {
    entries.forEach((entry, i) => {
      expect(entry.idx).toBe(i);
      expect(entry.tag.startsWith(`${String(i).padStart(4, "0")}_`)).toBe(true);
      expect(fs.existsSync(path.join(FOLDER, `${entry.tag}.sql`))).toBe(true);
    });
  });

  it("nenhum SQL fora do journal (seria ignorado pelo migrate)", () => {
    const tags = new Set(entries.map((e) => e.tag));
    const orphans = fs
      .readdirSync(FOLDER)
      .filter((f) => f.endsWith(".sql"))
      .map((f) => f.replace(/\.sql$/, ""))
      .filter((tag) => !tags.has(tag));
    expect(orphans).toEqual([]);
  });

  it("o leitor do drizzle lê todas as entradas com o mesmo when do journal", () => {
    const files = readMigrationFiles({ migrationsFolder: FOLDER });
    expect(files.map((f) => f.folderMillis)).toEqual(entries.map((e) => e.when));
  });

  it("todo when supera o de todas as anteriores (fora a herança documentada)", () => {
    expect(outOfOrder(entries).map((e) => e.tag)).toEqual(LEGACY_OUT_OF_ORDER);
  });

  it("de qualquer banco a partir da 0027, nenhuma migration pendente é pulada", () => {
    for (let applied = FIRST_GUARDED; applied < entries.length; applied += 1) {
      expect({ applied, skipped: silentlySkipped(entries, applied) }).toEqual({
        applied,
        skipped: [],
      });
    }
  });

  it("snapshots encadeados e o último corresponde à última migration", () => {
    const snaps = fs
      .readdirSync(path.join(FOLDER, "meta"))
      .filter((f) => /^\d{4}_snapshot\.json$/.test(f))
      .sort();
    const breaks: string[] = [];
    let previous: { id: string } | null = null;
    for (const file of snaps) {
      const snap = JSON.parse(fs.readFileSync(path.join(FOLDER, "meta", file), "utf8"));
      if (previous && snap.prevId !== previous.id) breaks.push(file.slice(0, 4));
      previous = snap;
    }
    expect(breaks).toEqual(LEGACY_SNAPSHOT_BREAKS);
    expect(snaps.at(-1)?.slice(0, 4)).toBe(entries.at(-1)?.tag.slice(0, 4));
  });
});

describe("cenários de renumeração", () => {
  const develop = [
    { tag: "0059_pgr_document_reviews", when: 1792608470913 },
    { tag: "0060_medical_professional_identity", when: 1793569620172 },
  ];

  it("migration comercial só renomeada para 0061 (when antigo) seria pulada", () => {
    const renamed = [
      ...develop,
      { tag: "0061_commercial_simulation", when: 1792675195470 },
    ];
    expect(outOfOrder(renamed).map((e) => e.tag)).toEqual(["0061_commercial_simulation"]);
    expect(silentlySkipped(renamed, 2).map((e) => e.tag)).toEqual([
      "0061_commercial_simulation",
    ]);
  });

  it("migration regenerada (when novo) é aplicada", () => {
    const regenerated = [
      ...develop,
      { tag: "0061_commercial_simulation", when: 1793600000000 },
    ];
    expect(outOfOrder(regenerated)).toEqual([]);
    expect(silentlySkipped(regenerated, 2)).toEqual([]);
  });

  it("banco vazio aplica tudo, mesmo com when fora de ordem", () => {
    expect(
      silentlySkipped(
        [
          { tag: "b", when: 2 },
          { tag: "a", when: 1 },
        ],
        0,
      ),
    ).toEqual([]);
  });
});
