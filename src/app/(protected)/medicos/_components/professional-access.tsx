"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import {
  linkMedicoUserAction,
  revokeMedicoUserLinkAction,
} from "@/shared/server/actions/medicine/professional-links";

import { FormError, SubmitButton, TextField, fieldClass } from "../../_ui/form";

export type AccessMember = { userId: string; label: string };
export type AccessLink = {
  id: string;
  userId: string;
  reason: string;
  linkedAt: string;
  revokedAt: string | null;
  revokeReason: string | null;
};

/**
 * Acesso do profissional (NOB-149): vincula o cadastro a uma conta do escritório. Só o owner
 * vê os formulários; a regra real (owner + autoria) está no servidor e na RLS.
 */
export function ProfessionalAccess({
  medicoId,
  canManage,
  members,
  links,
}: {
  medicoId: string;
  canManage: boolean;
  members: AccessMember[];
  links: AccessLink[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const open = links.find((l) => !l.revokedAt) ?? null;
  const label = (userId: string) =>
    members.find((m) => m.userId === userId)?.label ?? `Conta ${userId}`;

  function submit(event: FormEvent<HTMLFormElement>, kind: "link" | "revoke") {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    startTransition(async () => {
      const result =
        kind === "link"
          ? await linkMedicoUserAction(medicoId, {
              userId: fd.get("userId"),
              reason: fd.get("reason"),
            })
          : await revokeMedicoUserLinkAction(medicoId, open!.id, {
              reason: fd.get("reason"),
            });
      if (result.ok) {
        setError(null);
        setFields({});
        router.refresh();
      } else {
        setFields(result.error.fields ?? {});
        setError(result.error.fields ? null : result.error.message);
      }
    });
  }

  return (
    <section className="glass-card flex flex-col gap-4 rounded-xl p-5">
      <h2 className="text-text text-base font-semibold">Acesso do profissional</h2>
      <p className="text-text-subtle text-sm">
        Conta do escritório usada pelo profissional. Só a conta vinculada ao coordenador
        do PCMSO pode executar atos de coordenador; o papel no escritório não substitui o
        vínculo.
      </p>
      {open ? (
        <p role="status" className="text-text text-sm">
          Vinculado a <strong>{label(open.userId)}</strong> desde{" "}
          {open.linkedAt.slice(0, 10)}.
        </p>
      ) : (
        <p role="status" className="text-text-subtle text-sm">
          Nenhuma conta vinculada.
        </p>
      )}
      <FormError message={error} />
      {canManage && !open ? (
        <form onSubmit={(e) => submit(e, "link")} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-text font-semibold">
              Conta <span className="text-danger">*</span>
            </span>
            <select name="userId" required className={fieldClass} defaultValue="">
              <option value="">
                {members.length ? "Selecione" : "Nenhuma conta disponível"}
              </option>
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.label}
                </option>
              ))}
            </select>
            {fields.userId ? <span className="text-danger">{fields.userId}</span> : null}
          </label>
          <TextField
            label="Motivo"
            name="reason"
            required
            isFullWidth
            error={fields.reason}
          />
          <SubmitButton pending={pending} label="Vincular conta" />
        </form>
      ) : null}
      {canManage && open ? (
        <form onSubmit={(e) => submit(e, "revoke")} className="flex flex-col gap-3">
          <TextField
            label="Motivo da revogação"
            name="reason"
            required
            isFullWidth
            error={fields.reason}
          />
          <SubmitButton pending={pending} label="Revogar acesso" />
        </form>
      ) : null}
      {!canManage ? (
        <p className="text-text-subtle text-sm">
          Somente o responsável pelo escritório pode vincular ou revogar o acesso.
        </p>
      ) : null}
      {links.length ? (
        <ul className="text-text-subtle list-disc pl-5 text-sm">
          {links.map((l) => (
            <li key={l.id}>
              {label(l.userId)} · {l.linkedAt.slice(0, 10)}
              {l.revokedAt
                ? ` → ${l.revokedAt.slice(0, 10)} (revogado: ${l.revokeReason})`
                : " → vigente"}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
