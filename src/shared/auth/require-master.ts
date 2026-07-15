import "server-only";

import { auth } from "@clerk/nextjs/server";
import { forbidden } from "next/navigation";

import { isUserMaster } from "@/shared/db/repositories/admin";

import { ForbiddenError } from "./errors";
import { assertAuthenticated } from "./require-auth";

export type MasterContext = { userId: string };

/**
 * Gate de superadmin da plataforma (área /admin-global). NÃO é um papel de tenant:
 * exige a flag global `users.is_master`. Cross-tenant por natureza; usar com
 * parcimônia e só na área global.
 */
export async function requireMaster(): Promise<MasterContext> {
  const { userId } = assertAuthenticated(await auth());
  if (!(await isUserMaster(userId))) {
    throw new ForbiddenError("Acesso restrito a administradores da plataforma.");
  }
  return { userId };
}

/** Versão para Server Components: renderiza `forbidden()` se não for master. */
export async function requireMasterPage(): Promise<MasterContext> {
  try {
    return await requireMaster();
  } catch (error) {
    if (error instanceof ForbiddenError) forbidden();
    throw error;
  }
}
