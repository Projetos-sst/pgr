import {
  classifyDocumentValidity,
  type DocumentValidityStatus,
} from "@/shared/domains/documents/validity";
import {
  examBadge,
  type ExamBadge,
  type HealthExamListItem,
} from "@/shared/domains/pgr/health-exams";

import { EXAM_VALIDITY_LABELS } from "./overview";

export type ExamTimelineItem = HealthExamListItem & {
  validity: DocumentValidityStatus;
  validityLabel: string;
  badge: ExamBadge;
};

/**
 * Linha do tempo de exames da ficha do funcionário: preserva a ordem do servidor
 * (mais recente primeiro) e acrescenta a validade INFORMADA classificada + o badge
 * de `examBadge` (mesmas fronteiras de `/health-exams`). Sem periodicidade calculada.
 */
export function toExamTimeline(
  rows: HealthExamListItem[],
  opts: { today: string; dueWindowDays: number },
): ExamTimelineItem[] {
  return rows.map((row) => {
    const validity = classifyDocumentValidity(row.validUntil, opts);
    return {
      ...row,
      validity,
      validityLabel: EXAM_VALIDITY_LABELS[validity],
      badge: examBadge(row.validUntil, row.aptitude, opts),
    };
  });
}
