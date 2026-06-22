"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { switchTenantAction } from "@/shared/server/actions/switch-tenant";
import type { TenantOption } from "@/shared/tenant/switcher";

function PlanBadge({ plan }: { plan: TenantOption["plan"] }) {
  return (
    <span className="rounded-sm bg-black/5 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-zinc-600 uppercase">
      {plan}
    </span>
  );
}

export function TenantSwitcherMenu({
  options,
  canSwitch,
}: {
  options: TenantOption[];
  canSwitch: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pendingOrgId, setPendingOrgId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const active = options.find((option) => option.isActive) ?? options[0];

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!active) return null;

  async function selectTenant(orgId: string) {
    if (orgId === active?.orgId) {
      setOpen(false);
      return;
    }
    setPendingOrgId(orgId);
    const result = await switchTenantAction(orgId);
    setPendingOrgId(null);
    setOpen(false);
    if (result.ok) router.refresh();
  }

  if (!canSwitch) {
    return (
      <span className="inline-flex items-center gap-2 rounded-md border border-black/10 px-3 py-1.5 text-sm font-medium text-zinc-700">
        {active.name}
        <PlanBadge plan={active.plan} />
      </span>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="inline-flex items-center gap-2 rounded-md border border-black/15 px-3 py-1.5 text-sm font-medium text-zinc-800 transition-colors hover:bg-black/5 focus-visible:ring-2 focus-visible:ring-black/40 focus-visible:outline-none"
      >
        <span className="max-w-[14rem] truncate">{active.name}</span>
        <PlanBadge plan={active.plan} />
        <span aria-hidden className="text-zinc-400">
          ▾
        </span>
      </button>

      {open ? (
        <ul
          role="listbox"
          aria-label="Trocar de organização"
          className="absolute right-0 z-20 mt-2 w-72 overflow-hidden rounded-lg border border-black/10 bg-white py-1 shadow-lg"
        >
          {options.map((option) => (
            <li key={option.orgId} role="option" aria-selected={option.isActive}>
              <button
                type="button"
                onClick={() => selectTenant(option.orgId)}
                disabled={pendingOrgId !== null}
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-black/4 disabled:opacity-60"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-medium text-zinc-900">
                    {option.name}
                  </span>
                  <span className="text-xs text-zinc-500">{option.roleLabel}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <PlanBadge plan={option.plan} />
                  {option.isActive ? (
                    <span aria-hidden className="text-zinc-900">
                      ✓
                    </span>
                  ) : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
