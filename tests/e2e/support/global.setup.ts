import { clerkSetup } from "@clerk/testing/playwright";
import type { FullConfig } from "@playwright/test";

/**
 * Global setup do Playwright: obtém o **Testing Token** do Clerk (contorna bot-detection em
 * ambiente de teste) a partir das chaves em env. Não versiona nada. Se as chaves não estiverem
 * presentes, `clerkSetup` lança — o projeto `setup` reporta o bloqueio com clareza.
 */
export default async function globalSetup(_config: FullConfig) {
  await clerkSetup();
}
