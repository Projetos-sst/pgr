import {
  canUseMedicalRisk,
  type MedicalRiskSnapshot,
  type MedicalRiskStatus,
  type SourceFreshness,
} from "./risk-sources";
import { getProcedure } from "./procedure-catalog";
import {
  CLINICAL_EXAM_NOTE,
  EXAM_RULES_VERSION,
  rulesForAgent,
  type RuleAgentCode,
} from "./exam-rules";

/**
 * Proposta de exames complementares a partir do inventário de riscos da Medicina
 * (NOB-98) — MED-15: o sistema relaciona os exames aos riscos de cada grupo e o médico
 * coordenador mantém, acrescenta ou retira. É só leitura: nada é aprovado aqui, e só
 * riscos validados de fonte vigente geram sugestão (MED-03 / NOB-98).
 */
export type ProposalSource = {
  id: string;
  kind: "internal" | "external";
  title: string;
  version: string;
  reference: string;
  /** PGR externo (NOB-111): proveniência informada pelo documento. */
  documentDate?: string | null;
  preparedBy?: string | null;
  reviewDueOn?: string | null;
  freshness: SourceFreshness;
  superseded: boolean;
  risks: {
    id: string;
    status: MedicalRiskStatus;
    content: MedicalRiskSnapshot;
    reviewedAt?: string | null;
  }[];
};

export type RiskRef = {
  riskId: string;
  sourceId: string;
  exposureGroup: string;
  jobRole: string | null;
  description: string;
  agentCode: string | null;
};

export type ProposalSuggestion = {
  procedureCode: string;
  procedureDescription: string;
  ruleId: string;
  reference: string;
  condition: string;
  periodicity: string;
  notes: string[];
  triggeredBy: RiskRef[];
};

export type ProposalGroup = {
  exposureGroup: string;
  jobRole: string | null;
  suggestions: ProposalSuggestion[];
  withoutRule: (RiskRef & { reason: string })[];
};

export type ExamProposal = {
  requiresMedicalReview: true;
  rulesVersion: string;
  clinicalExam: typeof CLINICAL_EXAM_NOTE;
  basis: Pick<
    ProposalSource,
    "id" | "kind" | "title" | "version" | "reference" | "freshness"
  >[];
  groups: ProposalGroup[];
  excluded: { pending: RiskRef[]; rejected: RiskRef[]; outdated: RiskRef[] };
  warnings: string[];
};

const NO_CODE_REASON =
  "Sem código de agente nocivo do eSocial (Tabela 24): o coordenador define os exames.";
const NO_RULE_REASON =
  "Sem regra automática para este agente: o coordenador define os exames pela NR-7 e seus Anexos.";

/** Código da Tabela 24 copiado do inventário do PGR interno; fonte externa não traz. */
export function agentCodeOf(content: MedicalRiskSnapshot): string | null {
  // PGR externo (NOB-111): código informado no próprio registro do risco, validado com ele.
  if (content.noxiousAgentCode?.trim()) return content.noxiousAgentCode.trim();
  const inventory = content.originalData?.inventory;
  if (!inventory || typeof inventory !== "object") return null;
  const code = (inventory as Record<string, unknown>).noxious_agent_code;
  return typeof code === "string" && code.trim() ? code.trim() : null;
}

const groupKey = (ref: RiskRef) => `${ref.exposureGroup}\u0000${ref.jobRole ?? ""}`;

export function buildExamProposal(sources: ProposalSource[]): ExamProposal {
  const live = sources.filter((source) => !source.superseded);
  const groups = new Map<string, ProposalGroup>();
  const excluded: ExamProposal["excluded"] = { pending: [], rejected: [], outdated: [] };
  const group = (ref: RiskRef) => {
    const key = groupKey(ref);
    let found = groups.get(key);
    if (!found) {
      found = {
        exposureGroup: ref.exposureGroup,
        jobRole: ref.jobRole,
        suggestions: [],
        withoutRule: [],
      };
      groups.set(key, found);
    }
    return found;
  };

  for (const source of live) {
    for (const risk of source.risks) {
      const ref: RiskRef = {
        riskId: risk.id,
        sourceId: source.id,
        exposureGroup: risk.content.exposureGroup,
        jobRole: risk.content.jobRole?.trim() || null,
        description: risk.content.description,
        agentCode: agentCodeOf(risk.content),
      };
      if (risk.status === "pending") {
        excluded.pending.push(ref);
        continue;
      }
      if (risk.status === "rejected") {
        excluded.rejected.push(ref);
        continue;
      }
      if (!canUseMedicalRisk(risk.status, source.freshness)) {
        excluded.outdated.push(ref);
        continue;
      }
      const target = group(ref);
      const rules = ref.agentCode ? rulesForAgent(ref.agentCode) : [];
      if (!rules.length) {
        target.withoutRule.push({
          ...ref,
          reason: ref.agentCode ? NO_RULE_REASON : NO_CODE_REASON,
        });
        continue;
      }
      for (const rule of rules) {
        const note = rule.agentNotes?.[ref.agentCode as RuleAgentCode];
        let suggestion = target.suggestions.find(
          (item) => item.procedureCode === rule.procedureCode,
        );
        if (!suggestion) {
          const procedure = getProcedure(rule.procedureCode);
          if (!procedure)
            throw new Error(`Regra ${rule.id} aponta código fora da Tabela 27.`);
          suggestion = {
            procedureCode: procedure.code,
            procedureDescription: procedure.description,
            ruleId: rule.id,
            reference: rule.reference,
            condition: rule.condition,
            periodicity: rule.periodicity,
            notes: [],
            triggeredBy: [],
          };
          target.suggestions.push(suggestion);
        }
        if (!suggestion.triggeredBy.some((item) => item.riskId === ref.riskId))
          suggestion.triggeredBy.push(ref);
        if (note && !suggestion.notes.includes(note)) suggestion.notes.push(note);
      }
    }
  }

  const sorted = [...groups.values()]
    .map((item) => ({
      ...item,
      suggestions: item.suggestions.sort((a, b) =>
        a.procedureCode.localeCompare(b.procedureCode),
      ),
    }))
    .sort(
      (a, b) =>
        a.exposureGroup.localeCompare(b.exposureGroup, "pt-BR") ||
        (a.jobRole ?? "").localeCompare(b.jobRole ?? "", "pt-BR"),
    );

  return {
    requiresMedicalReview: true,
    rulesVersion: EXAM_RULES_VERSION,
    clinicalExam: CLINICAL_EXAM_NOTE,
    basis: live.map(({ id, kind, title, version, reference, freshness }) => ({
      id,
      kind,
      title,
      version,
      reference,
      freshness,
    })),
    groups: sorted,
    excluded,
    warnings: proposalWarnings(live, excluded),
  };
}

function proposalWarnings(
  live: ProposalSource[],
  excluded: ExamProposal["excluded"],
): string[] {
  const warnings: string[] = [];
  if (!live.length)
    warnings.push(
      "Nenhuma fonte de riscos registrada para esta empresa. Não há base para propor exames, e isso não significa ausência de riscos.",
    );
  else if (live.every((source) => source.risks.length === 0))
    warnings.push(
      "As fontes vigentes não têm riscos registrados. Isso não comprova ausência de riscos ocupacionais.",
    );
  if (excluded.pending.length)
    warnings.push(
      `${excluded.pending.length} risco(s) pendente(s) de validação técnica não entram na proposta.`,
    );
  if (excluded.outdated.length)
    warnings.push(
      `${excluded.outdated.length} risco(s) validado(s) vêm de fonte desatualizada ou indisponível. Registre a nova versão do PGR e valide de novo.`,
    );
  warnings.push(
    "Proposta assistiva: o médico coordenador revisa, acrescenta ou retira exames. Nada aqui foi aprovado.",
  );
  return warnings;
}
