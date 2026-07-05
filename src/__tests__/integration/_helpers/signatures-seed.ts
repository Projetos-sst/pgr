import type postgres from "postgres";

import { hashToken } from "@/shared/domains/signatures/token";

/** Tenants para os testes de assinatura: org_a (free) / org_b (pro). */
export async function seedSignatureOrgs(
  admin: ReturnType<typeof postgres>,
): Promise<void> {
  await admin.unsafe(
    `truncate table public.orgs, public.users restart identity cascade;`,
  );
  await admin.unsafe(
    `insert into public.orgs (id, plan) values ('org_a','free'), ('org_b','pro');`,
  );
}

export type SeedRequestInput = {
  orgId: string;
  rawToken: string;
  targetType?: string;
  payload?: unknown;
  status?: "pending" | "signed" | "cancelled";
  expiresAt?: Date;
  usedAt?: Date | null;
};

/** Insere um signature_request via conexão admin (bypassa RLS). Retorna o id. */
export async function seedRequest(
  admin: ReturnType<typeof postgres>,
  input: SeedRequestInput,
): Promise<string> {
  const expiresAt = input.expiresAt ?? new Date(Date.now() + 60 * 60 * 1000);
  const [row] = await admin<{ id: string }[]>`
    insert into public.signature_requests
      (org_id, target_type, token_hash, payload, status, expires_at, used_at)
    values (
      ${input.orgId},
      ${input.targetType ?? "demo"},
      ${hashToken(input.rawToken)},
      ${admin.json((input.payload ?? { title: "Termo" }) as never)},
      ${input.status ?? "pending"},
      ${expiresAt},
      ${input.usedAt ?? null}
    )
    returning id
  `;
  return row.id;
}
