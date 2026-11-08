"use client";
import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  EMPTY_FORM_FEEDBACK,
  formFeedback,
  pathDescriber,
  unexpectedFormFeedback,
  type FormFeedback,
} from "@/shared/domains/medicine/form-feedback";
import {
  appointCompanyAuthorizerAction,
  authorizeCompanyProfessionalAction,
  decideCompanyRiskAction,
} from "@/shared/server/actions/medicine/risk-authorizations";
import {
  FormError,
  FormSection,
  SelectField,
  TextField,
  SubmitButton,
} from "../../_ui/form";
type Candidate = { userId: string; label: string; email: string | null };
type Result =
  | { ok: true }
  | {
      ok: false;
      error: { code: string; message: string; fields?: Record<string, string> };
    };
const text = (fd: FormData, name: string) => String(fd.get(name) ?? "");

const describeAuthorizationPath = pathDescriber({
  fields: {
    userId: "Conta",
    evidence: "Evidência da indicação",
    reason: "Motivo",
    active: "Operação",
    identity: "Identificação do profissional",
    "identity.fullName": "Nome completo do profissional",
    "identity.profession": "Profissão",
    "identity.registration": "Registro profissional",
    "identity.registration.kind": "Registro profissional",
    "identity.registration.council": "Conselho ou órgão de registro",
    "identity.registration.number": "Número do registro",
    "identity.registration.region": "Região/UF do registro",
    "identity.registration.reason": "Justificativa de não aplicação",
    status: "Decisão técnica",
  },
});

/**
 * Envio com retorno por campo: erro de validação vai ao campo (ou ao resumo, com
 * rótulo legível, quando a tela não tem lugar para ele); permissão e regra do
 * servidor ficam no resumo; falha inesperada vira mensagem segura.
 */
function useFeedbackSubmit() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [feedback, setFeedback] = useState<FormFeedback>(EMPTY_FORM_FEEDBACK);
  const run = (fn: () => Promise<Result>, slots: readonly string[]) => {
    setFeedback(EMPTY_FORM_FEEDBACK);
    start(async () => {
      let result: Result;
      try {
        result = await fn();
      } catch {
        setFeedback(unexpectedFormFeedback());
        return;
      }
      if (result.ok) router.refresh();
      else
        setFeedback(
          formFeedback(result.error, { slots, describe: describeAuthorizationPath }),
        );
    });
  };
  const fail = (message: string) =>
    setFeedback({ formError: message, details: [], fields: {} });
  return { pending, feedback, run, fail };
}

export function AuthorizationForms({
  companyId,
  canAppoint,
  canAuthorize,
  candidates,
  currentAuthorizer,
}: {
  companyId: string;
  canAppoint: boolean;
  canAuthorize: boolean;
  candidates: Candidate[];
  currentAuthorizer: string | null;
}) {
  const appointSubmit = useFeedbackSubmit();
  const grantSubmit = useFeedbackSubmit();
  const pending = appointSubmit.pending || grantSubmit.pending;
  const appointFields = appointSubmit.feedback.fields;
  const grantFields = grantSubmit.feedback.fields;
  const [selected, setSelected] = useState(currentAuthorizer ?? "");
  const [professional, setProfessional] = useState("");
  const [active, setActive] = useState("true");
  const [registration, setRegistration] = useState("registered");
  const options = candidates.map((c) => ({
    value: c.userId,
    label: c.email ? `${c.label} (${c.email})` : c.label,
  }));
  function appoint(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    appointSubmit.run(
      () =>
        appointCompanyAuthorizerAction(companyId, {
          userId: selected || null,
          evidence: text(fd, "evidence"),
          reason: text(fd, "reason"),
        }),
      ["userId", "evidence", "reason"],
    );
  }
  function grant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    if (active !== "true" && active !== "false") {
      grantSubmit.fail("Selecione a operação de autorização ou revogação.");
      return;
    }
    if (
      active === "true" &&
      registration !== "registered" &&
      registration !== "not_applicable"
    ) {
      grantSubmit.fail("Informe se o registro profissional é aplicável.");
      return;
    }
    const identity = {
      fullName: text(fd, "fullName"),
      profession: text(fd, "profession"),
      registration:
        registration === "registered"
          ? {
              kind: "registered",
              council: text(fd, "council"),
              number: text(fd, "number"),
              region: text(fd, "region"),
            }
          : { kind: "not_applicable", reason: text(fd, "registrationReason") },
    };
    // Só os campos que estão na tela recebem o erro no próprio campo.
    const slots = [
      "userId",
      "reason",
      ...(active === "true"
        ? [
            "identity.fullName",
            "identity.profession",
            ...(registration === "registered"
              ? [
                  "identity.registration.council",
                  "identity.registration.number",
                  "identity.registration.region",
                ]
              : ["identity.registration.reason"]),
          ]
        : []),
    ];
    grantSubmit.run(
      () =>
        authorizeCompanyProfessionalAction(
          companyId,
          active === "true"
            ? { userId: professional, active: true, identity, reason: text(fd, "reason") }
            : { userId: professional, active: false, reason: text(fd, "reason") },
        ),
      slots,
    );
  }
  return (
    <div className="flex flex-col gap-6">
      {canAppoint && (
        <form onSubmit={appoint} className="flex flex-col gap-4">
          <FormError
            message={appointSubmit.feedback.formError}
            details={appointSubmit.feedback.details}
          />
          <FormSection title="Registrar indicação da empresa-cliente">
            <p className="text-sm">
              Registre a pessoa indicada pela empresa. Isso não concede autorização para
              validar riscos. As contas precisam estar previamente vinculadas ao
              escritório.
            </p>
            <SelectField
              name="authorizer"
              label="Autorizador indicado"
              value={selected}
              onChange={setSelected}
              options={options}
              emptyLabel="Sem autorizador (revogar indicação)"
              error={appointFields.userId}
            />
            <TextField
              name="evidence"
              label="Evidência da indicação da empresa (documento ou referência)"
              required
              error={appointFields.evidence}
            />
            <TextField
              name="reason"
              label="Motivo do registro ou substituição"
              required
              error={appointFields.reason}
            />
            <p className="text-sm">
              Substituir ou revogar a indicação retira o poder do autorizador anterior.
              Autorizações profissionais existentes exigem revogação explícita.
            </p>
          </FormSection>
          <SubmitButton pending={pending} label="Registrar indicação" />
        </form>
      )}
      {canAuthorize && (
        <form onSubmit={grant} className="flex flex-col gap-4">
          <FormError
            message={grantSubmit.feedback.formError}
            details={grantSubmit.feedback.details}
          />
          <FormSection title="Autorizar ou revogar profissional">
            <SelectField
              name="professional"
              label="Conta do profissional"
              required
              value={professional}
              onChange={setProfessional}
              options={options}
              error={grantFields.userId}
            />
            <SelectField
              name="active"
              label="Operação"
              value={active}
              onChange={setActive}
              options={[
                { value: "true", label: "Conceder ou atualizar autorização" },
                { value: "false", label: "Revogar autorização" },
              ]}
            />
            {active === "true" && (
              <>
                <TextField
                  name="fullName"
                  label="Nome completo do profissional"
                  required
                  error={grantFields["identity.fullName"]}
                />
                <TextField
                  name="profession"
                  label="Profissão"
                  required
                  error={grantFields["identity.profession"]}
                />
                <SelectField
                  name="registrationKind"
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
                    <TextField
                      name="council"
                      label="Conselho ou órgão de registro"
                      required
                      error={grantFields["identity.registration.council"]}
                    />
                    <TextField
                      name="number"
                      label="Número do registro"
                      required
                      error={grantFields["identity.registration.number"]}
                    />
                    <TextField
                      name="region"
                      label="Região/UF do registro, quando aplicável"
                      error={grantFields["identity.registration.region"]}
                    />
                  </>
                ) : (
                  <TextField
                    name="registrationReason"
                    label="Justificativa de não aplicação"
                    required
                    error={grantFields["identity.registration.reason"]}
                  />
                )}
                <p className="text-sm">
                  A identificação é declarada pela empresa. O cadastro não verifica
                  habilitação em conselho nem substitui responsabilidade técnica.
                </p>
              </>
            )}
            <TextField
              name="reason"
              label="Motivo da autorização ou revogação"
              required
              error={grantFields.reason}
            />
          </FormSection>
          <SubmitButton pending={pending} label="Registrar autorização" />
        </form>
      )}
    </div>
  );
}

export function RiskDecisionForm({
  companyId,
  entryId,
  status,
  reviewedAt,
}: {
  companyId: string;
  entryId: string;
  status: string;
  reviewedAt: string | null;
}) {
  const { pending, feedback, run } = useFeedbackSubmit();
  const [decision, setDecision] = useState("");
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    run(
      () =>
        decideCompanyRiskAction(companyId, entryId, {
          status: decision,
          reason: text(fd, "reason"),
          expectedStatus: status,
          expectedReviewedAt: reviewedAt,
        }),
      ["status", "reason"],
    );
  }
  return (
    <form onSubmit={submit} className="mt-3 flex flex-col gap-3">
      <FormError message={feedback.formError} details={feedback.details} />
      <SelectField
        name="decision"
        label="Decisão técnica"
        required
        value={decision}
        onChange={setDecision}
        options={[
          { value: "validated", label: "Validar" },
          { value: "rejected", label: "Rejeitar" },
        ]}
        error={feedback.fields.status}
      />
      <TextField
        name="reason"
        label="Parecer e motivo da decisão"
        required
        error={feedback.fields.reason}
      />
      <SubmitButton pending={pending} label="Registrar decisão" />
    </form>
  );
}
