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
      className="rounded-card border border-red-300 px-3 py-1 text-sm font-semibold text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50"
    >
      Remover
    </button>
  );
}
