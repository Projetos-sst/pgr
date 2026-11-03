import { pgRole } from "drizzle-orm/pg-core";

export const appRuntimeRole = pgRole("app_runtime").existing();

/**
 * Papel do operador da plataforma que confere a identidade profissional (NOB-158). Criado NOLOGIN
 * pela migration 0071; a conta de login (membro deste papel) é provisionada pela infraestrutura e
 * usada só pela área da plataforma (`IDENTITY_VERIFIER_DATABASE_URL`). O `app_runtime` não é
 * membro e não tem nenhum privilégio de escrita sobre as verificações.
 */
export const identityVerifierRole = pgRole("identity_verifier").existing();
