import type { QuestionStat } from "./derivation";

export const MIN_PSYCHOSOCIAL_GROUP_SIZE = 5;

export type ProtectedQuestionStat = QuestionStat & { suppressed: boolean };

export function isGroupLargeEnough(responseCount: number): boolean {
  return responseCount >= MIN_PSYCHOSOCIAL_GROUP_SIZE;
}

export function protectQuestionStat(stat: QuestionStat): ProtectedQuestionStat {
  if (isGroupLargeEnough(stat.responseCount)) return { ...stat, suppressed: false };
  return { ...stat, average: null, suppressed: true };
}
