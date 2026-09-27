import type { ConsolidatedEpi, PgrConsolidated } from "./pgr-consolidated";

/**
 * Relação de EPIs do PGR (NR-18, item 18.4.3) — issue #48.
 *
 * **Derivada, nunca digitada**: PGR → GES vinculados → riscos → `epi_risk` →
 * `epi_catalog`. Não existe cadastro paralelo nem cópia persistida da relação; o que
 * aparece na tela e no PDF é exatamente o que está no cadastro de EPI. Um EPI que
 * atende três riscos vira **uma** linha, com os três contextos listados.
 *
 * "Especificação técnica" não é um campo: é o conjunto de dados reais já cadastrados
 * (CA, validade, fabricante, norma, material, tamanho, unidade e vida útil).
 */

/**
 * Janela de "a vencer" do CA, em dias. **Regra que já existia** no projeto (KPI de EPI
 * do dashboard) — reusada em vez de inventar um prazo novo.
 */
export const EPI_CA_DUE_WINDOW_DAYS = 30;

export type EpiCaStatus = "valid" | "due_soon" | "expired" | "no_expiry";

function addDaysIso(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/**
 * Situação do CA a partir da validade cadastrada. Date-only (`YYYY-MM-DD`, comparação
 * lexicográfica), fronteiras inclusivas: vence hoje ainda não está vencido. Validade
 * **não informada** é estado próprio — não vira "válido" nem "vencido".
 */
export function classifyEpiCaValidity(
  caValidUntil: string | null | undefined,
  {
    today,
    dueWindowDays = EPI_CA_DUE_WINDOW_DAYS,
  }: { today: string; dueWindowDays?: number },
): EpiCaStatus {
  if (!caValidUntil) return "no_expiry";
  if (caValidUntil < today) return "expired";
  if (caValidUntil <= addDaysIso(today, dueWindowDays)) return "due_soon";
  return "valid";
}

const CA_STATUS_LABELS: Record<EpiCaStatus, string> = {
  valid: "CA válido",
  due_soon: "CA a vencer",
  expired: "CA vencido",
  no_expiry: "Validade não informada",
};

export function epiCaStatusLabel(status: EpiCaStatus): string {
  return CA_STATUS_LABELS[status];
}

/** Tom do `StatusBadge` — só tons já existentes no kit. */
export function epiCaStatusTone(
  status: EpiCaStatus,
): "green" | "amber" | "red" | "neutral" {
  switch (status) {
    case "valid":
      return "green";
    case "due_soon":
      return "amber";
    case "expired":
      return "red";
    case "no_expiry":
      return "neutral";
  }
}

/** Contexto (risco + GES) que justifica o EPI na relação. */
export type PgrEpiRelationContext = {
  riskId: string;
  riskDescription: string;
  gesId: string;
  gesName: string;
};

export type PgrEpiRelationItem = {
  catalogId: string;
  name: string;
  description: string | null;
  ca: string | null;
  caValidUntil: string | null;
  caStatus: EpiCaStatus;
  manufacturer: string | null;
  norm: string | null;
  material: string | null;
  size: string | null;
  unitOfMeasure: string | null;
  usefulLifeMonths: number | null;
  contexts: PgrEpiRelationContext[];
  /** Nomes dos GES atendidos, sem repetição — atalho de leitura para tela e PDF. */
  gesNames: string[];
};

function firstNonNull<T>(current: T | null, incoming: T | null | undefined): T | null {
  return current ?? incoming ?? null;
}

/**
 * Deriva a relação deduplicada por EPI. Função **pura**: recebe a visão consolidada
 * (que já foi lida em lote) e não faz nenhuma consulta — nada de N+1. A ordenação é
 * por nome (pt-BR), estável.
 */
export function derivePgrEpiRelation(
  data: PgrConsolidated,
  { today }: { today: string },
): PgrEpiRelationItem[] {
  const byCatalog = new Map<string, PgrEpiRelationItem>();

  for (const ges of data.ges) {
    for (const risk of ges.risks) {
      for (const epi of risk.epis) {
        const existing = byCatalog.get(epi.catalogId);
        const context: PgrEpiRelationContext = {
          riskId: risk.id,
          riskDescription: risk.description,
          gesId: ges.id,
          gesName: ges.name,
        };
        if (existing) {
          existing.contexts.push(context);
          mergeSpecs(existing, epi);
          continue;
        }
        byCatalog.set(epi.catalogId, {
          catalogId: epi.catalogId,
          name: epi.name,
          description: epi.description ?? null,
          ca: epi.ca ?? null,
          caValidUntil: epi.caValidUntil ?? null,
          caStatus: classifyEpiCaValidity(epi.caValidUntil, { today }),
          manufacturer: epi.manufacturer ?? null,
          norm: epi.norm ?? null,
          material: epi.material ?? null,
          size: epi.size ?? null,
          unitOfMeasure: epi.unitOfMeasure ?? null,
          usefulLifeMonths: epi.usefulLifeMonths ?? null,
          contexts: [context],
          gesNames: [],
        });
      }
    }
  }

  const items = [...byCatalog.values()];
  for (const item of items) {
    item.gesNames = [...new Set(item.contexts.map((c) => c.gesName))];
  }
  return items.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

/**
 * O mesmo item de catálogo aparece uma vez por risco; os campos técnicos vêm todos da
 * mesma linha de `epi_catalog`, então completar o que estiver vazio é idempotente e
 * nunca mistura dados de itens diferentes.
 */
function mergeSpecs(item: PgrEpiRelationItem, epi: ConsolidatedEpi): void {
  item.description = firstNonNull(item.description, epi.description);
  item.ca = firstNonNull(item.ca, epi.ca);
  item.manufacturer = firstNonNull(item.manufacturer, epi.manufacturer);
  item.norm = firstNonNull(item.norm, epi.norm);
  item.material = firstNonNull(item.material, epi.material);
  item.size = firstNonNull(item.size, epi.size);
  item.unitOfMeasure = firstNonNull(item.unitOfMeasure, epi.unitOfMeasure);
  item.usefulLifeMonths = firstNonNull(item.usefulLifeMonths, epi.usefulLifeMonths);
}

/** "Material · Tamanho M · un · 12 meses" — só o que existe, sem placeholder. */
export function formatEpiSpecs(item: PgrEpiRelationItem): string | null {
  const parts = [
    item.material,
    item.size ? `Tam. ${item.size}` : null,
    item.unitOfMeasure,
    item.usefulLifeMonths != null
      ? `${item.usefulLifeMonths} mês(es) de vida útil`
      : null,
  ].filter((part): part is string => Boolean(part && part.trim()));
  return parts.length ? parts.join(" · ") : null;
}

/** Aviso fixo da tela/PDF: a fonte é o cadastro, não uma digitação da relação. */
export const EPI_RELATION_SOURCE_NOTE =
  "Dados derivados do cadastro de EPIs vinculado aos riscos do PGR.";

/** Estado honesto quando o PGR não tem nenhum EPI vinculado aos seus riscos. */
export const EPI_RELATION_EMPTY_LABEL = "Nenhum EPI vinculado aos riscos deste PGR.";
