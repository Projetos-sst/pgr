/**
 * Regras puras de numeração e derivação temporal da Ordem de Serviço (Fase 06).
 * Sem I/O — a numeração é materializada no repositório sob lock do tenant; aqui só
 * a aritmética pura, testável isoladamente.
 */

const MS_PER_DAY = 86_400_000;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Próximo número da OS no escopo do tenant: `max(number)+1`, começando em 1.
 * O lock (`SELECT ... FOR UPDATE` na linha de `orgs`) e o backstop `UNIQUE(org_id,
 * number)` vivem no repositório; esta função só encapsula a aritmética.
 */
export function nextServiceOrderNumber(currentMax: number | null | undefined): number {
  if (currentMax == null || !Number.isFinite(currentMax) || currentMax < 0) return 1;
  return Math.floor(currentMax) + 1;
}

function parseIsoDateToUtc(value: string): number | null {
  if (!ISO_DATE.test(value)) return null;
  const ms = Date.parse(`${value}T00:00:00Z`);
  return Number.isNaN(ms) ? null : ms;
}

/**
 * `days_open` derivado (nunca persistido, fuso `America/Sao_Paulo` via `today`):
 * dias entre `openedAt` e `closedAt` (se houver) ou `today` enquanto aberta.
 * Nunca negativo (datas invertidas → 0). Datas inválidas → 0 (defensivo).
 */
export function computeDaysOpen(
  openedAt: string,
  closedAt: string | null | undefined,
  today: string,
): number {
  const opened = parseIsoDateToUtc(openedAt);
  if (opened == null) return 0;
  const endSource = closedAt && closedAt.trim() !== "" ? closedAt : today;
  const end = parseIsoDateToUtc(endSource);
  if (end == null) return 0;
  const diff = Math.floor((end - opened) / MS_PER_DAY);
  return Math.max(0, diff);
}
