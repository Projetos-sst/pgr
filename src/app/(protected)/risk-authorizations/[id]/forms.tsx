"use client";
import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
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
const text = (fd: FormData, name: string) => String(fd.get(name) ?? "");

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
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
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
    setError(null);
    start(async () => {
      const result = await appointCompanyAuthorizerAction(companyId, {
        userId: selected || null,
        evidence: text(fd, "evidence"),
        reason: text(fd, "reason"),
      });
      if (!result.ok)
        setError(
          result.error.fields
            ? Object.values(result.error.fields).join(" · ")
            : result.error.message,
        );
      else router.refresh();
    });
  }
  function grant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    setError(null);
    if (active !== "true" && active !== "false") {
      setError("Selecione a operação de autorização ou revogação.");
      return;
    }
    if (
      active === "true" &&
      registration !== "registered" &&
      registration !== "not_applicable"
    ) {
      setError("Informe se o registro profissional é aplicável.");
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
    start(async () => {
      const result = await authorizeCompanyProfessionalAction(
        companyId,
        active === "true"
          ? { userId: professional, active: true, identity, reason: text(fd, "reason") }
          : { userId: professional, active: false, reason: text(fd, "reason") },
      );
      if (!result.ok)
        setError(
          result.error.fields
            ? Object.values(result.error.fields).join(" · ")
            : result.error.message,
        );
      else router.refresh();
    });
  }
  return (
    <div className="flex flex-col gap-6">
      <FormError message={error} />
      {canAppoint && (
        <form onSubmit={appoint} className="flex flex-col gap-4">
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
            />
            <TextField
              name="evidence"
              label="Evidência da indicação da empresa (documento ou referência)"
              required
            />
            <TextField
              name="reason"
              label="Motivo do registro ou substituição"
              required
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
          <FormSection title="Autorizar ou revogar profissional">
            <SelectField
              name="professional"
              label="Conta do profissional"
              required
              value={professional}
              onChange={setProfessional}
              options={options}
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
                />
                <TextField name="profession" label="Profissão" required />
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
                    />
                    <TextField name="number" label="Número do registro" required />
                    <TextField
                      name="region"
                      label="Região/UF do registro, quando aplicável"
                    />
                  </>
                ) : (
                  <TextField
                    name="registrationReason"
                    label="Justificativa de não aplicação"
                    required
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
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [decision, setDecision] = useState("");
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    setError(null);
    start(async () => {
      const result = await decideCompanyRiskAction(companyId, entryId, {
        status: decision,
        reason: text(fd, "reason"),
        expectedStatus: status,
        expectedReviewedAt: reviewedAt,
      });
      if (!result.ok)
        setError(
          result.error.fields
            ? Object.values(result.error.fields).join(" · ")
            : result.error.message,
        );
      else router.refresh();
    });
  }
  return (
    <form onSubmit={submit} className="mt-3 flex flex-col gap-3">
      <FormError message={error} />
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
      />
      <TextField name="reason" label="Parecer e motivo da decisão" required />
      <SubmitButton pending={pending} label="Registrar decisão" />
    </form>
  );
}
