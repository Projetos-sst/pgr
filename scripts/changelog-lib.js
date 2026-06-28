// Pure, side-effect-free helpers for the CHANGELOG generator.
// No git, no fs here — everything is a pure function so it can be unit-tested.
// The git/fs orchestration lives in scripts/generate-changelog.js.

const CONVENTIONAL_SUBJECT = /^(\w+)(?:\(([^)]+)\))?(!)?:\s*(.+)$/;
const CHANGELOG_TRAILER = /^Changelog:\s*(Added|Changed|Fixed)\s*$/im;
const BREAKING_BODY = /^BREAKING[ -]CHANGE:/im;
const SINCE_MARKER = /^<!--\s*changelog:since\s+([0-9a-f]+)\s*-->$/i;
const VERSION_TITLE = /^(\d+\.\d+\.\d+)(?:\s+-\s+(.+))?$/;

const UNRELEASED_TITLE = "Unreleased";
const CATEGORY_ORDER = ["Added", "Changed", "Fixed"];

// type -> category for the types that always belong in the changelog.
const TYPE_CATEGORY = { feat: "Added", fix: "Fixed", perf: "Changed" };
// types that only show up when the commit explicitly opts in via a `Changelog:` trailer.
const OPT_IN_TYPES = new Set(["docs", "refactor"]);

function parseSubject(subject) {
  const match = subject.match(CONVENTIONAL_SUBJECT);
  if (!match) return null;
  const [, type, scope, bang, description] = match;
  return {
    type,
    scope: scope || null,
    breaking: Boolean(bang),
    description: description.trim(),
  };
}

function optInCategory(body) {
  const match = (body || "").match(CHANGELOG_TRAILER);
  return match ? match[1] : null;
}

function isBreaking(parsed, body) {
  return parsed.breaking || BREAKING_BODY.test(body || "");
}

// Returns the changelog category for a commit, or null when it should be omitted.
function categoryFor(parsed, body) {
  if (isBreaking(parsed, body)) return "Changed";
  if (TYPE_CATEGORY[parsed.type]) return TYPE_CATEGORY[parsed.type];
  if (OPT_IN_TYPES.has(parsed.type)) return optInCategory(body);
  return null;
}

function formatBullet(parsed, body, ref) {
  const prefix = isBreaking(parsed, body) ? "**Breaking:** " : "";
  let line = `- ${prefix}${parsed.description}`;
  if (ref && ref.branch) line += ` — \`${ref.branch}\``;
  if (ref && ref.pr) line += ` (#${ref.pr})`;
  return line;
}

// commit: { subject, body, ref?: { branch?, pr? } } -> { category, bullet } | null
function commitToEntry(commit) {
  const parsed = parseSubject(commit.subject);
  if (!parsed) return null;
  const category = categoryFor(parsed, commit.body);
  if (!category) return null;
  return { category, bullet: formatBullet(parsed, commit.body, commit.ref) };
}

function groupEntries(entries) {
  const groups = { Added: [], Changed: [], Fixed: [] };
  for (const entry of entries) {
    if (!groups[entry.category].includes(entry.bullet)) {
      groups[entry.category].push(entry.bullet);
    }
  }
  return groups;
}

function renderSectionBody(entries) {
  const groups = groupEntries(entries);
  const blocks = [];
  for (const category of CATEGORY_ORDER) {
    if (groups[category].length === 0) continue;
    blocks.push(`### ${category}`, "", ...groups[category], "");
  }
  return blocks.join("\n").trimEnd();
}

function classifyTitle(title) {
  if (new RegExp(`^${UNRELEASED_TITLE}$`, "i").test(title.trim())) {
    return { kind: "unreleased" };
  }
  const match = title.trim().match(VERSION_TITLE);
  if (match) return { kind: "version", version: match[1], date: match[2] || null };
  return { kind: "other" };
}

// Parses a CHANGELOG.md string into { preamble, sections: [{ title, since, body }] }.
function parseChangelog(text) {
  const lines = (text || "").split("\n");
  const preamble = [];
  const sections = [];
  let current = null;

  for (const line of lines) {
    if (line.startsWith("## ")) {
      current = { title: line.slice(3).trim(), since: null, bodyLines: [] };
      sections.push(current);
      continue;
    }
    if (!current) {
      preamble.push(line);
      continue;
    }
    const marker = line.match(SINCE_MARKER);
    if (marker && current.bodyLines.length === 0) {
      current.since = marker[1];
      continue;
    }
    current.bodyLines.push(line);
  }

  return {
    preamble: preamble.join("\n").trim(),
    sections: sections.map((section) => ({
      title: section.title,
      since: section.since,
      body: section.bodyLines.join("\n").trim(),
    })),
  };
}

function renderSection(section) {
  const header = `## ${section.title}`;
  const marker = section.since ? `<!-- changelog:since ${section.since} -->` : null;
  const parts = [header];
  if (marker) parts.push(marker);
  parts.push("");
  if (section.body) parts.push(section.body, "");
  return parts.join("\n").trimEnd();
}

function renderChangelog(doc) {
  const head = doc.preamble ? `${doc.preamble}\n` : "# Changelog\n";
  const body = doc.sections.map(renderSection).join("\n\n");
  return `${head}\n${body}\n`.replace(/\n{3,}/g, "\n\n");
}

function findSection(doc, predicate) {
  return doc.sections.find((section) => predicate(classifyTitle(section.title), section));
}

// Promotes the open Unreleased section into a numbered version and opens a fresh,
// empty Unreleased on top. Idempotent: if the version already exists, returns the doc
// unchanged. `newSince` becomes the boundary of the next development cycle.
function promote(doc, version, date, newSince) {
  const alreadyPromoted = doc.sections.some(
    (section) => classifyTitle(section.title).version === version,
  );
  if (alreadyPromoted) return doc;

  const unreleasedIndex = doc.sections.findIndex(
    (section) => classifyTitle(section.title).kind === "unreleased",
  );
  if (unreleasedIndex === -1) {
    throw new Error("No Unreleased section to promote");
  }

  const unreleased = doc.sections[unreleasedIndex];
  const versionSection = {
    title: date ? `${version} - ${date}` : version,
    since: unreleased.since,
    body: unreleased.body,
  };
  const freshUnreleased = { title: UNRELEASED_TITLE, since: newSince, body: "" };

  const sections = [...doc.sections];
  sections.splice(unreleasedIndex, 1, freshUnreleased, versionSection);
  return { ...doc, sections };
}

module.exports = {
  UNRELEASED_TITLE,
  CATEGORY_ORDER,
  parseSubject,
  optInCategory,
  categoryFor,
  formatBullet,
  commitToEntry,
  groupEntries,
  renderSectionBody,
  classifyTitle,
  parseChangelog,
  renderSection,
  renderChangelog,
  findSection,
  promote,
};
