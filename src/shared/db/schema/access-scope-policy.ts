import { sql, type SQL, type SQLWrapper } from "drizzle-orm";

import {
  ACCESS_AREAS,
  ACCESS_AREA_MODULE,
} from "@/shared/domains/platform/access-scopes";

const actor = sql`nullif(current_setting('app.current_actor', true), '')`;
const currentOrg = sql`current_setting('app.current_org', true)`;
const actorScopes = sql`public.member_access_scopes s where s.org_id = ${currentOrg} and s.user_id = ${actor}`;
const unrestricted = sql`${actor} is null or exists (select 1 from public.org_memberships m where m.org_id = ${currentOrg} and m.user_id = ${actor} and m.role in ('owner','org:admin')) or not exists (select 1 from ${actorScopes})`;
const areaOfModule = sql.join(
  ACCESS_AREAS.map((area) =>
    sql.raw(`when '${ACCESS_AREA_MODULE[area]}' then '${area}'`),
  ),
  sql` `,
);

export function actorCompanyScope(companyId: SQLWrapper): SQL<boolean> {
  return sql<boolean>`(${unrestricted} or exists (select 1 from ${actorScopes} and s.company_id = ${companyId}))`;
}

export function actorWorkUnitScope(
  companyId: SQLWrapper,
  workUnitId: SQLWrapper,
): SQL<boolean> {
  return sql<boolean>`(${unrestricted} or exists (select 1 from ${actorScopes} and s.company_id = ${companyId} and (s.work_unit_id is null or ${workUnitId} is null or s.work_unit_id = ${workUnitId})))`;
}

export function actorModuleScope(
  companyId: SQLWrapper,
  module: SQLWrapper,
): SQL<boolean> {
  return sql<boolean>`(${unrestricted} or exists (select 1 from ${actorScopes} and s.company_id = ${companyId} and s.area = case ${module} ${areaOfModule} end))`;
}

export function officeWideOr(column: SQLWrapper, scope: SQL<boolean>): SQL<boolean> {
  return sql<boolean>`(${column} is null or ${scope})`;
}

export function visibleWorkUnit(workUnitId: SQLWrapper): SQL<boolean> {
  return sql<boolean>`(${workUnitId} is null or exists (select 1 from public.work_units w where w.id = ${workUnitId}))`;
}
