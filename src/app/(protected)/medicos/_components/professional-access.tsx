"use client";

import { useId, type FormEvent } from "react";

import { formatInstantDate } from "@/shared/dates";
import { pathDescriber } from "@/shared/domains/medicine/form-feedback";
import {
  INVITATION_STATUS_LABELS,
  type InvitationView,
} from "@/shared/domains/medicine/professional-links";
import {
  actOnMedicoLinkInvitationAction,
  inviteMedicoUserAction,
  revokeMedicoUserLinkAction,
} from "@/shared/server/actions/medicine/professional-links";

import {
  FieldError,
  FormError,
  SubmitButton,
  TextField,
  fieldClass,
} from "../../_ui/form";
import { useActionFeedback } from "../../_ui/use-action-feedback";

const describeAccessPath = pathDescriber({
  fields: { userId: "Conta convidada", reason: "Motivo" },
});

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
  const { pending, feedback, run } = useActionFeedback({ describe: describeAccessPath });
  const fields = feedback.fields;
  const userIdErrorId = useId();
  const open = links.find((l) => !l.revokedAt) ?? null;
  const active = invitations.find(
    (i) => i.status === "pending_acceptance" || i.status === "pending_approval",
  );
  const label = (userId: string) =>
    members.find((m) => m.userId === userId)?.label ??
    (userId === currentUserId ? "Sua conta" : `Conta ${userId}`);

  function onInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    run(
      () =>
        inviteMedicoUserAction(medicoId, {
          userId: fd.get("userId"),
          reason: fd.get("reason"),
        }),
      { slots: ["userId", "reason"] },
    );
  }
  function onRevoke(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    run(
      () => revokeMedicoUserLinkAction(medicoId, open!.id, { reason: fd.get("reason") }),
      { slots: ["reason"] },
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
        precisa aprovar. O aceite é uma declaração com login. O acesso clínico só passa a
        valer depois da verificação independente da identidade pela plataforma, que o
        próprio profissional pede em{" "}
        <a href="/professional-identity" className="text-primary underline">
          Minha identidade profissional
        </a>
        ; vínculos anteriores ao convite também precisam ser reconfirmados por ele.
      </p>
      {open ? (
        <p role="status" className="text-text text-sm">
          Vinculado a <strong>{label(open.userId)}</strong> desde{" "}
          {formatInstantDate(open.linkedAt)}
          {open.legacy ? " (vínculo anterior ao convite com aceite)" : ""}.
        </p>
      ) : (
        <p role="status" className="text-text-subtle text-sm">
          Nenhuma conta vinculada.
        </p>
      )}
      <FormError message={feedback.formError} details={feedback.details} />
      {active ? (
        <div className="flex flex-col gap-2 text-sm">
          <p>
            Convite para <strong>{label(active.userId)}</strong>:{" "}
            {INVITATION_STATUS_LABELS[active.status]} · válido até{" "}
            {formatInstantDate(active.expiresAt)}.
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
            <select
              name="userId"
              required
              className={fieldClass}
              defaultValue=""
              aria-invalid={fields.userId ? true : undefined}
              aria-describedby={fields.userId ? userIdErrorId : undefined}
            >
              <option value="">
                {members.length ? "Selecione" : "Nenhuma conta disponível"}
              </option>
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.label}
                </option>
              ))}
            </select>
            <FieldError id={userIdErrorId} message={fields.userId} />
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
              {label(l.userId)} · {formatInstantDate(l.linkedAt)}
              {l.revokedAt
                ? ` → ${formatInstantDate(l.revokedAt)} (revogado: ${l.revokeReason})`
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
              Convite {formatInstantDate(i.invitedAt)} para {label(i.userId)}
              {i.selfInvitation ? " (autovínculo)" : ""}:{" "}
              {INVITATION_STATUS_LABELS[i.status]}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
