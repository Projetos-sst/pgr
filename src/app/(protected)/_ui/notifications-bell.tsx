"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { listNotificationsAction } from "@/shared/server/actions/platform/notifications";

import { NOTIFICATIONS_READ_KEY } from "../notifications/_components/use-read-notifications";

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
      href="/notifications"
      className="text-text-muted hover:text-text rounded-card relative px-3 py-1.5 font-semibold transition-colors"
    >
      Notificações
      {unread > 0 ? (
        <span className="rounded-pill ml-1 bg-red-500 px-1.5 py-0.5 text-xs font-semibold text-white">
          {unread}
        </span>
      ) : null}
    </Link>
  );
}
