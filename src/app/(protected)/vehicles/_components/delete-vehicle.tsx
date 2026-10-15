"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { deleteVehicleAction } from "@/shared/server/actions/inspections/vehicles";

export function DeleteVehicle({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onDelete() {
    if (!window.confirm("Remover este veículo?")) return;
    startTransition(async () => {
      const result = await deleteVehicleAction(id);
      if (result.ok) router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={onDelete}
      disabled={pending}
      aria-label="Remover veículo"
      title="Remover"
      className="text-text-subtle flex h-8 w-8 items-center justify-center rounded-[9px] transition-colors hover:bg-red-50 hover:text-[#d33a3f] disabled:opacity-50"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        aria-hidden="true"
      >
        <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
      </svg>
    </button>
  );
}
