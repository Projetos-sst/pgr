import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
const root = "src/shared/db/migrations/";
const json = (p) => JSON.parse(readFileSync(root + p, "utf8"));
const journal = json("meta/_journal.json").entries;
const candidates = journal.filter((x) => x.idx >= 60 && x.idx <= 63);
assert.equal(candidates.length, 4);
let previous = journal.find((x) => x.idx === 59);
let snapshot = json("meta/0059_snapshot.json");
for (const e of candidates) {
  assert.equal(e.idx, previous.idx + 1);
  assert.ok(e.when > previous.when);
  assert.ok(e.tag.startsWith(String(e.idx).padStart(4, "0") + "_commercial_"));
  assert.ok(existsSync(root + e.tag + ".sql"));
  const next = json("meta/" + String(e.idx).padStart(4, "0") + "_snapshot.json");
  assert.equal(next.prevId, snapshot.id);
  assert.equal(next.dialect, "postgresql");
  assert.notEqual(next.id, snapshot.id);
  assert.ok(
    !/\b(?:TRUNCATE|DROP TABLE)\b/i.test(readFileSync(root + e.tag + ".sql", "utf8")),
  );
  previous = e;
  snapshot = next;
}
const financial = Object.values(snapshot.tables).filter((t) =>
  t.name.startsWith("billing_"),
);
assert.equal(financial.length, 12);
for (const table of financial) {
  assert.equal(table.isRLSEnabled, true, table.name);
  assert.ok(Object.keys(table.policies).length > 0, table.name);
  assert.ok(
    Object.values(table.foreignKeys).some((f) => f.tableTo === "orgs"),
    table.name,
  );
}
console.log(
  "Candidate 0060–0063: contiguous journal/timestamps, snapshot ancestry, 12 tenant tables with RLS/policies/FKs. Reconcile with current develop before merging.",
);
