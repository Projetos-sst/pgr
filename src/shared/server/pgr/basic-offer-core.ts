import "server-only";
import type { TenantContext } from "@/shared/auth/require-tenant-context";
import { requiredUuid } from "@/shared/domains/pgr/form-fields";
import {
  basicOfferSchema,
  basicOfferPublicationSchema,
} from "@/shared/domains/pgr/basic-offer";
import * as repo from "@/shared/db/repositories/pgr-basic-offers";
import type { PageParams } from "@/shared/pagination";
export const listOffers = (ctx: TenantContext, page: PageParams = {}) =>
  repo.listBasicOffers(ctx, page);
export const getOffer = async (ctx: TenantContext, id: string) =>
  repo.getBasicOffer(ctx, requiredUuid("Versão inválida.").parse(id));
export const createOffer = async (ctx: TenantContext, input: unknown) =>
  repo.createBasicOffer(ctx, basicOfferSchema.parse(input));
export const publishOffer = async (ctx: TenantContext, id: string, input: unknown) =>
  repo.publishBasicOffer(
    ctx,
    requiredUuid("Versão inválida.").parse(id),
    basicOfferPublicationSchema.parse(input),
  );
