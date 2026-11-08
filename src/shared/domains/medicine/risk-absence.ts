/**
 * Declaração de inexistência de riscos (NOB-156, DT-12, MED-09). Regras puras:
 * - quando a declaração pode ser feita;
 * - quando ela vale para o ASO de um funcionário.
 * Ausência de cadastro nunca vira inexistência: só a declaração explícita do profissional
 * autorizado, presa à versão da fonte, conta.
 */
import { z } from "zod";

import { requiredUuid } from "@/shared/domains/pgr/form-fields";

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
    // Vazio = vale para o grupo todo.
    jobRole: z
      .string()
      .trim()
      .max(200, "Função: máximo de 200 caracteres.")
      .optional()
      .transform((value) => value ?? ""),
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
 * A função declarada precisa identificar exatamente uma função cadastrada e vinculada ao GES
 * escolhido (NOB-112/NOB-156): texto livre com erro de digitação era gravado e nunca valia no ASO.
 * Comparação por identidade exata do título (caixa, acento e abreviação contam): o cadastro de funções
 * distingue "Operador" de "OPERADOR", então juntar variações misturaria funções diferentes.
 * Vazio = grupo todo, sem conferência. `gesJobRoleTitles` = títulos das funções do GES na empresa.
 */
export function riskAbsenceJobRoleSchema(gesJobRoleTitles: readonly string[]) {
  return z.object({ jobRole: z.string() }).superRefine((value, ctx) => {
    if (value.jobRole === "") return;
    const matches = gesJobRoleTitles.filter((title) => title === value.jobRole).length;
    if (matches === 0)
      ctx.addIssue({
        code: "custom",
        path: ["jobRole"],
        message:
          "Função não encontrada entre as funções cadastradas e vinculadas a este GES. Escolha uma função do GES ou deixe em branco para o grupo todo.",
      });
    else if (matches > 1)
      ctx.addIssue({
        code: "custom",
        path: ["jobRole"],
        message:
          "Há mais de uma função com este nome vinculada a este GES; a declaração não identifica uma função só. Corrija o cadastro das funções antes de declarar.",
      });
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
  jobRole: string;
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

/** A declaração alcança a função do funcionário? Vazia = grupo todo; senão, título idêntico. */
function declarationCoversJobRole(declared: string, employeeJobRole: string | null) {
  return !declared || declared === employeeJobRole;
}

/**
 * Declaração que vale para o ASO do funcionário: da fonte vigente, do GES do funcionário, para a
 * função dele ou para o grupo todo. A mais recente prevalece. Fonte substituída → não vale.
 * A função casa por identidade exata do título cadastrado (NOB-112): declaração antiga com texto
 * que não é exatamente o título da função do funcionário (abreviação, erro de digitação, outra
 * caixa) não vale e o ASO continua bloqueado; nada é associado automaticamente.
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
  employee: { gesId: string | null; jobRole: string | null },
): ApplicableRiskAbsence | null {
  if (!employee.gesId) return null;
  const live = new Map(sources.filter(sourceIsLive).map((s) => [s.id, s]));
  const match = declarations
    .filter(
      (d) =>
        live.has(d.sourceId) &&
        d.gesId === employee.gesId &&
        declarationCoversJobRole(d.jobRole, employee.jobRole),
    )
    .sort((a, b) => b.declaredAt.localeCompare(a.declaredAt))[0];
  if (!match) return null;
  const source = live.get(match.sourceId)!;
  return {
    declarationId: match.id,
    source: { id: source.id, title: source.title, version: source.version },
    exposureGroup: match.exposureGroup,
    jobRole: match.jobRole,
    declaredByName: match.declaredByName,
    declaredAt: match.declaredAt,
  };
}

/**
 * Funções das declarações vigentes do GES do funcionário que não casam com a função cadastrada
 * dele: só para explicar ao usuário por que o ASO segue bloqueado. Não muda o que vale.
 */
export function unmatchedRiskAbsenceJobRoles(
  declarations: RiskAbsenceDeclarationView[],
  sources: { id: string; superseded: boolean; freshness: SourceFreshness }[],
  employee: { gesId: string | null; jobRole: string | null },
): string[] {
  if (!employee.gesId) return [];
  const live = new Set(sources.filter(sourceIsLive).map((s) => s.id));
  const roles = declarations
    .filter(
      (d) =>
        live.has(d.sourceId) &&
        d.gesId === employee.gesId &&
        !declarationCoversJobRole(d.jobRole, employee.jobRole),
    )
    .map((d) => d.jobRole);
  return [...new Set(roles)];
}
