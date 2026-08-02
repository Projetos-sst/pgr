"use client";

import { useRef } from "react";

import { CAMPAIGN_STATUS_LABELS } from "@/shared/domains/psychosocial/campaigns";

/** Filtro de status das campanhas na toolbar (GET, auto-submit). */
export function CampaignFilters({
  basePath,
  status,
}: {
  basePath: string;
  status?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <form
      ref={formRef}
      action={basePath}
      method="get"
      className="flex flex-1 items-center"
    >
      <span className="relative">
        <select
          name="status"
          defaultValue={status ?? ""}
          onChange={() => formRef.current?.submit()}
          aria-label="Filtrar por status"
          className="text-text-muted h-11 cursor-pointer appearance-none rounded-xl border border-white/70 bg-white/50 pr-9 pl-4 text-[13px] font-semibold outline-none"
        >
          <option value="">Todos os status</option>
          {Object.entries(CAMPAIGN_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <span
          aria-hidden
          className="text-text-subtle pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-[11px]"
        >
          ▾
        </span>
      </span>
    </form>
  );
}
