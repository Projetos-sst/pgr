import type { TenantContext } from "@/shared/auth/require-tenant-context";
import {
  actOnInvitation,
  invite,
  listLinks,
} from "@/shared/server/medicine/professional-links-core";

import { adminClient } from "./db";

/** Operador fictício da plataforma (não é membro de nenhum escritório de teste). */
export const TEST_VERIFIER = "platform-verifier-test";

/**
 * Registra, como admin (fora do app_runtime), um pedido e uma verificação de identidade válida para
 * (escritório, profissional, conta), com o CRM/UF atuais do cadastro. Simula o operador
 * independente da NOB-158 para os testes que precisam de acesso clínico. Dados fictícios.
 */
export async function verifyIdentityForTest(
  orgId: string,
  medicoId: string,
  userId: string,
): Promise<{ requestId: string; verificationId: string }> {
  const admin = adminClient();
  try {
    const [req] =
      await admin`insert into professional_identity_requests (org_id, medico_id, user_id)
      values (${orgId}, ${medicoId}, ${userId}) returning id`;
    const [ver] = await admin`insert into professional_identity_verifications
      (org_id, request_id, medico_id, user_id, crm, registration_uf, method, checklist, registry_source, verified_by, expires_at)
      select ${orgId}, ${req.id}, m.id, ${userId}, m.crm, coalesce(m.registration_uf, 'MA'), 'live_video',
        '{"identityDocument":true,"professionalDocument":true,"registryStatus":true,"personMatches":true,"accountControl":true}'::jsonb,
        'Consulta fictícia de teste', ${TEST_VERIFIER}, now() + interval '12 months'
      from medicos m where m.id = ${medicoId} and m.org_id = ${orgId}
      returning id`;
    // Cadastro sem UF não passa na conferência: o teste fixa a UF usada na verificação.
    await admin`update medicos set registration_uf = coalesce(registration_uf, 'MA') where id = ${medicoId}`;
    return { requestId: req.id as string, verificationId: ver.id as string };
  } finally {
    await admin.end({ timeout: 5 });
  }
}

/**
 * Vínculo profissional ↔ conta pelo fluxo real da NOB-157: o owner convida e a própria conta
 * convidada aceita. Para autovínculo, `approver` (outro owner) aprova depois do aceite. Por padrão
 * também registra a verificação independente de identidade (NOB-158), sem a qual o vínculo não dá
 * acesso clínico; passe `{ verify: false }` para testar o bloqueio. Devolve o vínculo efetivo.
 */
export async function linkByInvitation(
  owner: TenantContext,
  medicoId: string,
  input: { userId: string; reason: string },
  approver?: TenantContext,
  { verify = true }: { verify?: boolean } = {},
) {
  const invitation = await invite(owner, medicoId, input);
  const invitee: TenantContext = { ...owner, userId: input.userId, role: "collaborator" };
  if (input.userId === owner.userId) invitee.role = owner.role;
  await actOnInvitation(invitee, medicoId, invitation.id, "accept");
  if (approver) await actOnInvitation(approver, medicoId, invitation.id, "approve");
  // Devolve o vínculo efetivo criado (o aberto mais recente do profissional).
  const open = (await listLinks(owner, medicoId)).find((l) => l.revokedAt === null);
  if (!open)
    throw new Error("Convite aceito sem vínculo efetivo (autovínculo sem aprovação?).");
  if (verify) await verifyIdentityForTest(owner.tenantId, medicoId, input.userId);
  return open;
}
