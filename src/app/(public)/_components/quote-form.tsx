"use client";

import { useId, useState, useTransition } from "react";
import Link from "next/link";

import { submitPlatformLead } from "@/shared/server/actions/public-leads";
import {
  LEAD_INTEREST_LABEL,
  LEAD_INTEREST_VALUES,
  leadInputSchema,
  type LeadValues,
} from "@/shared/domains/platform/leads";

import { Icon } from "./icon";

type Interest = LeadValues["interest"];

const FIELD =
  "glass-input rounded-field text-text placeholder:text-text-subtle w-full px-4 py-3 text-sm transition-colors";
const LABEL = "text-text block text-sm font-semibold";
const ERROR = "text-danger mt-1.5 flex items-start gap-1.5 text-xs";

/**
 * Formulário de solicitação de orçamento.
 *
 * O mesmo schema Zod valida no cliente (para dar retorno imediato) e no
 * servidor (porque o cliente não é confiável). O envio vai por Server Action —
 * não há endpoint público de leitura de leads.
 */
export function QuoteForm({ initialInterest }: { initialInterest: Interest | null }) {
  const formId = useId();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);

    const form = new FormData(event.currentTarget);
    const candidate = {
      name: String(form.get("name") ?? ""),
      company: String(form.get("company") ?? ""),
      email: String(form.get("email") ?? ""),
      phone: String(form.get("phone") ?? ""),
      interest: String(form.get("interest") ?? ""),
      message: String(form.get("message") ?? ""),
      source: "quote" as const,
    };

    const parsed = leadInputSchema.safeParse(candidate);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (typeof key === "string" && !(key in fieldErrors)) {
          fieldErrors[key] = issue.message;
        }
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});

    startTransition(async () => {
      const result = await submitPlatformLead(parsed.data);
      if (result.ok) {
        setDone(true);
        return;
      }
      if (result.error.fields) setErrors(result.error.fields);
      setSubmitError(result.error.message);
    });
  }

  if (done) {
    return (
      <div
        role="status"
        className="rounded-[18px] border border-white/70 bg-white/70 p-8 text-center sm:p-10"
      >
        <span className="bg-accent-green/12 text-accent-green mx-auto flex h-14 w-14 items-center justify-center rounded-full">
          <Icon name="check" className="h-7 w-7" strokeWidth={2.4} />
        </span>
        <h2 className="text-text mt-6 text-xl font-extrabold tracking-tight">
          Solicitação registrada
        </h2>
        <p className="text-text-muted mx-auto mt-3 max-w-[420px] text-sm leading-6">
          Seu pedido ficou gravado na nossa base de interessados. A equipe comercial
          retorna o contato pelo e-mail ou telefone informados.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link
            href="/"
            className="btn-primary rounded-pill focus-visible:ring-primary px-5 py-2.5 text-sm font-bold focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            Voltar ao início
          </Link>
          <Link
            href="/seguranca-do-trabalho"
            className="text-text-muted hover:text-text rounded-pill focus-visible:ring-primary border border-white/70 bg-white/70 px-5 py-2.5 text-sm font-bold transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            Conhecer a plataforma
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="rounded-[18px] border border-white/70 bg-white/70 p-6 sm:p-8"
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          id={`${formId}-name`}
          name="name"
          label="Seu nome"
          autoComplete="name"
          error={errors.name}
          required
        />
        <Field
          id={`${formId}-company`}
          name="company"
          label="Empresa"
          autoComplete="organization"
          error={errors.company}
          required
        />
        <Field
          id={`${formId}-email`}
          name="email"
          label="E-mail"
          type="email"
          autoComplete="email"
          inputMode="email"
          error={errors.email}
          required
        />
        <Field
          id={`${formId}-phone`}
          name="phone"
          label="Telefone ou WhatsApp"
          type="tel"
          autoComplete="tel"
          inputMode="tel"
          placeholder="(11) 99999-9999"
          error={errors.phone}
          required
        />
      </div>

      <fieldset className="mt-6">
        <legend className={LABEL}>
          Área de interesse <span className="text-danger">*</span>
        </legend>
        <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
          {LEAD_INTEREST_VALUES.map((value) => (
            <label
              key={value}
              className="rounded-field has-checked:border-primary has-checked:bg-primary/[0.07] has-focus-visible:ring-primary flex cursor-pointer items-center gap-2.5 border border-white/75 bg-white/55 px-4 py-3 text-sm font-semibold transition-colors has-focus-visible:ring-2"
            >
              <input
                type="radio"
                name="interest"
                value={value}
                defaultChecked={(initialInterest ?? "both") === value}
                className="accent-primary h-4 w-4"
              />
              {LEAD_INTEREST_LABEL[value]}
            </label>
          ))}
        </div>
        {errors.interest ? (
          <p className={ERROR}>
            <ErrorIcon />
            {errors.interest}
          </p>
        ) : null}
      </fieldset>

      <div className="mt-6">
        <label htmlFor={`${formId}-message`} className={LABEL}>
          Mensagem <span className="text-text-subtle font-normal">(opcional)</span>
        </label>
        <textarea
          id={`${formId}-message`}
          name="message"
          rows={4}
          maxLength={1200}
          placeholder="Quantas empresas você atende? Há algo específico que você precisa ver?"
          aria-invalid={errors.message ? true : undefined}
          aria-describedby={errors.message ? `${formId}-message-error` : undefined}
          className={`${FIELD} mt-2 resize-y`}
        />
        {errors.message ? (
          <p id={`${formId}-message-error`} className={ERROR}>
            <ErrorIcon />
            {errors.message}
          </p>
        ) : null}
      </div>

      {submitError ? (
        <p
          role="alert"
          className="rounded-field border-danger/30 bg-danger/[0.06] text-danger mt-6 border px-4 py-3 text-sm"
        >
          {submitError}
        </p>
      ) : null}

      <div className="mt-7 flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={pending}
          className="btn-primary rounded-pill focus-visible:ring-primary px-6 py-3 text-sm font-bold transition-opacity focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-60"
        >
          {pending ? "Enviando…" : "Enviar solicitação"}
        </button>
        <p className="text-text-subtle text-xs leading-5">
          Usamos esses dados apenas para responder ao seu pedido.
        </p>
      </div>
    </form>
  );
}

function ErrorIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      className="mt-px h-3.5 w-3.5 shrink-0"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v4M12 16h.01" />
    </svg>
  );
}

function Field({
  id,
  name,
  label,
  error,
  required,
  ...rest
}: {
  id: string;
  name: string;
  label: string;
  error?: string;
  required?: boolean;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label htmlFor={id} className={LABEL}>
        {label} {required ? <span className="text-danger">*</span> : null}
      </label>
      <input
        id={id}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`${FIELD} mt-2`}
        {...rest}
      />
      {error ? (
        <p id={`${id}-error`} className={ERROR}>
          <ErrorIcon />
          {error}
        </p>
      ) : null}
    </div>
  );
}
