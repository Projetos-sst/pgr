import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";
import { cache } from "react";

type RenderActor = { userId: string | null };

const requestActor = new AsyncLocalStorage<string>();
const renderActor = cache((): RenderActor => ({ userId: null }));

export function runAsActor<T>(userId: string, fn: () => T): T {
  return requestActor.run(userId, fn);
}

export function rememberActor(userId: string): void {
  renderActor().userId = userId;
}

export function currentActor(): string | null {
  return requestActor.getStore() ?? renderActor().userId;
}
