const RISK_LABEL_MAX_LENGTH = 60;

/** Rótulo curto do risco para telas de retorno/vínculo (ex.: anexo do GED). */
export function riskShortLabel(description: string): string {
  return description.length > RISK_LABEL_MAX_LENGTH
    ? `${description.slice(0, RISK_LABEL_MAX_LENGTH - 1)}…`
    : description;
}
