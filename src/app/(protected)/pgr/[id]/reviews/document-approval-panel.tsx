"use client";
import { useState, useTransition, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  assignDocumentReviewerAction,
  cancelFinalIssueAction,
  decideDocumentApprovalAction,
  requireDocumentReviewAction,
  revokeDocumentReviewerAction,
  type getDocumentApprovalAction,
} from "@/shared/server/actions/pgr/document-approval";
import type { ApprovalStatus, FinalIssue } from "@/shared/domains/pgr/document-approval";
import type { ActionResult } from "@/shared/server/result";
import { DownloadDocumentButton } from "../../../documents/_components/download-document-button";
import {
  FormError,
  SelectField,
  SubmitButton,
  TextAreaField,
  TextField,
} from "../../../_ui/form";

type View = Extract<
  Awaited<ReturnType<typeof getDocumentApprovalAction>>,
  { ok: true }
>["data"];
type Member = { value: string; label: string };
type Fields = (name: string) => string;

const STATUS_LABEL: Record<ApprovalStatus, string> = {
  not_required:
    "Revisão obrigatória não adotada neste PGR. A emissão e a assinatura seguem o fluxo atual.",
  awaiting_reviewer:
    "Revisão obrigatória ativa. Falta o administrador designar o revisor.",
  awaiting_review: "Aguardando o parecer do revisor designado.",
  rejected: "Rejeitado pelo revisor. Corrija os apontamentos e peça novo parecer.",
  approved: "Aprovado pelo revisor para a versão atual dos dados e do modelo.",
  stale:
    "Os dados ou o modelo mudaram depois do parecer. A nova versão precisa de revisão.",
};
const ISSUE_LABEL: Record<FinalIssue["status"], string> = {
  current: "Vigente",
  superseded: "Substituída por emissão posterior",
  cancelled: "Cancelada",
};
const REGISTRATION_OPTIONS = [
  { value: "registered", label: "Possui registro profissional" },
  { value: "not_applicable", label: "Registro não se aplica" },
];
const VERDICT_OPTIONS = [
  { value: "approved", label: "Aprovar esta versão" },
  { value: "rejected", label: "Rejeitar e pedir correções" },
];

const when = (value: Date | string) =>
  new Date(value).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

function useSubmit() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  function submit(
    event: FormEvent<HTMLFormElement>,
    action: (field: Fields) => Promise<ActionResult<unknown>>,
  ) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const field: Fields = (name) => String(data.get(name) ?? "");
    start(async () => {
      const result = await action(field);
      if (result.ok) {
        setError(null);
        router.refresh();
        return;
      }
      setError(
        result.error.fields
          ? Object.values(result.error.fields).join(" · ")
          : result.error.message,
      );
    });
  }
  return { pending, error, submit };
}

function ActionForm({
  label,
  action,
  children,
}: {
  label: string;
  action: (field: Fields) => Promise<ActionResult<unknown>>;
  children: ReactNode;
}) {
  const { pending, error, submit } = useSubmit();
  return (
    <form
      onSubmit={(event) => submit(event, action)}
      className="grid gap-3 sm:grid-cols-2"
    >
      <FormError message={error} />
      {children}
      <SubmitButton pending={pending} label={label} />
    </form>
  );
}

function AssignmentForm({
  pgrId,
  members,
  authorKnown,
}: {
  pgrId: string;
  members: Member[];
  authorKnown: boolean;
}) {
  const [registration, setRegistration] = useState("registered");
  return (
    <ActionForm
      label="Designar revisor"
      action={(field) =>
        assignDocumentReviewerAction(pgrId, {
          reviewerUserId: field("reviewerUserId"),
          ...(authorKnown ? {} : { authorUserId: field("authorUserId") }),
          reviewer: {
            fullName: field("fullName"),
            profession: field("profession"),
            registration:
              registration === "registered"
                ? {
                    kind: "registered",
                    council: field("council"),
                    number: field("number"),
                    region: field("region"),
                  }
                : { kind: "not_applicable", reason: field("registrationReason") },
          },
          reason: field("reason"),
        })
      }
    >
      {authorKnown ? null : (
        <SelectField
          name="authorUserId"
          label="Elaborador do PGR"
          options={members}
          required
        />
      )}
      <SelectField
        name="reviewerUserId"
        label="Revisor (membro do escritório)"
        options={members}
        required
      />
      <TextField name="fullName" label="Nome completo do revisor" required />
      <TextField name="profession" label="Profissão do revisor" required />
      <SelectField
        name="registrationKind"
        label="Registro profissional"
        value={registration}
        onChange={setRegistration}
        options={REGISTRATION_OPTIONS}
        required
      />
      {registration === "registered" ? (
        <>
          <TextField name="council" label="Conselho ou órgão de registro" required />
          <TextField name="number" label="Número do registro" required />
          <TextField name="region" label="Região/UF" />
        </>
      ) : (
        <TextField
          name="registrationReason"
          label="Por que o registro não se aplica"
          required
        />
      )}
      <TextField
        name="reason"
        label="Motivo da designação ou da troca"
        required
        isFullWidth
      />
    </ActionForm>
  );
}

function IssueItem({
  pgrId,
  issue,
  canCancel,
  nameOf,
}: {
  pgrId: string;
  issue: FinalIssue;
  canCancel: boolean;
  nameOf: (userId: string | null) => string;
}) {
  return (
    <li className="flex flex-col gap-2 rounded-lg border p-3 text-sm">
      <p className="font-semibold">
        Emissão final de {when(issue.issuedAt)} · {ISSUE_LABEL[issue.status]}
      </p>
      <p>
        Elaborador: {nameOf(issue.authorUserId)} · Revisor:{" "}
        {issue.reviewerIdentity?.fullName ?? nameOf(issue.reviewerUserId)} · Emitido por:{" "}
        {nameOf(issue.issuedBy)}
      </p>
      <p className="font-mono text-xs break-all">
        Dados {issue.snapshotSha256} · Modelo {issue.templateSha256} · Arquivo{" "}
        {issue.fileSha256}
      </p>
      {issue.cancellation ? (
        <p>
          Cancelada por {nameOf(issue.cancellation.actor)} em{" "}
          {when(issue.cancellation.cancelledAt)}: {issue.cancellation.reason}
        </p>
      ) : null}
      {issue.documentId ? <DownloadDocumentButton documentId={issue.documentId} /> : null}
      {canCancel && issue.status !== "cancelled" ? (
        <ActionForm
          label="Cancelar esta emissão"
          action={(field) =>
            cancelFinalIssueAction(pgrId, issue.id, { reason: field("reason") })
          }
        >
          <TextField name="reason" label="Motivo do cancelamento" required isFullWidth />
        </ActionForm>
      ) : null}
    </li>
  );
}

export function DocumentApprovalPanel({
  pgrId,
  view,
  members,
}: {
  pgrId: string;
  view: View;
  members: Member[];
}) {
  const nameOf = (userId: string | null) =>
    members.find((member) => member.value === userId)?.label ??
    userId ??
    "Não registrado";
  const { permissions } = view;
  return (
    <section className="glass-card flex flex-col gap-4 rounded-xl p-5">
      <h2 className="font-semibold">Revisão deste PGR antes da emissão final</h2>
      <p role="status">{STATUS_LABEL[view.status]}</p>
      <p className="text-sm">
        Elaborador: {nameOf(view.authorUserId)}
        {view.reviewer
          ? ` · Revisor: ${view.reviewer.identity?.fullName ?? nameOf(view.reviewer.userId)}`
          : ""}
        {view.decision
          ? ` · Último parecer em ${when(view.decision.decidedAt)}${view.decision.reason ? `: ${view.decision.reason}` : ""}`
          : ""}
      </p>
      <p className="text-sm">
        A prévia continua livre. Com a revisão ativa, a emissão final e o pedido de
        assinatura só são liberados com parecer favorável para a versão atual.
      </p>
      {permissions.canRequire ? (
        <ActionForm
          label="Ativar revisão obrigatória"
          action={(field) =>
            requireDocumentReviewAction(pgrId, { reason: field("reason") })
          }
        >
          <p className="text-sm sm:col-span-full">
            A ativação vale só para este PGR e não pode ser desfeita.
          </p>
          <TextField name="reason" label="Motivo da adoção" required isFullWidth />
        </ActionForm>
      ) : null}
      {permissions.canAssign ? (
        <AssignmentForm
          pgrId={pgrId}
          members={members}
          authorKnown={view.authorUserId !== null}
        />
      ) : null}
      {permissions.canRevoke ? (
        <ActionForm
          label="Revogar revisor"
          action={(field) =>
            revokeDocumentReviewerAction(pgrId, { reason: field("reason") })
          }
        >
          <TextField name="reason" label="Motivo da revogação" required isFullWidth />
        </ActionForm>
      ) : null}
      {permissions.canDecide ? (
        <ActionForm
          label="Registrar meu parecer"
          action={(field) =>
            decideDocumentApprovalAction(pgrId, {
              assignmentId: view.assignmentId,
              snapshotSha256: view.version.snapshotSha256,
              verdict: field("verdict"),
              reason: field("reason"),
            })
          }
        >
          <SelectField
            name="verdict"
            label="Meu parecer"
            options={VERDICT_OPTIONS}
            required
            isFullWidth
          />
          <TextAreaField
            name="reason"
            label="Fundamentação (obrigatória para rejeitar)"
          />
        </ActionForm>
      ) : null}
      {view.issues.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {view.issues.map((issue) => (
            <IssueItem
              key={issue.id}
              pgrId={pgrId}
              issue={issue}
              canCancel={permissions.canCancelIssue}
              nameOf={nameOf}
            />
          ))}
        </ul>
      ) : null}
    </section>
  );
}
