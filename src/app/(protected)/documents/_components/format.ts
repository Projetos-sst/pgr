import type { DocumentValidityStatus } from "@/shared/domains/documents/validity";

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`;
}

export function formatIsoDateBr(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}

export function formatMonthYearBr(isoDate: string): string {
  const [year, month] = isoDate.split("-");
  return `${month}/${year}`;
}

export function formatDateTimeBr(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR");
}

export const VALIDITY_LABELS: Record<DocumentValidityStatus, string> = {
  ok: "Válido",
  due_soon: "A vencer",
  expired: "Vencido",
  no_expiry: "Sem validade",
};

export const VALIDITY_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Todos" },
  { value: "ok", label: "Válido" },
  { value: "due_soon", label: "A vencer" },
  { value: "expired", label: "Vencido" },
  { value: "no_expiry", label: "Sem validade" },
];

/**
 * Mensagem amigável para um upload que falhou no TRANSPORTE (corpo maior do que
 * o proxy/Server Action aceitam), não na validação da app (`validateFile`).
 * Nesse caso a Server Action lança em vez de devolver `{ok:false}` (o corpo
 * multipart chega truncado/corrompido) — o `catch` no formulário usa esta
 * mensagem no lugar de deixar a exceção estourar como erro cru na UI.
 */
export const UPLOAD_TRANSPORT_ERROR_MESSAGE =
  "Não foi possível enviar o arquivo — ele excede 25 MB ou a conexão falhou. Verifique o tamanho e tente novamente.";
