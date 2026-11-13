import fs from "node:fs";
import path from "node:path";

const API_ROOT = path.resolve(process.cwd(), "src/app/api");
const RESOLVES_CONTEXT =
  /\b(resolveContext|resolveTenantContext|requireOfficeStaff|requireTenantContext)\(/;

function routeFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return routeFiles(full);
    return entry.name === "route.ts" ? [full] : [];
  });
}

describe("route handlers that resolve the tenant context by hand", () => {
  it("run their work as the authenticated actor, like restHandler does", () => {
    const sources = routeFiles(API_ROOT).map((file) => ({
      file: path.relative(process.cwd(), file),
      source: fs.readFileSync(file, "utf8"),
    }));
    const handRolled = sources.filter(({ source }) => RESOLVES_CONTEXT.test(source));
    expect(handRolled.length).toBeGreaterThan(0);
    expect(
      handRolled
        .filter(({ source }) => !source.includes("runAsActor("))
        .map(({ file }) => file),
    ).toEqual([]);
  });
});
