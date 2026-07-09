/**
 * `fetch` com timeout via AbortController, traduzido num resultado fechado. Uma
 * falha externa nunca vira exceção que atravesse a camada — vira `timeout` ou
 * `upstream_error`, para o serviço/rota decidir o status sem `try/catch` espalhado.
 */

const DEFAULT_TIMEOUT_MS = 5000;

// Alguns provedores (BrasilAPI atrás de Cloudflare) respondem 403 ao User-Agent
// padrão do runtime; um UA identificável destrava a resposta.
const USER_AGENT = "sst-manager/1.0 (+https://github.com/Dougladmo/sst-manager)";

export type HttpResult =
  | { ok: true; status: number; body: unknown }
  | { ok: false; reason: "timeout" | "upstream_error" };

export async function fetchJsonWithTimeout(
  url: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<HttpResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { accept: "application/json", "user-agent": USER_AGENT },
    });
    const body = await response.json().catch(() => null);
    return { ok: true, status: response.status, body };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { ok: false, reason: "timeout" };
    }
    return { ok: false, reason: "upstream_error" };
  } finally {
    clearTimeout(timer);
  }
}
