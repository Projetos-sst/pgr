/**
 * Cache in-memory com TTL para respostas de integração. Deduplica chamadas em
 * sequência rápida sem acoplar a camada ao runtime do Next (testável e
 * determinístico). Só entram resultados de sucesso — falha/`not_found` não é
 * cacheada, para não "congelar" um erro transitório. O `Cache-Control` no route
 * handler complementa com dedup no navegador/CDN.
 */

type Entry<T> = { data: T; expiresAt: number };

export class TtlCache<T> {
  private readonly store = new Map<string, Entry<T>>();

  constructor(private readonly ttlMs: number) {}

  get(key: string, now: number = Date.now()): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= now) {
      this.store.delete(key);
      return undefined;
    }
    return entry.data;
  }

  set(key: string, data: T, now: number = Date.now()): void {
    this.store.set(key, { data, expiresAt: now + this.ttlMs });
  }

  clear(): void {
    this.store.clear();
  }
}
