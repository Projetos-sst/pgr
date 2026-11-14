import type { CommercialEnvironment } from "@/shared/domains/commercial/offer";

export function commercialEnvironment(): CommercialEnvironment {
  return {
    APP_ENV: process.env.APP_ENV,
    COMMERCIAL_CATALOG_ENABLED: process.env.COMMERCIAL_CATALOG_ENABLED,
  };
}
