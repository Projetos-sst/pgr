"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { deleteScheduleEventAction } from "@/shared/server/actions/platform/scheduling";

export function DeleteScheduleEvent({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onDelete() {
    if (!window.confirm("Remover este evento da agenda?")) return;
    startTransition(async () => {
      const result = await deleteScheduleEventAction(id);
      if (result.ok) router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={onDelete}
      disabled={pending}
      className="rounded-md border border-red-300 px-3 py-1 text-sm text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-400"
    >
      Remover
    </button>
  );
}
