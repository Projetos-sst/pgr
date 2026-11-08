/**
 * Declaração de inexistência de riscos (NOB-156, DT-12, MED-09). Regras puras:
 * - quando a declaração pode ser feita;
 * - quando ela vale para o ASO de um funcionário.
 * Ausência de cadastro nunca vira inexistência: só a declaração explícita do profissional
 * autorizado, presa à versão da fonte, conta.
 */
import { z } from "zod";

import { optionalUuidWith, requiredUuid } from "@/shared/domains/pgr/form-fields";

import type { MedicalRiskStatus, SourceFreshness } from "./risk-sources";

export const RISK_ABSENCE_JUSTIFICATION_MIN = 20;
export const RISK_ABSENCE_JUSTIFICATION_MAX = 2000;

/** Texto do item c do ASO quando há declaração vigente (NR-7 7.5.19.1 c: riscos "ou a ausência deles"). */
export const RISK_ABSENCE_STATEMENT =
  "Inexistência de riscos ocupacionais que exijam controle médico específico, conforme declaração do profissional responsável pela validação dos riscos do PGR.";

export const riskAbsenceInputSchema = z
  .object({
    sourceId: requiredUuid("Fonte de riscos inválida."),
    gesId: requiredUuid("GES inválido."),
    // Função cadastrada (id) vinculada ao GES; vazio/ausente = vale para o grupo todo (NOB-112).
    jobRoleId: optionalUuidWith("Função inválida."),
    // Texto livre não identifica a função (renomear quebrava a declaração): recusado com a dica.
    jobRole: z
      .never({
        error:
          "Informe a função pelo identificador (jobRoleId), escolhida entre as funções vinculadas ao GES.",
      })
      .optional(),
    justification: z
      .string({ error: "Escreva a justificativa da declaração." })
      .trim()
      .min(
        RISK_ABSENCE_JUSTIFICATION_MIN,
        `Justificativa: mínimo de ${RISK_ABSENCE_JUSTIFICATION_MIN} caracteres.`,
      )
      .max(
        RISK_ABSENCE_JUSTIFICATION_MAX,
        `Justificativa: máximo de ${RISK_ABSENCE_JUSTIFICATION_MAX.toLocaleString("pt-BR")} caracteres.`,
      ),
  })
  .strict();

export type RiskAbsenceValues = z.output<typeof riskAbsenceInputSchema>;

/**
 * A função declarada precisa ser uma função cadastrada e vinculada ao GES escolhido, identificada
 * pelo id (NOB-112/NOB-156): texto livre com erro de digitação era gravado e nunca valia no ASO, e
 * o título mudava com a renomeação. `gesJobRoles` = funções do GES na empresa e no tenant
 * (`ges_job_roles`). Sem id = grupo todo. A saída traz o id e o título atual, que fica gravado
 * como texto histórico da declaração.
 */
export function riskAbsenceJobRoleSchema(
  gesJobRoles: readonly { jobRoleId: string; title: string }[],
) {
  return z
    .object({ jobRoleId: z.string().optional() })
    .superRefine((value, ctx) => {
      if (!value.jobRoleId) return;
      if (!gesJobRoles.some((r) => r.jobRoleId === value.jobRoleId))
        ctx.addIssue({
          code: "custom",
          path: ["jobRoleId"],
          message:
            "Função não encontrada entre as funções cadastradas e vinculadas a este GES. Escolha uma função do GES ou deixe em branco para o grupo todo.",
        });
    })
    .transform((value) => {
      const role = value.jobRoleId
        ? gesJobRoles.find((r) => r.jobRoleId === value.jobRoleId)
        : undefined;
      return { jobRoleId: role?.jobRoleId ?? null, jobRole: role?.title ?? "" };
    });
}

const norm = (value: string | null | undefined) =>
  (value ?? "").trim().toLocaleLowerCase("pt-BR");

export type RiskScope = {
  gesId: string | null;
  gesName: string | null;
  jobRole: string | null;
};

/**
 * O risco da fonte se aplica ao GES/função? Fonte interna casa pelo GES de origem; externa, pelo
 * nome do grupo. Função vazia no risco vale para o grupo todo. Mesma regra do ASO.
 */
export function riskMatchesScope(
  content: { exposureGroup: string; jobRole?: string; originGesId?: string },
  scope: RiskScope,
): boolean {
  const sameGroup = content.originGesId
    ? content.originGesId === scope.gesId
    : norm(content.exposureGroup) !== "" &&
      norm(content.exposureGroup) === norm(scope.gesName);
  const sameRole =
    !norm(content.jobRole) || norm(content.jobRole) === norm(scope.jobRole);
  return sameGroup && sameRole;
}

/** A versão da fonte serve de base (vigente e atual, ou referência externa)? */
export function sourceIsLive(source: {
  superseded: boolean;
  freshness: SourceFreshness;
}): boolean {
  return (
    !source.superseded &&
    (source.freshness === "current" || source.freshness === "external_reference")
  );
}

export type DeclarableSource = {
  superseded: boolean;
  freshness: SourceFreshness;
  risks: {
    status: MedicalRiskStatus;
    content: { exposureGroup: string; jobRole?: string; originGesId?: string };
  }[];
};

/**
 * Motivo que impede declarar a inexistência, ou `null` se pode. A fonte precisa estar vigente, e
 * não pode haver risco pendente ou validado para o escopo. Para o grupo todo (função vazia),
 * qualquer risco de qualquer função do grupo impede.
 */
export function declarationBlocker(
  source: DeclarableSource,
  scope: { gesId: string; gesName: string; jobRole: string },
): string | null {
  if (!sourceIsLive(source))
    return "A fonte de riscos foi substituída, mudou em relação ao PGR ou está indisponível. Declare sobre a versão vigente.";
  const conflicting = source.risks.filter((risk) => {
    if (risk.status === "rejected") return false;
    if (!scope.jobRole) return riskMatchesScope({ ...risk.content, jobRole: "" }, scope);
    return riskMatchesScope(risk.content, scope);
  });
  if (conflicting.some((risk) => risk.status === "pending"))
    return "Há riscos pendentes de validação para este grupo/função nesta fonte. Valide ou rejeite antes de declarar.";
  if (conflicting.length > 0)
    return "Há riscos validados para este grupo/função nesta fonte: a inexistência não pode ser declarada.";
  return null;
}

export type RiskAbsenceDeclarationView = {
  id: string;
  sourceId: string;
  gesId: string;
  exposureGroup: string;
  /** Título da função no momento da declaração (texto histórico); vazio = grupo todo. */
  jobRole: string;
  /** Função cadastrada declarada; `null` no grupo todo e nas declarações antigas só com texto. */
  jobRoleId: string | null;
  /** Título atual da função declarada (renomeada depois?); `null` sem id ou função excluída. */
  currentJobRole: string | null;
  justification: string;
  declaredBy: string;
  declaredByName: string | null;
  declaredAt: string;
};

export type ApplicableRiskAbsence = {
  declarationId: string;
  source: { id: string; title: string; version: string };
  exposureGroup: string;
  jobRole: string;
  declaredByName: string | null;
  declaredAt: string;
};

/** Funcionário visto pela declaração: GES, função cadastrada e funções vinculadas hoje ao GES. */
export type RiskAbsenceEmployee = {
  gesId: string | null;
  jobRoleId: string | null;
  /** Ids das funções vinculadas hoje ao GES do funcionário (`ges_job_roles`). */
  gesJobRoleIds: readonly string[];
};

/** Declaração antiga, só com o título, sem vínculo inequívoco com a função cadastrada. */
const isLegacy = (d: RiskAbsenceDeclarationView) => d.jobRole !== "" && !d.jobRoleId;

/**
 * A declaração alcança a função do funcionário? Grupo todo (sem função) sempre. Com função, pelo
 * id (NOB-112): a mesma função cadastrada do funcionário, ainda vinculada ao GES da declaração.
 * Renomear a função não muda nada; trocar o funcionário de função, ou desvincular a função do GES,
 * tira a cobertura. Declaração antiga só com texto nunca alcança (regularização: declarar de novo).
 */
function declarationCoversEmployee(
  d: RiskAbsenceDeclarationView,
  employee: RiskAbsenceEmployee,
) {
  if (d.jobRole === "" && !d.jobRoleId) return true;
  if (!d.jobRoleId) return false;
  return (
    d.jobRoleId === employee.jobRoleId && employee.gesJobRoleIds.includes(d.jobRoleId)
  );
}

type LiveSource = { id: string; superseded: boolean; freshness: SourceFreshness };

/** Declarações da fonte vigente, do GES do funcionário. */
function liveGesDeclarations(
  declarations: RiskAbsenceDeclarationView[],
  sources: LiveSource[],
  employee: RiskAbsenceEmployee,
) {
  if (!employee.gesId) return [];
  const live = new Set(sources.filter(sourceIsLive).map((s) => s.id));
  return declarations.filter((d) => live.has(d.sourceId) && d.gesId === employee.gesId);
}

/**
 * Declaração que vale para o ASO do funcionário: da fonte vigente, do GES do funcionário, para a
 * função dele (pelo id, ainda vinculada ao GES) ou para o grupo todo. A mais recente prevalece.
 * Fonte substituída → não vale. Nada é associado por semelhança de texto.
 */
export function applicableRiskAbsence(
  declarations: RiskAbsenceDeclarationView[],
  sources: {
    id: string;
    title: string;
    version: string;
    superseded: boolean;
    freshness: SourceFreshness;
  }[],
  employee: RiskAbsenceEmployee,
): ApplicableRiskAbsence | null {
  const match = liveGesDeclarations(declarations, sources, employee)
    .filter((d) => declarationCoversEmployee(d, employee))
    .sort((a, b) => b.declaredAt.localeCompare(a.declaredAt))[0];
  if (!match) return null;
  const source = sources.find((s) => s.id === match.sourceId)!;
  return {
    declarationId: match.id,
    source: { id: source.id, title: source.title, version: source.version },
    exposureGroup: match.exposureGroup,
    jobRole: match.jobRole,
    declaredByName: match.declaredByName,
    declaredAt: match.declaredAt,
  };
}

export type RiskAbsenceMismatch = {
  /** Declarações vigentes do GES para outras funções cadastradas (título atual). */
  otherJobRoles: string[];
  /** Declarações antigas só com texto, sem vínculo inequívoco: exigem nova declaração. */
  legacyJobRoles: string[];
  /** Há declaração para a função do funcionário, mas ela não está mais vinculada ao GES. */
  jobRoleUnlinked: boolean;
};

/**
 * Por que as declarações vigentes do GES do funcionário não valem para ele: só para explicar o
 * bloqueio do ASO. Não muda o que vale.
 */
export function riskAbsenceMismatch(
  declarations: RiskAbsenceDeclarationView[],
  sources: LiveSource[],
  employee: RiskAbsenceEmployee,
): RiskAbsenceMismatch {
  const notCovering = liveGesDeclarations(declarations, sources, employee).filter(
    (d) => !declarationCoversEmployee(d, employee),
  );
  const unique = (values: string[]) => [...new Set(values)];
  return {
    otherJobRoles: unique(
      notCovering
        .filter((d) => !!d.jobRoleId && d.jobRoleId !== employee.jobRoleId)
        .map((d) => d.currentJobRole ?? d.jobRole),
    ),
    legacyJobRoles: unique(notCovering.filter(isLegacy).map((d) => d.jobRole)),
    jobRoleUnlinked: notCovering.some(
      (d) => !!d.jobRoleId && d.jobRoleId === employee.jobRoleId,
    ),
  };
}
