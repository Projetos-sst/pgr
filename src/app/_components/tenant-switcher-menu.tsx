"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { switchTenantAction } from "@/shared/server/actions/switch-tenant";
import type { TenantOption } from "@/shared/tenant/switcher";

function PlanBadge({ plan }: { plan: TenantOption["plan"] }) {
  return (
    <span className="text-text-muted rounded-sm bg-white/60 px-1.5 py-0.5 text-[10px] font-medium tracking-wide uppercase">
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
      <span className="flex h-[40px] items-center gap-2 rounded-[12px] border border-white/50 bg-white/34 px-4 text-[13px] font-semibold text-[#52576e] shadow-xs saturate-[170%] backdrop-blur-[20px]">
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
        className="flex h-[40px] items-center gap-2 rounded-[12px] border border-white/50 bg-white/34 px-4 text-[13px] font-semibold text-[#52576e] saturate-[170%] backdrop-blur-[20px] transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/55 focus-visible:outline-none active:scale-[0.97]"
      >
        <span className="max-w-[14rem] truncate">{active.name}</span>
        <PlanBadge plan={active.plan} />
        <span
          aria-hidden
          className={`inline-block text-[#9095ad] transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        >
          ▾
        </span>
      </button>

      {open ? (
        <ul
          role="listbox"
          aria-label="Trocar de organização"
          className="glass-menu animate-modal-pop absolute right-0 z-50 mt-2 w-72 overflow-hidden py-1"
        >
          {options.map((option) => (
            <li key={option.orgId} role="option" aria-selected={option.isActive}>
              <button
                type="button"
                onClick={() => selectTenant(option.orgId)}
                disabled={pendingOrgId !== null}
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-black/[0.04] disabled:opacity-60"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="text-text truncate font-medium">{option.name}</span>
                  <span className="text-text-subtle text-xs">{option.roleLabel}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <PlanBadge plan={option.plan} />
                  {option.isActive ? (
                    <span aria-hidden className="text-text">
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
