"use client";

import { useCallback, useEffect, useState, useTransition } from "react";

import {
  addGesJobRoleAction,
  listAvailableJobRolesAction,
  listGesJobRolesAction,
  removeGesJobRoleAction,
  updateGesJobRoleAction,
} from "@/shared/server/actions/pgr/ges";
import type { GesJobRoleItem, JobRoleOption } from "@/shared/domains/pgr/ges";
import { GES_FIELD_HINTS } from "@/shared/domains/pgr/field-hints";

import { FieldHint } from "../../../_ui/field-hint";

export function ManageFunctions({ gesId }: { gesId: string }) {
  const [linked, setLinked] = useState<GesJobRoleItem[]>([]);
  const [available, setAvailable] = useState<JobRoleOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [newJobRoleId, setNewJobRoleId] = useState("");
  const [newWorkerCount, setNewWorkerCount] = useState("1");
  const [pending, startTransition] = useTransition();

  const reload = useCallback(() => {
    startTransition(async () => {
      const [linkedResult, availableResult] = await Promise.all([
        listGesJobRolesAction(gesId),
        listAvailableJobRolesAction(gesId),
      ]);
      if (linkedResult.ok) setLinked(linkedResult.data);
      if (availableResult.ok) setAvailable(availableResult.data);
    });
  }, [gesId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const exposedWorkers = linked.reduce((sum, item) => sum + item.workerCount, 0);

  function addLink() {
    if (!newJobRoleId) return;
    setError(null);
    startTransition(async () => {
      const result = await addGesJobRoleAction({
        gesId,
        jobRoleId: newJobRoleId,
        workerCount: newWorkerCount,
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setNewJobRoleId("");
      setNewWorkerCount("1");
      reload();
    });
  }

  function saveWorkerCount(id: string, workerCount: string) {
    setError(null);
    startTransition(async () => {
      const result = await updateGesJobRoleAction(id, gesId, { workerCount });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      reload();
    });
  }

  function removeLink(id: string) {
    setError(null);
    startTransition(async () => {
      const result = await removeGesJobRoleAction(id, gesId);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      reload();
    });
  }

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-black/10 p-4 dark:border-white/10">
      <header className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Funções vinculadas</h2>
        <span className="text-sm text-zinc-600 dark:text-zinc-400">
          Expostos (soma): <strong>{exposedWorkers}</strong>
        </span>
      </header>

      <FieldHint>{GES_FIELD_HINTS.functions}</FieldHint>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {linked.length === 0 ? (
        <p className="text-sm text-zinc-500">Nenhuma função vinculada (expostos = 0).</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {linked.map((item) => (
            <LinkedRow
              key={item.id}
              item={item}
              pending={pending}
              onSave={saveWorkerCount}
              onRemove={removeLink}
            />
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-end gap-3 border-t border-black/5 pt-4 dark:border-white/5">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Adicionar função</span>
          <select
            value={newJobRoleId}
            onChange={(e) => setNewJobRoleId(e.target.value)}
            className="rounded-md border border-black/15 bg-white px-3 py-2 text-sm dark:border-white/15 dark:bg-zinc-900"
          >
            <option value="">— selecione —</option>
            {available.map((opt) => (
              <option key={opt.jobRoleId} value={opt.jobRoleId}>
                {opt.title}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Nº de trabalhadores</span>
          <input
            type="number"
            min={1}
            value={newWorkerCount}
            onChange={(e) => setNewWorkerCount(e.target.value)}
            className="w-32 rounded-md border border-black/15 bg-white px-3 py-2 text-sm dark:border-white/15 dark:bg-zinc-900"
          />
        </label>
        <button
          type="button"
          onClick={addLink}
          disabled={pending || !newJobRoleId}
          className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-black/85 disabled:opacity-50 dark:bg-white dark:text-black"
        >
          Adicionar
        </button>
      </div>
    </section>
  );
}

function LinkedRow({
  item,
  pending,
  onSave,
  onRemove,
}: {
  item: GesJobRoleItem;
  pending: boolean;
  onSave: (id: string, workerCount: string) => void;
  onRemove: (id: string) => void;
}) {
  const [count, setCount] = useState(String(item.workerCount));
  return (
    <li className="flex flex-wrap items-center gap-3 rounded-md border border-black/5 px-3 py-2 dark:border-white/5">
      <span className="flex-1 font-medium">{item.title}</span>
      <input
        type="number"
        min={1}
        value={count}
        onChange={(e) => setCount(e.target.value)}
        className="w-24 rounded-md border border-black/15 bg-white px-2 py-1 text-sm dark:border-white/15 dark:bg-zinc-900"
      />
      <button
        type="button"
        onClick={() => onSave(item.id, count)}
        disabled={pending}
        className="rounded-md border border-black/15 px-3 py-1 text-sm transition-colors hover:bg-black/5 disabled:opacity-50 dark:border-white/15"
      >
        Salvar
      </button>
      <button
        type="button"
        onClick={() => onRemove(item.id)}
        disabled={pending}
        className="rounded-md border border-red-300 px-3 py-1 text-sm text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-400"
      >
        Remover
      </button>
    </li>
  );
}
