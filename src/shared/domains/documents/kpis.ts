import { DOCUMENT_DUE_WINDOW_DAYS } from "./documents";

export type DocumentKpis = {
  documents: number;
  folders: number;
  dueSoon: number;
  expired: number;
};

function addDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/**
 * Fronteiras de data (date-only, comparação lexicográfica) que definem os
 * buckets de validade — **fonte única** reutilizada pelo filtro da listagem e
 * pela contagem de KPIs, para não divergir de `classifyDocumentValidity`
 * (fronteiras INCLUSIVAS: `expired` ⇔ `valid_until < today`; `due_soon` ⇔
 * `today <= valid_until <= dueLimit`; `ok` ⇔ `valid_until > dueLimit`).
 */
export function validityDateBounds(
  today: string,
  dueWindowDays: number = DOCUMENT_DUE_WINDOW_DAYS,
): { today: string; dueLimit: string } {
  return { today, dueLimit: addDays(today, dueWindowDays) };
}

/** Assembla os KPIs do acervo a partir das contagens já apuradas. */
export function computeDocumentKpis(counts: DocumentKpis): DocumentKpis {
  return {
    documents: counts.documents,
    folders: counts.folders,
    dueSoon: counts.dueSoon,
    expired: counts.expired,
  };
}
