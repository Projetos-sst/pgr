import { sql } from "drizzle-orm";
import { pgTable, text, uuid, timestamp, pgPolicy } from "drizzle-orm/pg-core";
import { appRuntimeRole } from "../roles";
import { billingTrials } from "./billing";
/** Global deduplication ledger. Runtime cannot read identifiers from another office. */
export const billingTrialClaims = pgTable(
  "billing_trial_claims",
  {
    cnpjHash: text("cnpj_hash").primaryKey(),
    trialId: uuid("trial_id")
      .notNull()
      .references(() => billingTrials.id, { onDelete: "restrict" }),
    claimedAt: timestamp("claimed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  () => [
    pgPolicy("billing_trial_claims_private", {
      for: "all",
      to: appRuntimeRole,
      using: sql`false`,
      withCheck: sql`false`,
    }),
  ],
).enableRLS();
