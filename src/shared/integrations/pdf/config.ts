import "server-only";

/**
 * Configuração do serviço de PDF (Gotenberg) — server-only. Segredos só em env
 * (Princípio V + emenda 1.4.0). Ausente → geração desabilitada (a fatia entrega
 * a infraestrutura; o serviço é ligado quando existir).
 */
export type GotenbergConfig = { url: string; token: string | null };

export function getGotenbergConfig(): GotenbergConfig | null {
  const url = process.env.GOTENBERG_URL?.trim();
  if (!url) return null;
  return { url, token: process.env.GOTENBERG_TOKEN?.trim() || null };
}

export function isPdfGenerationEnabled(): boolean {
  return getGotenbergConfig() !== null;
}
