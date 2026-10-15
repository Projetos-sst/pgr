"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import {
  archivePgrRevisionAction,
  createPgrRevisionAction,
} from "@/shared/server/actions/pgr/pgr-revisions";
import type {
  PgrRevisionInput,
  PgrRevisionListItem,
} from "@/shared/domains/pgr/pgr-revision";
import type { ActionError } from "@/shared/server/result";

import { EmptyState, Table } from "../../../_ui/list";
import { FieldError, FormError } from "../../../_ui/form";

const inputClass =
  "glass-input text-text placeholder:text-text-subtle rounded-card px-3.5 py-2.5 text-sm outline-none w-full";

const brDate = (d: string | null) => (d ? d.split("-").reverse().join("/") : "—");

export function PgrRevisionsTab({
  pgrId,
  revisions,
  readOnly = false,
}: {
  pgrId: string;
  revisions: PgrRevisionListItem[];
  readOnly?: boolean;
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

  function handleArchive(revisionId: string) {
    setFormError(null);
    startTransition(async () => {
      const res = await archivePgrRevisionAction(pgrId, revisionId);
      if (res.ok) {
        router.refresh();
        return;
      }
      setFormError(res.error.message);
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
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
    <section className="flex flex-col gap-6">
      <div className="glass-card flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-text text-base font-bold sm:text-lg">
            Histórico e Registro de Revisões
          </h2>
          <p className="text-text-subtle mt-0.5 text-xs">
            Acompanhe o histórico de alterações e registre novas revisões do documento PGR
          </p>
        </div>
      </div>

      <FormError message={formError} />

      {!readOnly ? (
        <form
          onSubmit={handleSubmit}
          className="glass-card grid gap-4 p-6 sm:grid-cols-2"
        >
          <label className="flex flex-col gap-1.5">
            <span className="text-text-muted text-xs font-bold tracking-wider uppercase">
              Data da revisão *
            </span>
            <input
              type="date"
              name="revisedAt"
              defaultValue={today}
              className={inputClass}
            />
            <FieldError message={errors.revisedAt} />
          </label>
          <div className="text-text-subtle flex flex-col justify-end pb-2 text-xs font-medium">
            O número da revisão é atribuído sequencialmente pelo sistema.
          </div>
          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className="text-text-muted text-xs font-bold tracking-wider uppercase">
              Notas da revisão
            </span>
            <input
              name="notes"
              placeholder="Descreva as alterações ou motivos desta revisão…"
              className={inputClass}
            />
            <FieldError message={errors.notes} />
          </label>
          <div className="pt-2 sm:col-span-2">
            <button
              type="submit"
              disabled={pending}
              className="btn-primary rounded-card shadow-primary flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white transition-all disabled:opacity-50 sm:text-sm"
            >
              {pending ? "Salvando…" : "Registrar revisão"}
            </button>
          </div>
        </form>
      ) : null}

      {revisions.length === 0 ? (
        <EmptyState message="Nenhuma revisão registrada para este documento." />
      ) : (
        <Table
          headers={
            readOnly
              ? ["Nº Revisão", "Data de Revisão", "Notas", "Status"]
              : ["Nº Revisão", "Data de Revisão", "Notas", "Status", "Ações"]
          }
        >
          {revisions.map((rev) => (
            <tr
              key={rev.id}
              className="border-t border-black/5 transition-colors hover:bg-white/20"
            >
              <td className="text-primary px-6 py-3.5 font-mono text-xs font-bold">
                Rev. {String(rev.revisionNumber).padStart(2, "0")}
              </td>
              <td className="text-text px-6 py-3.5 font-mono text-xs font-medium">
                {brDate(rev.revisedAt)}
              </td>
              <td className="text-text-muted px-6 py-3.5 text-sm">{rev.notes ?? "—"}</td>
              <td className="px-6 py-3.5">
                {rev.archivedAt ? (
                  <span className="text-text-subtle bg-text-subtle/10 rounded-[6px] px-2 py-0.5 font-mono text-xs font-bold">
                    Arquivada
                  </span>
                ) : (
                  <span className="rounded-[6px] bg-green-500/10 px-2 py-0.5 font-mono text-xs font-bold text-green-700">
                    Ativa
                  </span>
                )}
              </td>
              {!readOnly ? (
                <td className="px-6 py-3.5">
                  {!rev.archivedAt ? (
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => handleArchive(rev.id)}
                        disabled={pending}
                        className="glass-panel text-text-muted rounded-card hover:text-text px-3 py-1.5 text-xs font-bold transition-colors disabled:opacity-50"
                      >
                        Arquivar
                      </button>
                    </div>
                  ) : null}
                </td>
              ) : null}
            </tr>
          ))}
        </Table>
      )}
    </section>
  );
}
