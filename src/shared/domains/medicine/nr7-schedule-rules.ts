/**
 * Sugestões de prazo dos exames ocupacionais conforme a NR-7 (texto oficial
 * "NR-07 atualizada 2022", última alteração pela Portaria MTP n.º 567/2022,
 * consultado em 2026-11-01). MED-19: o sistema SUGERE e o médico confirma ou
 * altera; nada aqui é conclusão médica nem dispensa a avaliação do médico.
 *
 * Regras aprovadas no Word (MED-20) e conferidas na norma:
 * - Regra 2 → NR-7 7.5.11: demissional em até 10 dias do término do contrato;
 *   dispensável se o exame clínico mais recente foi há MENOS de 135 dias (graus
 *   de risco 1 e 2) ou de 90 dias (graus 3 e 4). A observação da MED-19 cita
 *   120 dias para graus 1 e 2; prevalece o texto da norma (MED-EXE-07).
 * - Regra 3 → NR-7 7.5.9: retorno ao trabalho antes de reassumir, quando a
 *   ausência por doença ou acidente for igual ou superior a 30 dias.
 * - NR-7 7.5.8 II: periódico a cada ano (ou menos, a critério do médico) para
 *   expostos a riscos do PGR e portadores de doença crônica que aumente a
 *   susceptibilidade; a cada dois anos para os demais. Exposição hiperbárica
 *   (Anexo IV) fica fora desta função.
 *
 * Datas são strings ISO (AAAA-MM-DD) calculadas em UTC, sem depender do fuso.
 */

export type RiskGrade = 1 | 2 | 3 | 4;

type Suggestion<T> = T & {
  /** Sempre true: a sugestão precisa ser confirmada ou alterada pelo médico. */
  requiresMedicalConfirmation: true;
  reference: string;
};

const DAY_MS = 86_400_000;

function toUtc(iso: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) throw new RangeError(`Data inválida: ${iso}`);
  const time = Date.parse(`${iso}T00:00:00Z`);
  if (Number.isNaN(time) || new Date(time).toISOString().slice(0, 10) !== iso)
    throw new RangeError(`Data inválida: ${iso}`);
  return time;
}

const fromUtc = (time: number) => new Date(time).toISOString().slice(0, 10);

/** Dias corridos de `from` até `to` (to − from). */
export function daysBetween(from: string, to: string): number {
  return Math.round((toUtc(to) - toUtc(from)) / DAY_MS);
}

export function addDays(iso: string, days: number): string {
  return fromUtc(toUtc(iso) + days * DAY_MS);
}

/** Soma meses de calendário; dia inexistente cai no último dia do mês (31/01 + 1 mês → 28/02). */
export function addMonths(iso: string, months: number): string {
  const d = new Date(toUtc(iso));
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
  ).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return fromUtc(d.getTime());
}

export const DISMISSAL_WAIVER_LIMIT_DAYS: Record<RiskGrade, number> = {
  1: 135,
  2: 135,
  3: 90,
  4: 90,
};
export const DISMISSAL_EXAM_DEADLINE_DAYS = 10;
export const RETURN_TO_WORK_MIN_ABSENCE_DAYS = 30;

/**
 * Regra 2 (NR-7 7.5.11). A contagem usa o término do contrato como data de
 * referência (o item fala em exame "realizado há menos de N dias" no contexto
 * do demissional); a interpretação fica registrada e o médico confirma.
 */
export function suggestDismissalExam(input: {
  contractEndOn: string;
  lastClinicalExamOn: string | null;
  riskGrade: RiskGrade | null;
}): Suggestion<{
  deadline: string;
  waivable: boolean | null;
  daysSinceLastClinicalExam: number | null;
  limitDays: number | null;
  reason: string;
}> {
  const deadline = addDays(input.contractEndOn, DISMISSAL_EXAM_DEADLINE_DAYS);
  const base = {
    deadline,
    requiresMedicalConfirmation: true as const,
    reference: "NR-7 7.5.11",
  };
  if (input.riskGrade === null)
    return {
      ...base,
      waivable: null,
      daysSinceLastClinicalExam: null,
      limitDays: null,
      reason:
        "Grau de risco da empresa não informado: não é possível sugerir a dispensa.",
    };
  const limitDays = DISMISSAL_WAIVER_LIMIT_DAYS[input.riskGrade];
  if (input.lastClinicalExamOn === null)
    return {
      ...base,
      waivable: false,
      daysSinceLastClinicalExam: null,
      limitDays,
      reason: "Não há exame clínico ocupacional anterior registrado.",
    };
  const days = daysBetween(input.lastClinicalExamOn, input.contractEndOn);
  if (days < 0)
    return {
      ...base,
      waivable: null,
      daysSinceLastClinicalExam: days,
      limitDays,
      reason: "O último exame é posterior ao término do contrato: confira as datas.",
    };
  const waivable = days < limitDays;
  return {
    ...base,
    waivable,
    daysSinceLastClinicalExam: days,
    limitDays,
    reason: waivable
      ? `Último exame clínico há ${days} dias, menos que ${limitDays} (grau de risco ${input.riskGrade}): o demissional pode ser dispensado, a critério do médico.`
      : `Último exame clínico há ${days} dias, igual ou acima de ${limitDays} (grau de risco ${input.riskGrade}): o demissional é necessário.`,
  };
}

/**
 * Regra 3 (NR-7 7.5.9). `absenceStartOn` e `lastAbsenceDayOn` são o primeiro e
 * o último dia de ausência, inclusive (30 dias = do dia 1 ao dia 30).
 */
export function suggestReturnToWorkExam(input: {
  absenceStartOn: string;
  lastAbsenceDayOn: string;
}): Suggestion<{
  required: boolean;
  absenceDays: number;
  mustBeDoneBefore: string;
  reason: string;
}> {
  const absenceDays = daysBetween(input.absenceStartOn, input.lastAbsenceDayOn) + 1;
  if (absenceDays < 1) throw new RangeError("O fim da ausência é anterior ao início.");
  const required = absenceDays >= RETURN_TO_WORK_MIN_ABSENCE_DAYS;
  return {
    required,
    absenceDays,
    mustBeDoneBefore: addDays(input.lastAbsenceDayOn, 1),
    requiresMedicalConfirmation: true,
    reference: "NR-7 7.5.9",
    reason: required
      ? `Ausência de ${absenceDays} dias (≥ 30): exame de retorno antes de reassumir as funções.`
      : `Ausência de ${absenceDays} dias (< 30): o exame de retorno não é obrigatório pela NR-7 7.5.9.`,
  };
}

/** Estado do levantamento de riscos: "desconhecido" nunca vira "sem riscos" (MED-09). */
export type RiskExposure = "exposed" | "not_exposed" | "unknown";

/** NR-7 7.5.8 II: intervalo máximo sugerido do periódico, em meses. */
export function suggestPeriodicInterval(input: {
  exposure: RiskExposure;
  chronicDiseaseIncreasingSusceptibility?: boolean;
  lastClinicalExamOn: string;
}): Suggestion<{
  maxIntervalMonths: 12 | 24 | null;
  nextDueOn: string | null;
  reason: string;
}> {
  const base = {
    requiresMedicalConfirmation: true as const,
    reference: "NR-7 7.5.8, II",
  };
  if (input.exposure === "exposed" || input.chronicDiseaseIncreasingSusceptibility)
    return {
      ...base,
      maxIntervalMonths: 12,
      nextDueOn: addMonths(input.lastClinicalExamOn, 12),
      reason:
        "Exposto a riscos do PGR ou portador de doença crônica que aumente a susceptibilidade: a cada ano ou em intervalo menor, a critério do médico responsável.",
    };
  if (input.exposure === "not_exposed")
    return {
      ...base,
      maxIntervalMonths: 24,
      nextDueOn: addMonths(input.lastClinicalExamOn, 24),
      reason: "Sem exposição a riscos do PGR declarada: a cada dois anos.",
    };
  return {
    ...base,
    maxIntervalMonths: null,
    nextDueOn: null,
    reason:
      "Levantamento de riscos não concluído: não é possível sugerir a periodicidade nem presumir ausência de riscos.",
  };
}
