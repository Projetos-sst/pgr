import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
const root = "src/shared/db/migrations/";
const read = (file) => JSON.parse(readFileSync(root + file, "utf8"));
const entries = read("meta/_journal.json").entries;
let previous = entries.find((entry) => entry.idx === 59);
let snapshot = read("meta/0059_snapshot.json");
const candidates = entries.filter((entry) => entry.idx >= 60 && entry.idx <= 68);
assert.equal(candidates.length, 9);
for (const entry of candidates) {
  assert.equal(entry.idx, previous.idx + 1);
  assert.ok(entry.when > previous.when);
  assert.ok(existsSync(root + entry.tag + ".sql"));
  const next = read(`meta/${String(entry.idx).padStart(4, "0")}_snapshot.json`);
  assert.equal(next.prevId, snapshot.id);
  assert.equal(next.dialect, "postgresql");
  assert.notEqual(next.id, snapshot.id);
  assert.ok(
    !/\b(?:TRUNCATE|DROP TABLE)\b/i.test(readFileSync(root + entry.tag + ".sql", "utf8")),
  );
  previous = entry;
  snapshot = next;
}
for (const name of ["pgr_document_approvals", "billing_trial_claims"]) {
  const table = snapshot.tables[`public.${name}`];
  assert.equal(table.isRLSEnabled, true);
  assert.ok(Object.keys(table.policies).length > 0);
  assert.ok(Object.keys(table.foreignKeys).length > 0);
}
assert.equal(
  snapshot.tables["public.pgr"].columns.technical_review_required.default,
  true,
);
assert.ok(
  snapshot.tables["public.pgr_review_samples"].policies.pgr_review_samples_actor_read,
);
assert.ok(
  snapshot.tables["public.pgr_review_decisions"].policies.pgr_review_decisions_actor_read,
);
console.log(
  "Candidate 0060–0068: journal/timestamps/snapshot ancestry, review/trial FKs and RLS, new-document default. SQL behavior is validated separately on isolated PostgreSQL.",
);
