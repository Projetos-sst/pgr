"use client";

import Link from "next/link";

import type { AppNotification } from "@/shared/domains/platform/notifications";

import { useReadNotifications } from "./use-read-notifications";

export function NotificationsList({
  notifications,
}: {
  notifications: AppNotification[];
}) {
  const { read, markRead, markAll } = useReadNotifications();
  const unreadCount = notifications.filter((n) => !read.has(n.key)).length;

  if (notifications.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-black/15 px-6 py-12 text-center text-sm text-zinc-500 dark:border-white/15">
        Nenhuma notificação pendente. ✅
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-zinc-500">
          {unreadCount} não lida(s) de {notifications.length}
        </span>
        {unreadCount > 0 ? (
          <button
            type="button"
            onClick={() => markAll(notifications.map((n) => n.key))}
            className="text-sm text-zinc-600 hover:underline dark:text-zinc-400"
          >
            Marcar todas como lidas
          </button>
        ) : null}
      </div>

      <ul className="flex flex-col gap-2">
        {notifications.map((n) => {
          const isRead = read.has(n.key);
          return (
            <li
              key={n.key}
              className={`flex items-start justify-between gap-4 rounded-lg border px-4 py-3 ${
                isRead
                  ? "border-black/10 opacity-60 dark:border-white/10"
                  : "border-black/15 dark:border-white/15"
              }`}
            >
              <Link href={n.href} className="flex flex-col gap-0.5">
                <span className="flex items-center gap-2 text-sm font-medium">
                  {!isRead && n.severity === "high" ? (
                    <span className="h-2 w-2 shrink-0 rounded-full bg-red-500" />
                  ) : null}
                  {n.title}
                </span>
                <span className="text-sm text-zinc-600 dark:text-zinc-400">
                  {n.description}
                </span>
              </Link>
              {!isRead ? (
                <button
                  type="button"
                  onClick={() => markRead(n.key)}
                  className="shrink-0 text-xs text-zinc-500 hover:underline"
                >
                  Marcar como lida
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
