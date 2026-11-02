import "server-only";

import type { TenantContext } from "@/shared/auth/require-tenant-context";
import { requiredUuid } from "@/shared/domains/pgr/form-fields";
import {
  coordinatorClosingSchema,
  coordinatorDesignationSchema,
} from "@/shared/domains/medicine/pcmso-coordinators";
import * as repo from "@/shared/db/repositories/pcmso-coordinators";

// Núcleo único da Server Action e do REST: mesma validação e mesmo repositório.
const id = (value: string) => requiredUuid("Identificador inválido.").parse(value);

export function listCoordinators(ctx: TenantContext, companyId: string) {
  return repo.listCoordinatorAssignments(ctx, id(companyId));
}

export function getCoordinator(ctx: TenantContext, assignmentId: string) {
  return repo.getCoordinatorAssignment(ctx, id(assignmentId));
}

export function designateCoordinator(
  ctx: TenantContext,
  companyId: string,
  input: unknown,
) {
  return repo.designateCoordinator(
    ctx,
    id(companyId),
    coordinatorDesignationSchema.parse(input),
  );
}

export function closeCoordinator(
  ctx: TenantContext,
  assignmentId: string,
  input: unknown,
) {
  return repo.closeCoordinatorAssignment(
    ctx,
    id(assignmentId),
    coordinatorClosingSchema.parse(input),
  );
}
