"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

export const NOTIFICATIONS_READ_KEY = "sst:notifications:read";
const CHANGE_EVENT = "sst:notifications-read-changed";

function subscribe(callback: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

function getSnapshot(): string {
  return localStorage.getItem(NOTIFICATIONS_READ_KEY) ?? "[]";
}

function getServerSnapshot(): string {
  return "[]";
}

/**
 * Estado de "lido" das notificações via localStorage (per-browser). Usa
 * useSyncExternalStore — o snapshot (string JSON) é estável e evita
 * hydration mismatch (server renderiza vazio; cliente reidrata do storage).
 */
export function useReadNotifications() {
  const json = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const read = useMemo(() => new Set<string>(JSON.parse(json) as string[]), [json]);

  const write = useCallback((keys: string[]) => {
    localStorage.setItem(NOTIFICATIONS_READ_KEY, JSON.stringify(keys));
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  const markRead = useCallback(
    (key: string) => {
      const next = new Set(read);
      next.add(key);
      write([...next]);
    },
    [read, write],
  );

  const markAll = useCallback((keys: string[]) => write(keys), [write]);

  return { read, markRead, markAll };
}
