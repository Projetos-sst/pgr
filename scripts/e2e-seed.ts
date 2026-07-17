/**
 * Seed determinístico do ambiente E2E (Fase 06) — reusa o mesmo seed base das integrações
 * (`seedPgrBase`) para popular org_a/org_b + cadeia (empresa/risco/GES/…). Executado apenas
 * contra o Postgres **efêmero** de teste (nunca o banco real). Uso: `E2E_ADMIN_URL=… tsx scripts/e2e-seed.ts`.
 */
import { createClerkClient } from "@clerk/backend";
import postgres from "postgres";

import { seedPgrBase, PGR_IDS } from "../src/__tests__/integration/_helpers/pgr-seed";

/**
 * Vincula o usuário de teste do Clerk ao tenant semeado `org_a` como **owner** (office staff),
 * inserindo `users` + `org_memberships`. Assim `resolveActiveTenant` encontra uma associação
 * existente (sem depender do sync por webhook) e as telas protegidas resolvem `org_a` — que já tem
 * empresa/risco/incidente semeados. Só roda se `CLERK_SECRET_KEY` + e-mail de teste estiverem no env.
 */
async function linkClerkUserToOrgA(
  sql: ReturnType<typeof postgres>,
): Promise<string | null> {
  const secretKey = process.env.CLERK_SECRET_KEY;
  const email = process.env.E2E_CLERK_USER_EMAIL;
  if (!secretKey || !email) return null;
  const cc = createClerkClient({ secretKey });
  const list = await cc.users.getUserList({ emailAddress: [email] });
  if (list.totalCount === 0) return null;
  const userId = list.data[0].id;
  await sql`
    insert into public.users (id, email, is_master)
    values (${userId}, ${email}, false)
    on conflict (id) do nothing`;
  await sql`
    insert into public.org_memberships (org_id, user_id, role)
    values ('org_a', ${userId}, 'owner')
    on conflict (org_id, user_id) do update set role = 'owner'`;
  return userId;
}

async function main() {
  const url = process.env.E2E_ADMIN_URL;
  if (!url) throw new Error("E2E_ADMIN_URL não definida.");
  const sql = postgres(url, { max: 1 });
  await seedPgrBase(sql);
  const linkedUser = await linkClerkUserToOrgA(sql);
  await sql.end({ timeout: 5 });
  // Só ids técnicos (sem PII) para o roteiro de teste.
  console.log(
    JSON.stringify({
      orgA: "org_a",
      companyA: PGR_IDS.companyA,
      employeeA: PGR_IDS.employeeA,
      riskA: PGR_IDS.riskA,
      linkedClerkUser: linkedUser ? "yes" : "no",
    }),
  );
}

main().catch((e) => {
  console.error(String(e?.message ?? e));
  process.exit(1);
});
