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
import { ConfirmModal } from "../../../_ui/confirm-modal";

const inputClass =
  "glass-input text-text placeholder:text-text-subtle rounded-card px-3.5 py-2.5 text-sm outline-none w-full sm:w-80";

export function PgrGesTab({
  pgrId,
  links,
  availableGes,
  readOnly = false,
}: {
  pgrId: string;
  links: PgrGesLinkItem[];
  availableGes: { id: string; name: string }[];
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState("");
  const [removingGes, setRemovingGes] = useState<{ id: string; name: string } | null>(
    null,
  );
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

  function handleConfirmRemove() {
    if (!removingGes) return;
    const targetId = removingGes.id;
    setRemovingGes(null);
    remove(targetId);
  }

  return (
    <section className="flex flex-col gap-6">
      <div className="glass-card flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-text text-base font-bold sm:text-lg">
            Vínculos de Grupos de Exposição Similar (GES)
          </h2>
          <p className="text-text-subtle mt-0.5 text-xs">
            Selecione e vincule os GES da empresa que compõem a análise deste documento
          </p>
        </div>
      </div>

      <FormError message={error} />

      {!readOnly ? (
        <div className="glass-card flex flex-wrap items-end gap-4 p-6">
          <label className="flex min-w-[240px] flex-1 flex-col gap-1.5">
            <span className="text-text-muted text-xs font-bold tracking-wider uppercase">
              Selecione o GES
            </span>
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              className={inputClass}
              disabled={pending || options.length === 0}
            >
              <option value="">
                {options.length === 0
                  ? "Todos os GES já foram vinculados"
                  : "— selecione um GES para vincular —"}
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
            className="btn-primary rounded-card shadow-primary flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white transition-all disabled:opacity-50 sm:text-sm"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            Vincular GES
          </button>
        </div>
      ) : null}

      {links.length === 0 ? (
        <EmptyState
          title="Nenhum GES vinculado"
          message="Nenhum Grupo de Exposição Similar (GES) foi vinculado a este documento PGR até o momento. Selecione e vincule ao menos um GES acima para compor o inventário."
        />
      ) : (
        <Table
          headers={
            readOnly
              ? ["Grupo de Exposição Similar (GES)"]
              : ["Grupo de Exposição Similar (GES)", "Ações"]
          }
        >
          {links.map((link) => (
            <tr
              key={link.id}
              className="border-t border-black/5 transition-colors hover:bg-white/20"
            >
              <td className="text-text px-6 py-3.5 text-sm font-bold">
                <div className="flex items-center gap-2.5">
                  <span className="text-primary bg-primary/10 rounded-[6px] px-2 py-0.5 font-mono text-xs font-bold">
                    GES
                  </span>
                  {link.gesName}
                </div>
              </td>
              {!readOnly ? (
                <td className="px-6 py-3.5">
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() =>
                        setRemovingGes({ id: link.gesId, name: link.gesName })
                      }
                      disabled={pending}
                      className="rounded-card border border-red-300/50 bg-red-500/10 px-3 py-1.5 text-xs font-bold text-red-700 transition-colors hover:bg-red-500/20 disabled:opacity-50"
                    >
                      Desvincular
                    </button>
                  </div>
                </td>
              ) : null}
            </tr>
          ))}
        </Table>
      )}

      {/* Modal de Confirmação para Desvincular GES */}
      <ConfirmModal
        open={Boolean(removingGes)}
        title="Desvincular GES?"
        description={`Deseja remover o vínculo do Grupo de Exposição Similar "${removingGes?.name ?? ""}" deste documento PGR?`}
        confirmLabel="Desvincular"
        cancelLabel="Cancelar"
        variant="danger"
        pending={pending}
        onConfirm={handleConfirmRemove}
        onCancel={() => setRemovingGes(null)}
      />
    </section>
  );
}
