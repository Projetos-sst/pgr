import "server-only";

import type { TenantContext } from "@/shared/auth/require-tenant-context";
import { ForbiddenError } from "@/shared/auth/errors";
import * as repo from "@/shared/db/repositories/risk-absence-declarations";
import {
  declarationBlocker,
  riskAbsenceInputSchema,
  riskAbsenceJobRoleSchema,
} from "@/shared/domains/medicine/risk-absence";
import { requiredUuid } from "@/shared/domains/pgr/form-fields";
import { NotFoundError } from "@/shared/errors/not-found-error";
import { ValidationError } from "@/shared/errors/validation-error";

import { loadProposalSources } from "./exam-proposal-core";

const companyUuid = (id: string) => requiredUuid("Empresa inválida.").parse(id);

/**
 * Declarações de inexistência de riscos da empresa (NOB-156), com a permissão do ator. A equipe do
 * escritório lê; conta de cliente (o profissional da empresa costuma ser uma) só com autorização
 * ativa nesta empresa.
 */
export async function listRiskAbsence(ctx: TenantContext, companyId: string) {
  const id = companyUuid(companyId);
  const canDeclare = await repo.canDeclareRiskAbsence(ctx, id);
  if (ctx.role === "client" && !canDeclare)
    throw new ForbiddenError("Sem autorização profissional ativa nesta empresa.");
  const [declarations, ges, gesJobRoles] = await Promise.all([
    repo.listRiskAbsenceDeclarations(ctx, id),
    canDeclare ? repo.listCompanyGes(ctx, id) : Promise.resolve([]),
    canDeclare ? repo.listCompanyGesJobRoles(ctx, id) : Promise.resolve([]),
  ]);
  // Cada GES com as funções vinculadas: o formulário escolhe, não digita (NOB-112).
  const groups = ges.map((g) => ({
    ...g,
    jobRoles: gesJobRoles
      .filter((r) => r.gesId === g.id)
      .map((r) => ({ id: r.jobRoleId, title: r.title })),
  }));
  return { declarations, canDeclare, groups };
}

/**
 * O profissional com autorização ativa declara a inexistência de riscos do GES/função na versão
 * vigente da fonte. Recusa fonte substituída ou desatualizada e escopo com risco pendente ou
 * validado: o sistema nunca transforma cadastro vazio em inexistência. A função, quando
 * informada, é o id (`jobRoleId`) de uma função cadastrada e vinculada a este GES, desta empresa e
 * deste tenant; senão, VALIDATION no campo `jobRoleId` e nada é gravado. Grava o id e o título
 * atual (texto histórico): o ASO casa pelo id, então renomear a função não invalida a declaração.
 */
export async function declareRiskAbsence(
  ctx: TenantContext,
  companyId: string,
  input: unknown,
) {
  const id = companyUuid(companyId);
  const values = riskAbsenceInputSchema.parse(input);
  // Autorização antes de revelar qualquer coisa sobre fontes e grupos.
  if (!(await repo.canDeclareRiskAbsence(ctx, id)))
    throw new ForbiddenError(
      "A declaração de inexistência de riscos exige autorização profissional ativa de validação de riscos nesta empresa.",
    );
  const group = await repo.getCompanyGes(ctx, id, values.gesId);
  // Função informada = uma função cadastrada e vinculada a este GES, pelo id (NOB-112).
  const role = riskAbsenceJobRoleSchema(
    values.jobRoleId ? await repo.listCompanyGesJobRoles(ctx, id, group.id) : [],
  ).parse({ jobRoleId: values.jobRoleId });
  const source = (await loadProposalSources(ctx, id)).find(
    (s) => s.id === values.sourceId,
  );
  if (!source) throw new NotFoundError();
  const blocker = declarationBlocker(source, {
    gesId: group.id,
    gesName: group.name,
    jobRole: role.jobRole,
  });
  if (blocker) throw new ValidationError(blocker);
  return repo.insertRiskAbsenceDeclaration(
    ctx,
    id,
    {
      sourceId: values.sourceId,
      gesId: group.id,
      jobRoleId: role.jobRoleId,
      jobRole: role.jobRole,
      justification: values.justification,
    },
    group.name,
  );
}
