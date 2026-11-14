import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  jsonb,
  bigint,
  timestamp,
  index,
  pgPolicy,
  check,
} from "drizzle-orm/pg-core";
import type { PgrDocxStoredOverrides } from "@/shared/domains/pgr/pgr-docx/text-overrides";
import { appRuntimeRole } from "../roles";
import { orgs } from "./orgs";
import { pgr } from "./pgr";

const tenant = sql`org_id=current_setting('app.current_org',true)`;

export const pgrDocxTextVersions = pgTable(
  "pgr_docx_text_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    seq: bigint("seq", { mode: "number" }).notNull().generatedAlwaysAsIdentity(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    pgrId: uuid("pgr_id")
      .notNull()
      .references(() => pgr.id, { onDelete: "restrict" }),
    overrides: jsonb("overrides").$type<PgrDocxStoredOverrides>().notNull(),
    textsSha256: text("texts_sha256").notNull(),
    reason: text("reason").notNull(),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => {
    const visiblePgr = sql`exists(select 1 from public.pgr p where p.id=${t.pgrId} and p.org_id=${t.orgId})`;
    return [
      index("idx_pgr_docx_text_versions").on(t.orgId, t.pgrId, t.seq),
      check("pgr_docx_text_versions_sha256", sql`${t.textsSha256} ~ '^[a-f0-9]{64}$'`),
      check("pgr_docx_text_versions_reason", sql`btrim(${t.reason}) <> ''`),
      pgPolicy("pgr_docx_text_versions_tenant", {
        for: "all",
        to: appRuntimeRole,
        using: tenant,
        withCheck: tenant,
      }),
      pgPolicy("pgr_docx_text_versions_context", {
        as: "restrictive",
        for: "all",
        to: appRuntimeRole,
        using: visiblePgr,
        withCheck: visiblePgr,
      }),
      pgPolicy("pgr_docx_text_versions_actor", {
        as: "restrictive",
        for: "insert",
        to: appRuntimeRole,
        withCheck: sql`${t.createdBy}=current_setting('app.current_actor',true)`,
      }),
    ];
  },
).enableRLS();
