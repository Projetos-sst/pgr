import { execFileSync } from "node:child_process";
import path from "node:path";

import { currentActor, rememberActor, runAsActor } from "@/shared/db/session-actor";

const pause = () => new Promise((resolve) => setTimeout(resolve, 5));

async function actorAfterAwait(): Promise<string | null> {
  await pause();
  return currentActor();
}

describe("session actor", () => {
  it("has no actor outside a request", () => {
    expect(currentActor()).toBeNull();
  });

  it("carries the actor through awaits and drops it when the request ends", async () => {
    expect(await runAsActor("user-1", actorAfterAwait)).toBe("user-1");
    expect(currentActor()).toBeNull();
  });

  it("keeps concurrent requests apart", async () => {
    const actors = await Promise.all([
      runAsActor("user-1", actorAfterAwait),
      runAsActor("user-2", actorAfterAwait),
      actorAfterAwait(),
    ]);
    expect(actors).toEqual(["user-1", "user-2", null]);
  });

  it("never keeps a remembered actor outside a server render", () => {
    rememberActor("user-1");
    expect(currentActor()).toBeNull();
  });

  it("shares the remembered actor inside one server render and isolates renders", () => {
    const fixture = path.join(__dirname, "fixtures/render-session-actor.mjs");
    const output = execFileSync(
      process.execPath,
      ["--conditions=react-server", "--experimental-strip-types", fixture],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    );
    expect(JSON.parse(output)).toEqual({
      "page:alice": "alice",
      "nested:alice": "alice",
      "page:bob": "bob",
      "nested:bob": "bob",
      afterRender: null,
    });
  });
});
