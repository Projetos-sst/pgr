import { sql } from "drizzle-orm";
import { pgPolicy } from "drizzle-orm/pg-core";

import { appRuntimeRole } from "../roles";

export const platformOperator = sql`exists(select 1 from public.users u where u.id = nullif(current_setting('app.platform_operator', true), '') and u.is_master)`;

export const platformOperatorRead = (table: string) =>
  pgPolicy(`${table}_platform_operator`, {
    for: "select",
    to: appRuntimeRole,
    using: platformOperator,
  });
