"use server";
import { revalidatePath } from "next/cache";
import { officeAction } from "@/shared/server/office-action";
import * as core from "@/shared/server/pgr/basic-offer-core";
import type { PageParams } from "@/shared/pagination";
export async function listBasicOffersAction(page: PageParams = {}) {
  return officeAction("pgr.basic_offer.list", (ctx) => core.listOffers(ctx, page));
}
export async function getBasicOfferAction(id: string) {
  return officeAction("pgr.basic_offer.get", (ctx) => core.getOffer(ctx, id));
}
export async function createBasicOfferAction(input: unknown) {
  return officeAction(
    "pgr.basic_offer.create",
    async (ctx) => {
      const row = await core.createOffer(ctx, input);
      revalidatePath("/pgr-basic-offer");
      return row;
    },
    { audit: true },
  );
}
export async function publishBasicOfferAction(id: string, input: unknown) {
  return officeAction(
    "pgr.basic_offer.publish",
    async (ctx) => {
      const row = await core.publishOffer(ctx, id, input);
      revalidatePath("/pgr-basic-offer");
      return row;
    },
    { audit: true },
  );
}
