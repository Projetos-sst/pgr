import { pgTable, text, timestamp, boolean, pgPolicy } from "drizzle-orm/pg-core";
import { sql, type InferInsertModel, type InferSelectModel } from "drizzle-orm";
import { authenticatedRole } from "drizzle-orm/supabase";

import { appRuntimeRole } from "../roles";

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email"),
    firstName: text("first_name"),
    lastName: text("last_name"),
    imageUrl: text("image_url"),
    // App-managed profile fields (not synced from Clerk; preserved across Clerk upserts).
    phone: text("phone"),
    cpf: text("cpf"),
    jobTitle: text("job_title"),
    // Superadmin global da plataforma (área /admin-global; NÃO é papel de tenant).
    isMaster: boolean("is_master").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    pgPolicy("users_select_self", {
      for: "select",
      to: authenticatedRole,
      using: sql`${table.id} = (auth.jwt() ->> 'sub')`,
    }),
    pgPolicy("users_platform_operator_self", {
      for: "select",
      to: appRuntimeRole,
      using: sql`${table.id} = nullif(current_setting('app.platform_operator', true), '')`,
    }),
  ],
).enableRLS();

export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;
