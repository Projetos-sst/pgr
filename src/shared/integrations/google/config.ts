import "server-only";

/**
 * Configuração da Service Account do Google (Drive + Docs) — server-only, segredos só
 * em env (mesmo contrato do Salesbud: `GOOGLE_SERVICE_ACCOUNT_JSON` +
 * `GOOGLE_SERVICE_ACCOUNT_USER_SUBJECT`). Ausente → integração desligada (`null`); o
 * PGR em DOCX continua funcionando com o Gotenberg.
 */
export type GoogleServiceAccountCredentials = {
  client_email: string;
  private_key: string;
  [key: string]: unknown;
};

export type GoogleDocsConfig = {
  credentials: GoogleServiceAccountCredentials;
  /** Usuário do Workspace personificado (domain-wide delegation). Opcional. */
  subject: string | null;
  /** Pasta do Drive (ou Shared Drive) onde os arquivos temporários são criados. */
  folderId: string | null;
};

/** Aceita o JSON cru ou em base64 (mais fácil de colar em painel de env). */
export function parseServiceAccountJson(raw: string): GoogleServiceAccountCredentials {
  const trimmed = raw.trim();
  const json = trimmed.startsWith("{")
    ? trimmed
    : Buffer.from(trimmed, "base64").toString("utf8");
  const parsed = JSON.parse(json) as Partial<GoogleServiceAccountCredentials>;
  if (!parsed.client_email || !parsed.private_key) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON sem client_email/private_key");
  }
  return parsed as GoogleServiceAccountCredentials;
}

export function getGoogleDocsConfig(): GoogleDocsConfig | null {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) return null;
  return {
    credentials: parseServiceAccountJson(raw),
    subject: process.env.GOOGLE_SERVICE_ACCOUNT_USER_SUBJECT?.trim() || null,
    folderId: process.env.PGR_DOCX_DRIVE_FOLDER_ID?.trim() || null,
  };
}

export function isGoogleDocsEnabled(): boolean {
  return Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim());
}
