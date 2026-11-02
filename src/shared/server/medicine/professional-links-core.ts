import "server-only";

import type { TenantContext } from "@/shared/auth/require-tenant-context";
import * as repo from "@/shared/db/repositories/medico-user-links";
import {
  professionalLinkSchema,
  professionalRevokeSchema,
} from "@/shared/domains/medicine/professional-links";
import { requiredUuid } from "@/shared/domains/pgr/form-fields";

const medicoId = (id: string) => requiredUuid("Profissional inválido.").parse(id);

export function listLinks(ctx: TenantContext, id: string) {
  return repo.listMedicoUserLinks(ctx, medicoId(id));
}

export function link(ctx: TenantContext, id: string, input: unknown) {
  return repo.linkMedicoUser(ctx, medicoId(id), professionalLinkSchema.parse(input));
}

export function revoke(ctx: TenantContext, id: string, linkId: string, input: unknown) {
  return repo.revokeMedicoUserLink(
    ctx,
    medicoId(id),
    requiredUuid("Vínculo inválido.").parse(linkId),
    professionalRevokeSchema.parse(input),
  );
}

export function myProfile(ctx: TenantContext) {
  return repo.getActorProfessionalProfile(ctx);
}
