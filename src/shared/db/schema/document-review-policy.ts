import { sql, type SQLWrapper } from "drizzle-orm";
export const documentReviewReadScope = (org: SQLWrapper, pgr: SQLWrapper) =>
  sql`public.pgr_review_actor_allowed(${org},${pgr})`;
