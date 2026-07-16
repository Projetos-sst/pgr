"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { listNotificationsAction } from "@/shared/server/actions/platform/notifications";

import { NOTIFICATIONS_READ_KEY } from "../notificacoes/_components/use-read-notifications";

function loadReadKeys(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(NOTIFICATIONS_READ_KEY) ?? "[]"));
  } catch {
    return new Set();
  }
}

export function NotificationsBell() {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let active = true;
    listNotificationsAction().then((result) => {
      if (!active || !result.ok) return;
      const read = loadReadKeys();
      setUnread(result.data.filter((n) => !read.has(n.key)).length);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <Link
      href="/notificacoes"
      className="relative rounded-md px-3 py-1.5 font-medium text-zinc-700 transition-colors hover:bg-black/5 dark:text-zinc-300 dark:hover:bg-white/5"
    >
      Notificações
      {unread > 0 ? (
        <span className="ml-1 rounded-full bg-red-500 px-1.5 py-0.5 text-xs font-medium text-white">
          {unread}
        </span>
      ) : null}
    </Link>
  );
}
