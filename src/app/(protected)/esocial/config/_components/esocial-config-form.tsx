"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent, type ReactNode } from "react";

import { saveEsocialConfigAction } from "@/shared/server/actions/esocial/config";
import {
  CHECK_FREQUENCY_OPTIONS,
  DEFAULT_ESOCIAL_CONFIG,
  SST_CONFIG_EVENTS,
  checkFrequencyLabel,
  type EsocialConfig,
  type EsocialConfigInput,
  type EsocialEventCounts,
} from "@/shared/domains/esocial/config";

import { FormError, TextField } from "../../../_ui/form";

// Descrições dos eventos SST configuráveis (espelham o mockup).
const EVENT_DESCRIPTIONS: Record<string, string> = {
  "S-2210": "Comunicação de Acidente de Trabalho",
  "S-2220": "Monitoramento da Saúde do Trabalhador",
  "S-2240": "Condições Ambientais do Trabalho — Agentes Nocivos",
};

function Switch({
  on,
  onToggle,
  label,
}: {
  on: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onToggle}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
        on ? "bg-primary" : "bg-text-subtle/35"
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
          on ? "right-0.5" : "left-0.5"
        }`}
      />
    </button>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="glass-card rounded-[20px] p-6">
      <h2 className="text-primary mb-4 font-mono text-[11px] tracking-[0.14em] uppercase">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function EsocialConfigForm({
  config,
  counts,
}: {
  config: EsocialConfig | null;
  counts: EsocialEventCounts;
}) {
  const router = useRouter();
  const init = config ?? DEFAULT_ESOCIAL_CONFIG;
  const [environment, setEnvironment] = useState<EsocialConfigInput["environment"]>(
    (init.environment as EsocialConfigInput["environment"]) ?? "homologation",
  );
  const [enabled, setEnabled] = useState<Set<string>>(
    new Set(config?.enabledEvents ?? [...SST_CONFIG_EVENTS]),
  );
  const [autoSend, setAutoSend] = useState<boolean>(config?.autoSend ?? false);
  const [frequency, setFrequency] = useState<string>(
    String(config?.checkFrequencyHours ?? 24),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function toggleEvent(code: string) {
    setEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const value = (k: string) => String(fd.get(k) ?? "");
    const input: EsocialConfigInput = {
      environment,
      employerCnpj: value("employerCnpj"),
      taxClassification: value("taxClassification"),
      certificateName: value("certificateName"),
      certificateExpiresAt: value("certificateExpiresAt"),
      enabledEvents: [...enabled],
      autoSend,
      checkFrequencyHours: frequency,
    };
    setSaved(false);
    startTransition(async () => {
      const result = await saveEsocialConfigAction(input);
      if (result.ok) {
        setErrors({});
        setFormError(null);
        setSaved(true);
        router.refresh();
        return;
      }
      setErrors(result.error.fields ?? {});
      setFormError(result.error.fields ? null : result.error.message);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex items-center justify-end gap-3">
        {saved ? (
          <span className="text-accent-green text-[13px] font-semibold">
            Configurações salvas ✓
          </span>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="btn-primary flex h-11 items-center gap-2 rounded-xl px-5 text-[13px] font-bold transition-colors disabled:opacity-50"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden
          >
            <path d="M5 13l4 4L19 7" />
          </svg>
          {pending ? "Salvando…" : "Salvar configurações"}
        </button>
      </div>

      <FormError message={formError} />

      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr] lg:items-start">
        {/* LEFT — forms */}
        <div className="flex flex-col gap-5">
          <Card title="Ambiente & Certificado">
            <div className="flex flex-col gap-4">
              <div>
                <span className="text-text-muted mb-1.5 block text-xs font-semibold">
                  Ambiente de transmissão
                </span>
                <div className="flex gap-2">
                  {(["production", "homologation"] as const).map((env) => (
                    <button
                      key={env}
                      type="button"
                      onClick={() => setEnvironment(env)}
                      aria-pressed={environment === env}
                      className={`h-[42px] flex-1 rounded-xl text-[13px] font-bold transition-colors ${
                        environment === env
                          ? "btn-primary"
                          : "text-text-muted border border-white/70 bg-white/50 hover:bg-white/70"
                      }`}
                    >
                      {env === "production" ? "Produção" : "Homologação"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  label="Certificado digital (A1)"
                  name="certificateName"
                  placeholder="Ex.: EMPRESA_A1.pfx"
                  defaultValue={config?.certificateName ?? ""}
                  error={errors.certificateName}
                />
                <TextField
                  label="Validade do certificado"
                  name="certificateExpiresAt"
                  type="date"
                  defaultValue={config?.certificateExpiresAt ?? ""}
                  error={errors.certificateExpiresAt}
                />
              </div>
              <p className="text-text-subtle -mt-1 text-xs">
                Registro informativo do certificado em uso (nome e validade) para o alerta
                de vencimento. O upload do arquivo .pfx e a assinatura de transmissão não
                fazem parte desta tela.
              </p>

              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  label="CNPJ empregador"
                  name="employerCnpj"
                  isMono
                  placeholder="00.000.000/0000-00"
                  defaultValue={config?.employerCnpj ?? ""}
                  error={errors.employerCnpj}
                />
                <TextField
                  label="Classificação tributária"
                  name="taxClassification"
                  placeholder="Ex.: 01 — Lucro Real"
                  defaultValue={config?.taxClassification ?? ""}
                  error={errors.taxClassification}
                />
              </div>
            </div>
          </Card>

          <Card title="Eventos SST habilitados">
            <div className="flex flex-col">
              {SST_CONFIG_EVENTS.map((code, i) => (
                <div
                  key={code}
                  className={`flex items-center gap-3.5 py-3 ${
                    i < SST_CONFIG_EVENTS.length - 1
                      ? "border-b border-[rgba(120,120,150,0.1)]"
                      : ""
                  }`}
                >
                  <span className="text-primary w-16 shrink-0 font-mono text-[13px] font-semibold">
                    {code}
                  </span>
                  <span className="text-text flex-1 text-[13px] font-semibold">
                    {EVENT_DESCRIPTIONS[code]}
                  </span>
                  <Switch
                    on={enabled.has(code)}
                    onToggle={() => toggleEvent(code)}
                    label={`Habilitar ${code}`}
                  />
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* RIGHT — automação + resumo real */}
        <div className="flex flex-col gap-5">
          <section className="via-primary shadow-primary/30 rounded-[20px] bg-gradient-to-br from-[#4f46e5] to-[#7c7bf7] p-6 text-white shadow-lg">
            <h2 className="mb-4 font-mono text-[11px] tracking-[0.14em] text-white/70 uppercase">
              Envio automático
            </h2>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-bold">
                  {autoSend ? "Ativado" : "Desativado"}
                </div>
                <div className="text-xs text-white/75">
                  Verificação {checkFrequencyLabel(Number(frequency))}
                </div>
              </div>
              <Switch
                on={autoSend}
                onToggle={() => setAutoSend((v) => !v)}
                label="Envio automático"
              />
            </div>
            <label className="mt-4 block">
              <span className="mb-1.5 block text-xs font-semibold text-white/80">
                Frequência de verificação
              </span>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
                className="h-11 w-full rounded-xl border border-white/25 bg-white/15 px-3.5 text-[13px] font-semibold text-white backdrop-blur-sm outline-none [&>option]:text-[#1b1f2e]"
              >
                {CHECK_FREQUENCY_OPTIONS.map((h) => (
                  <option key={h} value={h}>
                    {checkFrequencyLabel(h)}
                  </option>
                ))}
              </select>
            </label>
            <p className="mt-3 text-[11px] leading-relaxed text-white/70">
              O envio automático registra sua preferência. A transmissão dos eventos é
              executada pela integração do eSocial — esta tela não dispara envios.
            </p>
          </section>

          <Card title="Eventos (situação atual)">
            <div className="grid grid-cols-3 gap-3 text-center">
              {[
                { n: counts.pending, l: "Pendentes" },
                { n: counts.sent, l: "Enviados" },
                { n: counts.total, l: "Total" },
              ].map((s) => (
                <div
                  key={s.l}
                  className="rounded-xl border border-white/60 bg-white/40 p-3"
                >
                  <div className="text-text text-2xl font-extrabold tabular-nums">
                    {s.n}
                  </div>
                  <div className="text-text-subtle text-[11px] font-semibold">{s.l}</div>
                </div>
              ))}
            </div>
            <p className="text-text-subtle mt-3 text-[11px]">
              Contagens reais dos eventos SST do escritório (derivadas da base).
            </p>
          </Card>
        </div>
      </div>
    </form>
  );
}
