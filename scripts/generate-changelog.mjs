// Regenera o CHANGELOG.md inteiro a partir do histórico do branch (idempotente).
// Cada PR mergeado vira um bloco datado com os conventional commits que trouxe.
// Uso: [CHANGELOG_REF=<ref>] node scripts/generate-changelog.mjs [saida]
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const ref = process.env.CHANGELOG_REF || "HEAD";
const outputPath = process.argv[2] || "CHANGELOG.md";

const EXCLUDED_TYPES = new Set(["docs"]);
const CHANGELOG_BOT_AUTHOR = "github-actions[bot]";

const FIELD = "\x1f";
const RECORD = "\x1e";
const CONVENTIONAL_SUBJECT = /^(\w+)(?:\(([^)]*)\))?(!)?:\s+(.+)$/;
const MERGE_PR_SUBJECT = /^Merge pull request #(\d+) from \S+\/(.+)$/;
const SQUASH_PR_SUBJECT = /\(#(\d+)\)\s*$/;

function git(args) {
  return execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}

function toBullet(subject) {
  const match = subject.match(CONVENTIONAL_SUBJECT);
  if (!match) return `- ${subject}`;
  const [, type, scope, breaking, description] = match;
  if (EXCLUDED_TYPES.has(type)) return null;
  const label = `${type}${scope ? `(${scope})` : ""}${breaking ? "!" : ""}`;
  return `- **${label}:** ${description}`;
}

// Commits introduzidos por um PR (intervalo base..tip, sem merges nem o bot).
function bulletsForRange(base, tip) {
  const raw = git([
    "log",
    "--no-merges",
    `--format=%cN${FIELD}%s`,
    `${base}..${tip}`,
  ]).trim();
  if (!raw) return [];
  const bullets = [];
  for (const line of raw.split("\n")) {
    const [author, subject] = line.split(FIELD);
    if (author === CHANGELOG_BOT_AUTHOR) continue;
    const bullet = toBullet(subject);
    if (bullet) bullets.push(bullet);
  }
  return bullets;
}

function readFirstParentCommits() {
  const raw = git([
    "log",
    "--first-parent",
    `--format=%H${FIELD}%P${FIELD}%cs${FIELD}%s${FIELD}%b${RECORD}`,
    ref,
  ]);
  return raw
    .split(RECORD)
    .map((chunk) => chunk.replace(/^\n/, ""))
    .filter((chunk) => chunk.trim().length > 0)
    .map((chunk) => {
      const [hash, parents, date, subject, body = ""] = chunk.split(FIELD);
      return { hash, parents: parents.split(" ").filter(Boolean), date, subject, body };
    });
}

function firstNonEmptyLine(text) {
  for (const line of text.split("\n")) {
    if (line.trim()) return line.trim();
  }
  return null;
}

function collectEntries() {
  const entries = [];
  for (const commit of readFirstParentCommits()) {
    const isMerge = commit.parents.length > 1;

    if (isMerge) {
      const merge = commit.subject.match(MERGE_PR_SUBJECT);
      if (!merge) continue; // ignora merges cross-branch sem PR (conteúdo já atribuído ao seu próprio PR)
      const bullets = bulletsForRange(commit.parents[0], commit.parents[1]);
      if (bullets.length === 0) continue;
      entries.push({
        date: commit.date,
        prNumber: merge[1],
        prTitle: firstNonEmptyLine(commit.body) || merge[2],
        bullets,
      });
      continue;
    }

    const squash = commit.subject.match(SQUASH_PR_SUBJECT);
    if (!squash) continue; // commit direto sem PR -> fora do changelog
    const bullet = toBullet(commit.subject.replace(SQUASH_PR_SUBJECT, "").trim());
    if (!bullet) continue;
    entries.push({
      date: commit.date,
      prNumber: squash[1],
      prTitle: commit.subject,
      bullets: [bullet],
    });
  }
  return entries;
}

function render(entries) {
  const lines = [
    "# Changelog",
    "",
    "Gerado automaticamente a cada merge para `develop`/`main`. Não editar à mão.",
    "",
  ];
  let currentDate = null;
  for (const entry of entries) {
    if (entry.date !== currentDate) {
      lines.push(`## ${entry.date}`, "");
      currentDate = entry.date;
    }
    lines.push(`### PR #${entry.prNumber} — ${entry.prTitle}`, ...entry.bullets, "");
  }
  return `${lines.join("\n").trimEnd()}\n`;
}

writeFileSync(outputPath, render(collectEntries()));
