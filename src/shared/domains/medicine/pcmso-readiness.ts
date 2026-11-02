import type { ExamProposal } from "./exam-proposal";

/**
 * Conferência dos dados do PCMSO antes da geração (NOB-148), espelho da conferência do PGR
 * (NOB-105). Só lê: não gera, não aprova e não assina. Três situações por item:
 * - `blocking`: falta dado que já existe no sistema (corrigível pelo escritório);
 * - `warning`: o PCMSO pode seguir, mas o responsável precisa saber;
 * - `not_available`: a etapa ainda não existe no PGR-e — nunca é simulada e impede a geração.
 * Referências conferidas na NR-7 (Portaria MTP nº 567/2022) e no Word do Dr. Alcides (MED-08).
 */
export type PcmsoReadinessSeverity = "blocking" | "warning" | "not_available";

export type PcmsoReadinessItem = {
  code: string;
  severity: PcmsoReadinessSeverity;
  message: string;
  reference: string;
  href: string | null;
};

export type PcmsoReadinessInput = {
  companyId: string;
  company: {
    razaoSocial: string | null;
    cnpj: string | null;
    cnae: string | null;
    mainActivity: string | null;
    riskGrade: number | null;
  };
  activeEmployees: number;
  coordinator: {
    medicoName: string;
    rqe: string | null;
    rqeExceptionReason: string | null;
  } | null;
  proposal: ExamProposal;
  /** Riscos utilizáveis no PCMSO (validados, fonte vigente), com o possível agravo do PGR. */
  usableRisks: { description: string; possibleInjuries: string | null }[];
  activePhysicians: number;
};

export type PcmsoReadiness = {
  ready: boolean;
  items: PcmsoReadinessItem[];
  counts: Record<PcmsoReadinessSeverity, number>;
};

export function checkPcmsoReadiness(input: PcmsoReadinessInput): PcmsoReadiness {
  const items: PcmsoReadinessItem[] = [];
  const add = (
    code: string,
    severity: PcmsoReadinessSeverity,
    message: string,
    reference: string,
    href: string | null,
  ) => items.push({ code, severity, message, reference, href });
  const company = `/companies/${input.companyId}/edit`;
  const risks = `/companies/${input.companyId}/medical-risks`;
  const coordinator = `/companies/${input.companyId}/pcmso-coordinator`;
  const proposal = `/companies/${input.companyId}/exam-proposal`;
  const { company: c, proposal: p } = input;

  if (!c.razaoSocial?.trim() || !c.cnpj?.trim())
    add(
      "company_identity",
      "blocking",
      "Informe a razão social e o CNPJ da empresa.",
      "MED-08",
      company,
    );
  if (!c.cnae?.trim())
    add("company_cnae", "blocking", "Informe o CNAE da empresa.", "MED-08", company);
  if (!c.mainActivity?.trim())
    add(
      "company_activity",
      "blocking",
      "Informe o ramo de atividade da empresa.",
      "MED-08",
      company,
    );
  if (c.riskGrade == null)
    add(
      "company_risk_grade",
      "blocking",
      "Informe o grau de risco da empresa.",
      "MED-08",
      company,
    );
  if (input.activeEmployees === 0)
    add(
      "employees",
      "warning",
      "Nenhum funcionário ativo cadastrado: o cronograma nominal de exames ficaria vazio.",
      "MED-08, MED-14",
      "/employees",
    );

  if (!input.coordinator)
    add(
      "coordinator",
      "blocking",
      "Designe o médico responsável pelo PCMSO da empresa.",
      "NR-7 7.4.1 c",
      coordinator,
    );
  else if (!input.coordinator.rqe)
    add(
      "coordinator_rqe",
      "warning",
      `Coordenador sem RQE em Medicina do Trabalho, designado pela exceção do item 7.5.2: ${input.coordinator.rqeExceptionReason ?? "justificativa não informada"}.`,
      "NR-7 7.5.2",
      coordinator,
    );

  if (!p.basis.length)
    add(
      "risk_source",
      "blocking",
      "Registre a fonte de riscos do PGR (da plataforma ou externo).",
      "NR-7 7.5.1",
      risks,
    );
  else if (!input.usableRisks.length)
    add(
      "validated_risks",
      "blocking",
      "Nenhum risco validado em fonte vigente. Isso não comprova ausência de riscos: conclua a validação técnica.",
      "NR-7 7.5.1; MED-09",
      risks,
    );
  if (p.excluded.outdated.length)
    add(
      "outdated_source",
      "blocking",
      `${p.excluded.outdated.length} risco(s) validado(s) em fonte que mudou ou ficou indisponível. Registre a nova versão do PGR e valide de novo.`,
      "NR-7 7.5.5; SEG-21",
      risks,
    );
  if (p.excluded.pending.length)
    add(
      "pending_risks",
      "warning",
      `${p.excluded.pending.length} risco(s) pendente(s) de validação técnica não entram no PCMSO.`,
      "NR-7 7.5.1",
      risks,
    );
  const withoutInjury = input.usableRisks.filter(
    (r) => !r.possibleInjuries?.trim(),
  ).length;
  if (withoutInjury)
    add(
      "possible_injuries",
      "warning",
      `${withoutInjury} risco(s) validado(s) sem possível agravo à saúde informado no PGR.`,
      "NR-7 7.5.4 a",
      risks,
    );
  const withoutRule = p.groups.reduce((n, g) => n + g.withoutRule.length, 0);
  if (withoutRule)
    add(
      "risks_without_rule",
      "warning",
      `${withoutRule} risco(s) sem regra automática de exame: o coordenador define os exames.`,
      "NR-7 7.5.4 b; MED-15",
      proposal,
    );

  if (input.activePhysicians === 0)
    add(
      "examiners",
      "blocking",
      "Cadastre ao menos um médico ativo para os exames (nome e CRM no PCMSO).",
      "MED-08; NR-7 7.5.4 d",
      "/medicos",
    );

  add(
    "exam_plan",
    "not_available",
    "Plano de exames aprovado pelo coordenador: o sistema só tem a proposta a partir dos riscos; a revisão e a aprovação médica ainda não existem.",
    "NR-7 7.5.4 b; MED-15",
    proposal,
  );
  add(
    "interpretation_criteria",
    "not_available",
    "Critérios de interpretação e condutas para os achados dos exames: definição do médico, ainda sem cadastro no sistema.",
    "NR-7 7.5.4 c",
    null,
  );
  add(
    "clinics",
    "not_available",
    "Clínicas que executam os exames complementares: cadastro de clínicas ainda não existe.",
    "MED-08; MED-04",
    null,
  );
  add(
    "health_campaigns",
    "not_available",
    "Ações e campanhas de saúde do programa: ainda sem registro no sistema.",
    "MED-08",
    null,
  );
  add(
    "analytical_report",
    "not_available",
    "Relatório analítico do programa: depende dos exames do período e ainda não é gerado.",
    "NR-7 7.5.4 e; 7.6.2",
    null,
  );

  const counts = { blocking: 0, warning: 0, not_available: 0 };
  for (const item of items) counts[item.severity] += 1;
  return { ready: counts.blocking === 0 && counts.not_available === 0, items, counts };
}
