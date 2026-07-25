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
      title="Notificações"
      className="relative flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-[12px] border border-white/50 bg-white/34 text-[#5b63f5] saturate-[170%] backdrop-blur-[20px] transition-all hover:bg-white/50"
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        aria-hidden="true"
      >
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
      {unread > 0 ? (
        <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow-xs">
          {unread}
        </span>
      ) : null}
    </Link>
  );
}
