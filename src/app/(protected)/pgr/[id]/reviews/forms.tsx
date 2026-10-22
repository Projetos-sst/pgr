"use client";
import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  createReviewSampleAction,
  recordReviewDecisionAction,
} from "@/shared/server/actions/pgr/document-reviews";
import type { PgrReviewDecisionInput } from "@/shared/domains/pgr/document-review";
import {
  TextField,
  TextAreaField,
  SelectField,
  SubmitButton,
  FormError,
} from "../../../_ui/form";
export function NewSampleForm({
  pgrId,
  supersedesSampleId = null,
}: {
  pgrId: string;
  supersedesSampleId?: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const reason = String(new FormData(e.currentTarget).get("reason") ?? "");
    start(async () => {
      const r = await createReviewSampleAction(pgrId, { reason, supersedesSampleId });
      if (!r.ok) setError(r.error.message);
      else {
        router.push(`/pgr/${pgrId}/reviews/${r.data.id}`);
        router.refresh();
      }
    });
  }
  return (
    <form onSubmit={submit} className="glass-card flex flex-col gap-3 rounded-xl p-4">
      <FormError message={error} />
      <p>
        A amostra DOCX será guardada no GED com os dados usados na geração. Nenhum parecer
        é criado automaticamente.
      </p>
      <TextField
        name="reason"
        label={
          supersedesSampleId
            ? "Motivo da nova amostra para revalidação"
            : "Motivo da amostra para revisão"
        }
        required
      />
      <SubmitButton
        pending={pending}
        label={
          supersedesSampleId ? "Gerar amostra corrigida" : "Gerar amostra para revisão"
        }
      />
    </form>
  );
}
type Finding = PgrReviewDecisionInput["findings"][number];
export function ReviewDecisionForm({
  pgrId,
  sampleId,
  expectedLatestDecisionId,
  previousFindings,
}: {
  pgrId: string;
  sampleId: string;
  expectedLatestDecisionId: string | null;
  previousFindings: Finding[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [registration, setRegistration] = useState("registered");
  const [findings, setFindings] = useState<Finding[]>(previousFindings);
  const edit = (i: number, field: keyof Finding, value: string) =>
    setFindings((rows) =>
      rows.map((r, index) => (index === i ? { ...r, [field]: value } : r)),
    );
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const t = (key: string) => String(fd.get(key) ?? "");
    const reviewed = new Date(t("reviewedAt"));
    if (Number.isNaN(reviewed.getTime())) {
      setError("Informe a data e a hora do parecer recebido.");
      return;
    }
    if (registration !== "registered" && registration !== "not_applicable") {
      setError("Informe se há registro profissional aplicável.");
      return;
    }
    setError(null);
    start(async () => {
      const r = await recordReviewDecisionAction(pgrId, sampleId, {
        expectedLatestDecisionId,
        status,
        reviewer: {
          fullName: t("fullName"),
          profession: t("profession"),
          registration:
            registration === "registered"
              ? {
                  kind: "registered",
                  council: t("council"),
                  number: t("number"),
                  region: t("region"),
                }
              : { kind: "not_applicable", reason: t("registrationReason") },
        },
        reviewedAt: reviewed.toISOString(),
        evidenceReference: t("evidenceReference"),
        reason: t("reason"),
        findings: findings.map((f) => ({
          ...f,
          correctionReference: f.correctionReference?.trim() || null,
        })),
      });
      if (!r.ok)
        setError(
          r.error.fields ? Object.values(r.error.fields).join(" · ") : r.error.message,
        );
      else router.refresh();
    });
  }
  return (
    <form onSubmit={submit} className="glass-card flex flex-col gap-4 rounded-xl p-5">
      <h2 className="font-semibold">Registrar parecer técnico recebido</h2>
      <p>
        Transcreva o parecer do avaliador e a referência da evidência. O usuário que
        registra o recebimento é identificado separadamente do profissional que emitiu o
        parecer.
      </p>
      <FormError message={error} />
      <SelectField
        name="status"
        label="Conclusão recebida"
        value={status}
        onChange={setStatus}
        options={[
          { value: "accepted", label: "Parecer favorável recebido" },
          { value: "changes_requested", label: "Correções solicitadas" },
        ]}
      />
      <TextField name="fullName" label="Nome completo do avaliador" required />
      <TextField name="profession" label="Profissão do avaliador" required />
      <SelectField
        name="registration"
        label="Registro profissional"
        value={registration}
        onChange={setRegistration}
        options={[
          { value: "registered", label: "Registro aplicável" },
          { value: "not_applicable", label: "Não aplicável — justificar" },
        ]}
      />
      {registration === "registered" ? (
        <>
          <TextField name="council" label="Conselho ou órgão de registro" required />
          <TextField name="number" label="Número do registro" required />
          <TextField name="region" label="Região/UF, quando aplicável" />
        </>
      ) : (
        <TextField
          name="registrationReason"
          label="Justificativa de não aplicação"
          required
        />
      )}
      <TextField
        type="datetime-local"
        name="reviewedAt"
        label="Data e hora informadas no parecer"
        required
      />
      <TextField
        name="evidenceReference"
        label="Referência do parecer recebido (documento no GED ou identificação da evidência)"
        required
      />
      <TextAreaField name="reason" label="Resumo fiel do parecer recebido" required />
      <h3 className="font-semibold">Achados e correções</h3>
      {findings.map((f, i) => (
        <fieldset key={i} className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2">
          <legend>Achado {i + 1}</legend>
          <TextField
            name={`key${i}`}
            label="Código do achado"
            value={f.key}
            readOnly={previousFindings.some((p) => p.key === f.key)}
            onChange={(v) => edit(i, "key", v)}
          />
          <TextField
            name={`location${i}`}
            label="Página, campo ou seção"
            value={f.location}
            onChange={(v) => edit(i, "location", v)}
          />
          <TextAreaField
            name={`description${i}`}
            label="Descrição da divergência"
            value={f.description}
            onChange={(v) => edit(i, "description", v)}
          />
          <SelectField
            name={`severity${i}`}
            label="Impacto informado no parecer"
            value={f.severity}
            onChange={(v) => edit(i, "severity", v)}
            options={[
              { value: "blocking", label: "Impede aceitação" },
              { value: "observation", label: "Observação" },
            ]}
          />
          <SelectField
            name={`resolution${i}`}
            label="Situação na revalidação"
            value={f.resolution}
            onChange={(v) => edit(i, "resolution", v)}
            options={[
              { value: "open", label: "Aberto" },
              { value: "resolved", label: "Corrigido e referenciado" },
            ]}
          />
          <TextField
            name={`correction${i}`}
            label="Referência da correção e revalidação"
            value={f.correctionReference ?? ""}
            onChange={(v) => edit(i, "correctionReference", v)}
          />
          {!previousFindings.some((p) => p.key === f.key) && (
            <button
              type="button"
              onClick={() =>
                setFindings((rows) => rows.filter((_, index) => index !== i))
              }
            >
              Remover achado novo
            </button>
          )}
        </fieldset>
      ))}
      <button
        type="button"
        disabled={findings.length >= 100 || pending}
        className="underline"
        onClick={() =>
          setFindings((rows) => [
            ...rows,
            {
              key: `ACH-${Date.now().toString(36)}`,
              location: "",
              description: "",
              severity: "blocking",
              resolution: "open",
              correctionReference: null,
            },
          ])
        }
      >
        Acrescentar achado
      </button>
      <SubmitButton pending={pending} label="Registrar recebimento do parecer" />
    </form>
  );
}
