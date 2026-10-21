import type { PgrConsolidated } from "./pgr-consolidated";
import type { PgrDocxExtras } from "./pgr-docx/from-consolidated";
import { classify, type ClassificationBand } from "./methodology";
import { isValidCnpj } from "./cnpj";
export type PgrReadinessIssue = {
  code: string;
  severity: "blocking" | "warning";
  message: string;
  href: string;
  context: string;
};
/** Software consistency checks, not legal requirements or a technical opinion. */
export function checkPgrReadiness(
  data: PgrConsolidated,
  extras: PgrDocxExtras,
  bands: ClassificationBand[],
) {
  const issues: PgrReadinessIssue[] = [];
  const add = (
    code: string,
    message: string,
    context: string,
    href: string,
    severity: "blocking" | "warning" = "blocking",
  ) => issues.push({ code, message, context, href, severity });
  const main = `/pgr/${data.pgr.id}`;
  if (!data.pgr.companyName.trim())
    add("company_name", "Informe a razão social.", "Empresa", main);
  if (!data.pgr.company?.cnpj || !isValidCnpj(data.pgr.company.cnpj))
    add("company_cnpj", "Confira o CNPJ da empresa.", "Empresa", main);
  if (!data.pgr.responsible?.trim())
    add("responsible", "Informe o responsável pelo documento.", "Identificação", main);
  if (
    data.pgr.registrationType !== "not_applicable" &&
    !data.pgr.registrationNumber?.trim()
  )
    add(
      "registration",
      "Informe o registro declarado do responsável ou revise o tipo informado.",
      "Identificação",
      main,
    );
  if (!data.pgr.issuedAt || !data.pgr.validUntil)
    add(
      "validity",
      "Informe as datas de início e fim da vigência.",
      "Identificação",
      main,
    );
  else if (data.pgr.validUntil < data.pgr.issuedAt)
    add("validity_order", "A vigência termina antes de começar.", "Identificação", main);
  if (!data.ges.length)
    add("no_ges", "Vincule os ambientes/GES ao documento.", "Inventário", main);
  for (const group of data.ges) {
    const extra = extras.ges[group.id];
    const href = `/ges/${group.id}/edit`;
    if (!extra?.processDescription?.trim())
      add(
        "process_description",
        "Descreva o processo observado neste ambiente.",
        group.name,
        href,
      );
    if (!extra?.jobRoles.length)
      add("no_job_roles", "Vincule as funções ao GES.", group.name, href);
    if (!group.risks.length)
      add(
        "no_risks",
        "Sem riscos cadastrados. A ausência precisa ser conferida por quem realiza o levantamento.",
        group.name,
        href,
        "warning",
      );
    for (const risk of group.risks) {
      const rHref = `/risks/${risk.id}/edit`;
      const context = `${group.name} — ${risk.description}`;
      if (!risk.hazard?.trim() || !risk.sources?.trim() || !risk.possibleInjuries?.trim())
        add(
          "risk_description",
          "Complete perigo, fontes geradoras e possíveis lesões informadas.",
          context,
          rHref,
        );
      const assessment = risk.assessment;
      if (!assessment) {
        add("assessment_missing", "Registre a avaliação do risco.", context, rHref);
        continue;
      }
      if (
        assessment.probability < 1 ||
        assessment.probability > 5 ||
        assessment.severity < 1 ||
        assessment.severity > 5 ||
        assessment.riskLevel !== assessment.probability * assessment.severity ||
        risk.riskLevel !== assessment.riskLevel
      )
        add(
          "assessment_inconsistent",
          "Probabilidade, severidade e nível calculado estão inconsistentes.",
          context,
          rHref,
        );
      const expected = classify(assessment.riskLevel, bands);
      if (risk.result !== expected)
        add(
          "classification_changed",
          "A classificação não corresponde à metodologia atual. Revise a avaliação.",
          context,
          rHref,
        );
      if (
        assessment.criterion === "quantitative" &&
        (assessment.measuredValue == null ||
          !assessment.measuredUnit ||
          !assessment.evaluationMethod?.trim())
      )
        add(
          "measurement_incomplete",
          "Complete valor, unidade e método da avaliação quantitativa.",
          context,
          rHref,
        );
      if (risk.planCoverage === "no_measure" || risk.planCoverage === "incomplete")
        add(
          "plan_incomplete",
          "Confira as medidas e os campos pendentes do plano de ação.",
          context,
          rHref,
        );
    }
  }
  for (const machine of extras.machines ?? [])
    if (!machine.safetyMeasures?.trim())
      add(
        "machine_safety_missing",
        "Informações de segurança ainda não foram registradas.",
        machine.catalogName,
        main,
        "warning",
      );
  return {
    ready: !issues.some((i) => i.severity === "blocking"),
    issues,
    blockingCount: issues.filter((i) => i.severity === "blocking").length,
    warningCount: issues.filter((i) => i.severity === "warning").length,
    notice:
      "Conferência de preenchimento e consistência. Não substitui parecer técnico, assinatura ou verificação de conformidade.",
  };
}
