#!/usr/bin/env node
// Orchestrates CHANGELOG.md generation around the project's Git Flow.
//
//   node scripts/generate-changelog.js            regenerate the open section for the
//                                                 current branch (develop -> Unreleased,
//                                                 release/x.y.z -> [x.y.z])
//   node scripts/generate-changelog.js promote x.y.z
//                                                 promote Unreleased into [x.y.z] and open
//                                                 a fresh empty Unreleased (run when a
//                                                 release branch is created)
//
// The file is rebuilt from Git history each run, so it never duplicates entries.
// See docs/changelog-funcionamento.md for the product-level behavior.
const { execFileSync } = require("node:child_process");
const { readFileSync, writeFileSync, existsSync } = require("node:fs");
const path = require("node:path");

const lib = require("./changelog-lib");

const CHANGELOG_PATH = path.resolve(process.cwd(), "CHANGELOG.md");
const PREAMBLE =
  "# Changelog\n\n" +
  "Gerado automaticamente a cada merge para `develop`/`release/*`. " +
  "Não edite à mão — veja `docs/changelog-funcionamento.md`.";

const FIELD = "\x1f";
const RECORD = "\x1e";
const MERGE_PR_SUBJECT = /^Merge pull request #(\d+) from \S+?\/(.+)$/;
const MERGE_BRANCH_SUBJECT = /^Merge branch '([^']+)'/;
const SQUASH_PR_SUBJECT = /\(#(\d+)\)\s*$/;
const CHANGELOG_BOT_SUBJECT = /^docs\(changelog\)/;

function git(args) {
  return execFileSync("git", args, {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  }).trim();
}

function gitOrNull(args) {
  try {
    return git(args);
  } catch {
    return null;
  }
}

function currentBranch() {
  return process.env.GITHUB_REF_NAME || git(["rev-parse", "--abbrev-ref", "HEAD"]);
}

function headDate() {
  return git(["show", "-s", "--format=%cs", "HEAD"]);
}

// Boundary used the first time the changelog is built (before any release exists):
// latest semver tag -> origin/main -> main -> root commit.
function resolveInitialSince() {
  const latestTag = gitOrNull(["tag", "--list", "v*.*.*", "--sort=-v:refname"]);
  if (latestTag) {
    const first = latestTag.split("\n")[0];
    const sha = gitOrNull(["rev-parse", `${first}^{commit}`]);
    if (sha) return sha;
  }
  for (const ref of ["origin/main", "main"]) {
    const sha = gitOrNull(["rev-parse", `${ref}^{commit}`]);
    if (sha) return sha;
  }
  return git(["rev-list", "--max-parents=0", "HEAD"]).split("\n")[0];
}

function refForMerge(subject) {
  const pr = subject.match(MERGE_PR_SUBJECT);
  if (pr) return { branch: pr[2], pr: pr[1] };
  const branch = subject.match(MERGE_BRANCH_SUBJECT);
  if (branch) return { branch: branch[1], pr: null };
  return null;
}

// Conventional commits introduced by a merged PR (range parent1..parent2, no merges/bot).
function commitsInRange(base, tip, ref) {
  const raw = gitOrNull([
    "log",
    "--no-merges",
    `--format=%s${FIELD}%b${RECORD}`,
    `${base}..${tip}`,
  ]);
  if (!raw) return [];
  return splitRecords(raw).map(([subject, body]) => ({ subject, body, ref }));
}

function splitRecords(raw) {
  return raw
    .split(RECORD)
    .map((chunk) => chunk.replace(/^\n/, ""))
    .filter((chunk) => chunk.trim().length > 0)
    .map((chunk) => chunk.split(FIELD));
}

// Walks first-parent history since `sinceSha` and turns every merged PR (and squash/direct
// commit) into changelog entries, newest first.
function collectEntries(sinceSha) {
  const raw = gitOrNull([
    "log",
    "--first-parent",
    `--format=%P${FIELD}%s${FIELD}%b${RECORD}`,
    `${sinceSha}..HEAD`,
  ]);
  if (!raw) return [];

  const entries = [];
  for (const [parents, subject, body] of splitRecords(raw)) {
    if (CHANGELOG_BOT_SUBJECT.test(subject)) continue;
    const parentList = parents.split(" ").filter(Boolean);
    const isMerge = parentList.length > 1;

    if (isMerge) {
      const ref = refForMerge(subject);
      if (!ref) continue; // cross-branch merge without a PR -> content already attributed elsewhere
      for (const commit of commitsInRange(parentList[0], parentList[1], ref)) {
        pushEntry(entries, commit);
      }
      continue;
    }

    const squash = subject.match(SQUASH_PR_SUBJECT);
    const ref = squash ? { branch: null, pr: squash[1] } : null;
    const cleanSubject = squash ? subject.replace(SQUASH_PR_SUBJECT, "").trim() : subject;
    pushEntry(entries, { subject: cleanSubject, body, ref });
  }
  return entries;
}

function pushEntry(entries, commit) {
  const entry = lib.commitToEntry(commit);
  if (entry) entries.push(entry);
}

function loadDoc() {
  if (!existsSync(CHANGELOG_PATH)) {
    return { preamble: PREAMBLE, sections: [] };
  }
  const doc = lib.parseChangelog(readFileSync(CHANGELOG_PATH, "utf8"));
  return { ...doc, preamble: PREAMBLE };
}

function saveDoc(doc) {
  writeFileSync(CHANGELOG_PATH, lib.renderChangelog(doc));
}

function resolveContext() {
  const branch = currentBranch();
  if (branch === "develop") return { kind: "unreleased" };
  const release = branch.match(/^release\/(\d+\.\d+\.\d+)$/);
  if (release) return { kind: "version", version: release[1] };
  return null;
}

// Rebuilds the single section that belongs to the current branch, leaving every other
// (frozen) section untouched.
function regenerate() {
  const context = resolveContext();
  if (!context) {
    console.log(
      `changelog: branch '${currentBranch()}' is not develop/release/*, skipping.`,
    );
    return;
  }

  const doc = loadDoc();
  const target =
    context.kind === "unreleased"
      ? lib.findSection(doc, (info) => info.kind === "unreleased")
      : lib.findSection(doc, (info) => info.version === context.version);

  let section = target;
  if (!section) {
    const title = context.kind === "unreleased" ? lib.UNRELEASED_TITLE : context.version;
    section = { title, since: null, body: "" };
    doc.sections.unshift(section);
  }
  if (!section.since) section.since = resolveInitialSince();

  section.body = lib.renderSectionBody(collectEntries(section.since));
  saveDoc(doc);
  console.log(
    `changelog: rebuilt section '${section.title}' from ${section.since}..HEAD`,
  );
}

function promoteRelease(version) {
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error(`Invalid version '${version}', expected x.y.z`);
  }
  const doc = loadDoc();
  const head = git(["rev-parse", "HEAD"]);
  const promoted = lib.promote(doc, version, headDate(), head);
  saveDoc(promoted);
  console.log(`changelog: promoted Unreleased -> ${version}, opened fresh Unreleased.`);
}

function main() {
  const [command, arg] = process.argv.slice(2);
  if (command === "promote") {
    promoteRelease(arg);
    return;
  }
  regenerate();
}

main();
