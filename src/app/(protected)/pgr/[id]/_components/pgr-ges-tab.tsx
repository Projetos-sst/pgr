"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  addGesToPgrAction,
  removeGesFromPgrAction,
} from "@/shared/server/actions/pgr/pgr-ges";
import type { PgrGesLinkItem } from "@/shared/domains/pgr/pgr-ges";

import { EmptyState, Table } from "../../../_ui/list";
import { FormError } from "../../../_ui/form";

const inputClass = "glass-input text-text rounded-card px-3 py-2 text-sm outline-none";

export function PgrGesTab({
  pgrId,
  links,
  availableGes,
}: {
  pgrId: string;
  links: PgrGesLinkItem[];
  availableGes: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState("");
  const [pending, startTransition] = useTransition();

  const linkedIds = new Set(links.map((l) => l.gesId));
  const options = availableGes.filter((g) => !linkedIds.has(g.id));

  function add() {
    if (!selected) return;
    setError(null);
    startTransition(async () => {
      const res = await addGesToPgrAction(pgrId, { gesId: selected });
      if (res.ok) {
        setSelected("");
        router.refresh();
        return;
      }
      setError(
        res.error.code === "DUPLICATE"
          ? "Este GES já está vinculado a este PGR."
          : res.error.message,
      );
    });
  }

  function remove(gesId: string) {
    setError(null);
    startTransition(async () => {
      const res = await removeGesFromPgrAction(pgrId, gesId);
      if (res.ok) {
        router.refresh();
        return;
      }
      setError(res.error.message);
    });
  }

  return (
    <section className="flex flex-col gap-4">
      <FormError message={error} />

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-text-muted text-sm font-semibold">Vincular GES</span>
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className={inputClass}
            disabled={pending || options.length === 0}
          >
            <option value="">
              {options.length === 0
                ? "Todos os GES já vinculados"
                : "— selecione um GES —"}
            </option>
            {options.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={add}
          disabled={pending || !selected}
          className="btn-primary rounded-pill px-5 py-2 text-sm font-semibold transition-colors disabled:opacity-50"
        >
          Adicionar
        </button>
      </div>

      {links.length === 0 ? (
        <EmptyState message="Nenhum GES vinculado. Vincule um GES para compor a visão consolidada." />
      ) : (
        <Table headers={["GES", ""]}>
          {links.map((link) => (
            <tr key={link.id} className="border-t border-white/50">
              <td className="px-4 py-2 font-medium">{link.gesName}</td>
              <td className="px-4 py-2">
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`Remover o vínculo do GES "${link.gesName}"?`)) {
                        remove(link.gesId);
                      }
                    }}
                    disabled={pending}
                    className="rounded-card border border-red-300 px-3 py-1 text-sm font-semibold text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50"
                  >
                    Remover
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </Table>
      )}
    </section>
  );
}
