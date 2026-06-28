// The changelog generator is a plain CommonJS build script (scripts/changelog-lib.js).
// Only its pure helpers are unit-tested here; git/fs orchestration lives in the .js entry.
const lib = require("../../../../scripts/changelog-lib");

describe("changelog category mapping", () => {
  const cases: Array<[string, string | null]> = [
    ["feat: add signature pad", "Added"],
    ["feat(ui): add QR", "Added"],
    ["fix: token expiry", "Fixed"],
    ["perf: cache lookups", "Changed"],
    ["chore: bump deps", null],
    ["ci: tweak pipeline", null],
    ["build: docker image", null],
    ["test: add suite", null],
    ["style: format", null],
    ["docs: update readme", null],
    ["refactor: rename helper", null],
    ["not a conventional commit", null],
  ];

  it.each(cases)("%s -> %s", (subject, expected) => {
    const entry = lib.commitToEntry({ subject, body: "" });
    expect(entry?.category ?? null).toBe(expected);
  });

  it("includes docs/refactor only with a Changelog trailer", () => {
    expect(lib.commitToEntry({ subject: "docs: new guide", body: "" })).toBeNull();
    const optedIn = lib.commitToEntry({
      subject: "refactor: unify capture flow",
      body: "Changelog: Changed",
    });
    expect(optedIn?.category).toBe("Changed");
  });

  it("treats breaking changes as Changed with a Breaking prefix", () => {
    const bang = lib.commitToEntry({ subject: "feat!: drop legacy field", body: "" });
    expect(bang?.category).toBe("Changed");
    expect(bang?.bullet).toContain("**Breaking:**");

    const footer = lib.commitToEntry({
      subject: "feat: rework auth",
      body: "BREAKING CHANGE: tokens rotate",
    });
    expect(footer?.category).toBe("Changed");
  });
});

describe("bullet formatting (Format 1: description — branch (#pr))", () => {
  it("renders branch and PR reference", () => {
    const entry = lib.commitToEntry({
      subject: "feat: public signature link",
      body: "",
      ref: { branch: "feature/digital-signature-infra", pr: "67" },
    });
    expect(entry?.bullet).toBe(
      "- public signature link — `feature/digital-signature-infra` (#67)",
    );
  });

  it("falls back gracefully when only the PR is known", () => {
    const entry = lib.commitToEntry({
      subject: "fix: scale",
      body: "",
      ref: { branch: null, pr: "98" },
    });
    expect(entry?.bullet).toBe("- scale (#98)");
  });

  it("renders a bare bullet without references", () => {
    const entry = lib.commitToEntry({ subject: "feat: thing", body: "" });
    expect(entry?.bullet).toBe("- thing");
  });
});

describe("section rendering", () => {
  it("groups entries by category in Added/Changed/Fixed order and dedupes", () => {
    const body = lib.renderSectionBody([
      { category: "Fixed", bullet: "- b" },
      { category: "Added", bullet: "- a" },
      { category: "Changed", bullet: "- c" },
      { category: "Added", bullet: "- a" },
    ]);
    expect(body).toBe("### Added\n\n- a\n\n### Changed\n\n- c\n\n### Fixed\n\n- b");
  });

  it("returns empty body when there are no entries", () => {
    expect(lib.renderSectionBody([])).toBe("");
  });
});

describe("parse/render round trip", () => {
  const sample = [
    "# Changelog",
    "",
    "## Unreleased",
    "<!-- changelog:since aaa111 -->",
    "",
    "### Added",
    "",
    "- new thing",
    "",
    "## 1.4.0 - 2026-06-28",
    "<!-- changelog:since beef00 -->",
    "",
    "### Fixed",
    "",
    "- old fix",
    "",
  ].join("\n");

  it("parses preamble, since markers and sections", () => {
    const doc = lib.parseChangelog(sample);
    expect(doc.sections).toHaveLength(2);
    expect(doc.sections[0].title).toBe("Unreleased");
    expect(doc.sections[0].since).toBe("aaa111");
    expect(doc.sections[1].title).toBe("1.4.0 - 2026-06-28");
    expect(doc.sections[1].since).toBe("beef00");
    expect(doc.sections[1].body).toContain("- old fix");
  });

  it("classifies titles", () => {
    expect(lib.classifyTitle("Unreleased").kind).toBe("unreleased");
    expect(lib.classifyTitle("1.4.0 - 2026-06-28")).toMatchObject({
      kind: "version",
      version: "1.4.0",
    });
  });
});

describe("promote", () => {
  function unreleasedDoc() {
    return {
      preamble: "# Changelog",
      sections: [
        {
          title: "Unreleased",
          since: "base000",
          body: "### Added\n\n- feature one\n- feature two",
        },
      ],
    };
  }

  it("freezes Unreleased into a version and opens a fresh empty Unreleased", () => {
    const doc = lib.promote(unreleasedDoc(), "1.4.0", "2026-06-28", "tip999");
    expect(doc.sections).toHaveLength(2);

    const [open, frozen] = doc.sections;
    expect(open.title).toBe("Unreleased");
    expect(open.since).toBe("tip999");
    expect(open.body).toBe("");

    expect(frozen.title).toBe("1.4.0 - 2026-06-28");
    expect(frozen.since).toBe("base000");
    expect(frozen.body).toContain("- feature one");
  });

  it("is idempotent when the version already exists", () => {
    const once = lib.promote(unreleasedDoc(), "1.4.0", "2026-06-28", "tip999");
    const twice = lib.promote(once, "1.4.0", "2026-06-28", "tipAAA");
    expect(twice.sections).toHaveLength(2);
    expect(twice).toBe(once);
  });
});
