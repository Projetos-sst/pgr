"use client";
import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  assignDocumentReviewerAction,
  decideDocumentApprovalAction,
  type getDocumentApprovalAction,
} from "@/shared/server/actions/pgr/document-approval";
import { FormError, TextField, SelectField, SubmitButton } from "../../../_ui/form";
type View = Extract<
  Awaited<ReturnType<typeof getDocumentApprovalAction>>,
  { ok: true }
>["data"];
export function DocumentApprovalForm({
  pgrId,
  view,
  samples,
  members,
}: {
  pgrId: string;
  view: View;
  samples: { id: string; reason: string; sourceChanged: boolean }[];
  members: { value: string; label: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("changes_requested");
  const [sampleId, setSampleId] = useState("");
  const [authorUserId, setAuthorUserId] = useState(view.assignment?.authorUserId ?? "");
  const [reviewerUserId, setReviewerUserId] = useState(
    view.assignment?.reviewerUserId ?? "",
  );
  function submit(event: FormEvent<HTMLFormElement>, assignment: boolean) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const text = (key: string) => String(fd.get(key) ?? "");
    start(async () => {
      const result = assignment
        ? await assignDocumentReviewerAction(pgrId, {
            expectedAssignmentId: view.assignment?.id ?? null,
            authorUserId,
            reviewerUserId,
            reviewer: {
              fullName: text("fullName"),
              profession: text("profession"),
              registration: {
                kind: "registered",
                council: text("council"),
                number: text("number"),
                region: text("region"),
              },
            },
            reason: text("reason"),
          })
        : await decideDocumentApprovalAction(pgrId, {
            assignmentId: view.assignment?.id,
            sampleId,
            expectedDecisionId: view.decision?.id ?? null,
            status,
            reason: text("reason"),
          });
      if (!result.ok)
        setError(
          result.error.fields
            ? Object.values(result.error.fields).join(" · ")
            : result.error.message,
        );
      else {
        setError(null);
        router.refresh();
      }
    });
  }
  return (
    <section className="glass-card flex flex-col gap-4 rounded-xl p-5">
      <h2 className="font-semibold">Revisão deste PGR antes da emissão</h2>
      <p>
        A revisão deste documento é independente dos pareceres por amostragem do gerador.
        O administrador designa uma conta revisora diferente do elaborador. O parecer é
        registrado pelo próprio revisor sobre uma amostra preservada.
      </p>
      <FormError message={error} />
      <p>
        {view.assignment
          ? `Revisor: ${view.assignment.reviewer.fullName}. Situação: ${view.decision?.status === "accepted" ? "Parecer favorável registrado; emissão confere se a versão ainda é atual." : view.decision?.status === "changes_requested" ? "Correções solicitadas." : "Aguardando parecer."}`
          : view.required
            ? "Este novo PGR exige revisão técnica. O administrador deve designar um revisor diferente do elaborador antes da emissão ou assinatura."
            : "PGR anterior à atualização: o fluxo atual foi preservado. Designe o revisor para ativar a revisão obrigatória neste documento."}
      </p>
      {view.canAssign ? (
        <form
          onSubmit={(event) => submit(event, true)}
          className="grid gap-3 sm:grid-cols-2"
        >
          <SelectField
            name="authorUserId"
            label="Elaborador"
            value={authorUserId}
            onChange={setAuthorUserId}
            options={members}
          />
          <SelectField
            name="reviewerUserId"
            label="Revisor"
            value={reviewerUserId}
            onChange={setReviewerUserId}
            options={members.filter((member) => member.value !== authorUserId)}
          />
          <TextField
            name="fullName"
            label="Nome do revisor"
            defaultValue={view.assignment?.reviewer.fullName}
            required
          />
          <TextField
            name="profession"
            label="Profissão do revisor"
            defaultValue={view.assignment?.reviewer.profession}
            required
          />
          <TextField name="council" label="Órgão de registro" required />
          <TextField name="number" label="Registro profissional" required />
          <TextField name="region" label="Região/UF" />
          <TextField
            name="reason"
            label="Motivo da designação ou substituição"
            required
          />
          <SubmitButton pending={pending} label="Designar revisor separado" />
        </form>
      ) : null}
      {view.canReview && view.assignment ? (
        <form onSubmit={(event) => submit(event, false)} className="grid gap-3">
          <SelectField
            name="sampleId"
            label="Amostra analisada"
            value={sampleId}
            onChange={setSampleId}
            options={samples
              .filter((sample) => !sample.sourceChanged)
              .map((sample) => ({ value: sample.id, label: sample.reason }))}
          />
          <SelectField
            name="status"
            label="Meu parecer"
            value={status}
            onChange={setStatus}
            options={[
              { value: "changes_requested", label: "Solicitar correções" },
              { value: "accepted", label: "Parecer favorável" },
            ]}
          />
          <TextField name="reason" label="Fundamentação do meu parecer" required />
          <SubmitButton pending={pending} label="Registrar meu parecer sobre este PGR" />
        </form>
      ) : null}
      {view.decision ? (
        <p className="text-sm">
          Último parecer registrado por {view.decision.actor} em{" "}
          {new Date(view.decision.createdAt).toLocaleString("pt-BR", {
            timeZone: "America/Sao_Paulo",
          })}
          : {view.decision.reason}
        </p>
      ) : null}
    </section>
  );
}
