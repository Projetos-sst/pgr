"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import { createPgrRevisionAction } from "@/shared/server/actions/pgr/pgr-revisions";
import type {
  PgrRevisionInput,
  PgrRevisionListItem,
} from "@/shared/domains/pgr/pgr-revision";
import type { ActionError } from "@/shared/server/result";

import { EmptyState, Table } from "../../../_ui/list";
import { FieldError, FormError } from "../../../_ui/form";

const inputClass = "glass-input text-text rounded-card px-3 py-2 text-sm outline-none";

const brDate = (d: string | null) => (d ? d.split("-").reverse().join("/") : "—");

export function PgrRevisionsTab({
  pgrId,
  revisions,
}: {
  pgrId: string;
  revisions: PgrRevisionListItem[];
}) {
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const today = new Date().toISOString().slice(0, 10);

  function applyError(error: ActionError) {
    if (error.code === "DUPLICATE") {
      setErrors({});
      setFormError(
        "Não foi possível registrar a revisão (conflito de número). Tente novamente.",
      );
      return;
    }
    setErrors(error.fields ?? {});
    setFormError(error.fields ? null : error.message);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    // O número da revisão é calculado no servidor (MAX+1) — o cliente NÃO o envia.
    const input: PgrRevisionInput = {
      revisedAt: String(fd.get("revisedAt") ?? ""),
      notes: String(fd.get("notes") ?? ""),
    };
    setErrors({});
    setFormError(null);
    startTransition(async () => {
      const res = await createPgrRevisionAction(pgrId, input);
      if (res.ok) {
        router.refresh();
        return;
      }
      applyError(res.error);
    });
  }

  return (
    <section className="flex flex-col gap-4">
      <FormError message={formError} />

      <form
        onSubmit={handleSubmit}
        className="glass-card grid max-w-2xl gap-4 p-4 sm:grid-cols-2"
      >
        <label className="flex flex-col gap-1">
          <span className="text-text-muted text-sm font-semibold">Data da revisão *</span>
          <input
            type="date"
            name="revisedAt"
            defaultValue={today}
            className={inputClass}
          />
          <FieldError message={errors.revisedAt} />
        </label>
        <p className="text-text-subtle flex items-end text-xs">
          O número da revisão é atribuído automaticamente pelo sistema.
        </p>
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className="text-text-muted text-sm font-semibold">Notas</span>
          <input name="notes" className={inputClass} />
          <FieldError message={errors.notes} />
        </label>
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={pending}
            className="btn-primary rounded-pill px-5 py-2 text-sm font-semibold transition-colors disabled:opacity-50"
          >
            {pending ? "Salvando…" : "Registrar revisão"}
          </button>
        </div>
      </form>

      {revisions.length === 0 ? (
        <EmptyState message="Nenhuma revisão registrada." />
      ) : (
        <Table headers={["Revisão", "Data", "Notas"]}>
          {revisions.map((rev) => (
            <tr key={rev.id} className="border-t border-white/50">
              <td className="px-4 py-2 font-medium">{rev.revisionNumber}</td>
              <td className="px-4 py-2">{brDate(rev.revisedAt)}</td>
              <td className="px-4 py-2">{rev.notes ?? "—"}</td>
            </tr>
          ))}
        </Table>
      )}
    </section>
  );
}
