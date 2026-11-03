"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import {
  INVITATION_STATUS_LABELS,
  type InvitationView,
} from "@/shared/domains/medicine/professional-links";
import {
  actOnMedicoLinkInvitationAction,
  inviteMedicoUserAction,
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
  /** Vínculo criado antes do convite e aceite (NOB-157). */
  legacy: boolean;
};

type Result =
  | { ok: true }
  | { ok: false; error: { message: string; fields?: Record<string, string> } };

/**
 * Acesso do profissional (NOB-149, NOB-157). O owner convida uma conta; o vínculo só nasce quando a
 * própria conta convidada aceita, com login próprio, e, no autovínculo, quando outro responsável
 * aprova. A regra real está no servidor e na RLS; aqui só aparecem os botões de quem pode agir.
 */
export function ProfessionalAccess({
  medicoId,
  canManage,
  currentUserId,
  members,
  links,
  invitations,
}: {
  medicoId: string;
  canManage: boolean;
  currentUserId: string;
  members: AccessMember[];
  links: AccessLink[];
  invitations: InvitationView[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const open = links.find((l) => !l.revokedAt) ?? null;
  const active = invitations.find(
    (i) => i.status === "pending_acceptance" || i.status === "pending_approval",
  );
  const label = (userId: string) =>
    members.find((m) => m.userId === userId)?.label ??
    (userId === currentUserId ? "Sua conta" : `Conta ${userId}`);

  const run = (fn: () => Promise<Result>) =>
    startTransition(async () => {
      const result = await fn();
      if (result.ok) {
        setError(null);
        setFields({});
        router.refresh();
      } else {
        setFields(result.error.fields ?? {});
        setError(result.error.fields ? null : result.error.message);
      }
    });

  function onInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    run(() =>
      inviteMedicoUserAction(medicoId, {
        userId: fd.get("userId"),
        reason: fd.get("reason"),
      }),
    );
  }
  function onRevoke(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    run(() =>
      revokeMedicoUserLinkAction(medicoId, open!.id, { reason: fd.get("reason") }),
    );
  }
  const act = (action: "accept" | "approve" | "decline" | "cancel") =>
    run(() => actOnMedicoLinkInvitationAction(medicoId, active!.id, action));

  const isInvitee = active?.userId === currentUserId;
  const canApprove =
    canManage && active?.status === "pending_approval" && active.userId !== currentUserId;

  return (
    <section className="glass-card flex flex-col gap-4 rounded-xl p-5">
      <h2 className="text-text text-base font-semibold">Acesso do profissional</h2>
      <p className="text-text-subtle text-sm">
        Conta do escritório usada pelo profissional. O vínculo dá acesso clínico
        (prontuário, atos de examinador e de coordenador) e só nasce do aceite da própria
        conta convidada. Quando o responsável convida a própria conta, outro responsável
        precisa aprovar. O aceite é uma declaração com login; o sistema ainda não verifica
        o registro no conselho profissional.
      </p>
      {open ? (
        <p role="status" className="text-text text-sm">
          Vinculado a <strong>{label(open.userId)}</strong> desde{" "}
          {open.linkedAt.slice(0, 10)}
          {open.legacy ? " (vínculo anterior ao convite com aceite)" : ""}.
        </p>
      ) : (
        <p role="status" className="text-text-subtle text-sm">
          Nenhuma conta vinculada.
        </p>
      )}
      <FormError message={error} />
      {active ? (
        <div className="flex flex-col gap-2 text-sm">
          <p>
            Convite para <strong>{label(active.userId)}</strong>:{" "}
            {INVITATION_STATUS_LABELS[active.status]} · válido até{" "}
            {active.expiresAt.slice(0, 10)}.
          </p>
          <div className="flex flex-wrap gap-3">
            {isInvitee && active.status === "pending_acceptance" ? (
              <>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => act("accept")}
                  className="text-primary font-semibold underline disabled:opacity-60"
                >
                  Aceitar: sou este profissional
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => act("decline")}
                  className="underline disabled:opacity-60"
                >
                  Recusar
                </button>
              </>
            ) : null}
            {canApprove ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => act("approve")}
                className="text-primary font-semibold underline disabled:opacity-60"
              >
                Aprovar o autovínculo
              </button>
            ) : null}
            {canManage ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => act("cancel")}
                className="underline disabled:opacity-60"
              >
                Cancelar convite
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
      {canManage && !open && !active ? (
        <form onSubmit={onInvite} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-text font-semibold">
              Conta convidada <span className="text-danger">*</span>
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
          <SubmitButton pending={pending} label="Convidar conta" />
        </form>
      ) : null}
      {canManage && open ? (
        <form onSubmit={onRevoke} className="flex flex-col gap-3">
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
      {!canManage && !isInvitee ? (
        <p className="text-text-subtle text-sm">
          Somente o responsável pelo escritório convida ou revoga o acesso.
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
              {l.legacy ? " · anterior ao convite com aceite" : ""}
            </li>
          ))}
        </ul>
      ) : null}
      {invitations.length ? (
        <ul className="text-text-subtle list-disc pl-5 text-sm">
          {invitations.map((i) => (
            <li key={i.id}>
              Convite {i.invitedAt.slice(0, 10)} para {label(i.userId)}
              {i.selfInvitation ? " (autovínculo)" : ""}:{" "}
              {INVITATION_STATUS_LABELS[i.status]}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
