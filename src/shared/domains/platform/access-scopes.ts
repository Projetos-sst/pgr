import { z } from "zod";

import { optionalUuidWith, requiredUuid } from "@/shared/domains/pgr/form-fields";

import type { CompanyModule } from "./company-modules";

export const ACCESS_AREAS: readonly ["safety", "health"] = ["safety", "health"];
export type AccessArea = (typeof ACCESS_AREAS)[number];

export const ACCESS_AREA_LABELS: Record<AccessArea, string> = {
  safety: "Segurança do Trabalho",
  health: "Medicina do Trabalho",
};

export const ACCESS_AREA_MODULE: Record<AccessArea, CompanyModule> = {
  safety: "pgr",
  health: "medicine",
};

export const accessAreaSchema = z.enum(ACCESS_AREAS, "Área inválida.");

export const accessScopeGrantSchema = z
  .object({
    companyId: requiredUuid("Empresa inválida."),
    workUnitId: optionalUuidWith("Obra inválida."),
    area: accessAreaSchema,
  })
  .strict();

export type AccessScopeGrant = z.infer<typeof accessScopeGrantSchema>;
export type AccessScopeGrantInput = {
  companyId: string;
  workUnitId?: string;
  area: string;
};

export type AccessScopeView = {
  id: string;
  userId: string;
  companyId: string;
  companyName: string;
  workUnitId: string | null;
  workUnitName: string | null;
  area: AccessArea;
  grantedBy: string;
  grantedAt: Date;
};

export function isScopeRestricted(role: string, scopeCount: number): boolean {
  return role !== "owner" && scopeCount > 0;
}

export function allowedAreas(
  role: string,
  scopes: readonly { area: AccessArea }[],
): AccessArea[] {
  if (!isScopeRestricted(role, scopes.length)) return [...ACCESS_AREAS];
  return ACCESS_AREAS.filter((area) => scopes.some((scope) => scope.area === area));
}
