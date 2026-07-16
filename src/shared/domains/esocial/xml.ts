/**
 * Helpers de montagem de XML dos eventos SST do eSocial. Layout simplificado mas
 * estruturalmente fiel (cabeçalho `ideEvento` + `ideEmpregador` + bloco do
 * evento). Ambiente fixo em **Produção** (`ambientePadrao="Producao"`, `tpAmb=1`).
 */

export const ESOCIAL_AMBIENTE = "Producao";
export const ESOCIAL_VERSAO = "S-1.3";

// Escapa caracteres reservados de XML.
export function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Monta uma tag simples <nome>valor</nome> (valor escapado).
export function tag(name: string, value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  return `<${name}>${xmlEscape(String(value))}</${name}>`;
}

// Envelope do evento: <eSocial><evt... ambientePadrao="Producao"><ideEvento/>...
export function buildEnvelope(
  eventTag: string,
  eventId: string,
  innerXml: string,
): string {
  const ideEvento =
    `<ideEvento>${tag("indRetif", 1)}${tag("tpAmb", 1)}` +
    `${tag("procEmi", 1)}${tag("verProc", "SST-Manager")}</ideEvento>`;
  return (
    `<eSocial xmlns="http://www.esocial.gov.br/schema/evt/${eventTag}/v${ESOCIAL_VERSAO}">` +
    `<${eventTag} Id="${xmlEscape(eventId)}" ambientePadrao="${ESOCIAL_AMBIENTE}">` +
    `${ideEvento}${innerXml}` +
    `</${eventTag}></eSocial>`
  );
}

// Gera um Id de evento no formato eSocial (ID + tpInsc + nrInsc + sequencial).
export function buildEventId(seed: string): string {
  const digits = seed.replace(/\D/g, "").padEnd(8, "0").slice(0, 8);
  return `ID1${digits}${"0".repeat(26).slice(0, 26)}`.slice(0, 36);
}
