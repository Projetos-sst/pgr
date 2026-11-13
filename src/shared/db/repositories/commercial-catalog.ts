import "server-only";

import {
  ON_SALE_CANDIDATES,
  loadOfferVersions,
  type CatalogReader,
} from "./commercial-catalog-admin";

export function listPublishedOffers(reader: CatalogReader) {
  return loadOfferVersions(reader, ON_SALE_CANDIDATES);
}
