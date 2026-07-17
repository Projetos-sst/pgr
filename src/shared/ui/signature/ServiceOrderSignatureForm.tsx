"use client";

import { useRef, useState } from "react";

import { submitPublicSignature } from "@/shared/server/actions/public-signatures";
import { serviceOrderSignaturePayloadSchema } from "@/shared/domains/signatures/targets/service-order";

import { SignaturePad, type SignaturePadHandle } from "./SignaturePad";
import type { PublicFormProps } from "./form-registry";

const brDate = (d: string | null) => (d ? d.split("-").reverse().join("/") : null);

/**
 * Formulário público de captura para `target_type: 'service_order'` (fase 06 / US3). Exibe
 * **apenas** o snapshot congelado recebido no `payload` (título/número/empresa/funcionário/emissão/
 * itens) — NUNCA consulta a OS, o funcionário, riscos ou EPIs ao vivo, e nunca mostra IDs internos,
 * CPF ou dado médico. Reusa `SignaturePad` e `submitPublicSignature` (uso único / anti-replay no
 * servidor). Roda sem Clerk: o isolamento vem do token, não da sessão.
 */
export function ServiceOrderSignatureForm({ token, payload }: PublicFormProps) {
  const parsed = serviceOrderSignaturePayloadSchema.safeParse(payload);
  const data = parsed.success ? parsed.data : null;

  const padRef = useRef<SignaturePadHandle>(null);
  const [signerName, setSignerName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const imageDataUrl = padRef.current?.toDataURL() ?? null;
    if (!imageDataUrl) {
      setError("Desenhe sua assinatura antes de enviar.");
      return;
    }
    setSubmitting(true);
    const result = await submitPublicSignature(token, { signerName, imageDataUrl });
    setSubmitting(false);
    if (result.ok) {
      setDone(true);
      return;
    }
    setError(result.error.message);
  }

  if (done) {
    return (
      <div className="rounded-card border border-green-600/30 bg-green-50 p-4 text-green-800">
        Assinatura registrada com sucesso. Você já pode fechar esta página.
      </div>
    );
  }

  const summary: [string, string | null][] = data
    ? [
        ["Empresa", data.companyName],
        ["Funcionário", data.employeeName],
        ["Emissão", brDate(data.issuedAt)],
      ]
    : [];

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <h1 className="text-text text-xl font-semibold">
          {data ? data.documentTitle : "Assinatura da Ordem de Serviço"}
        </h1>
        {summary.filter(([, v]) => v).length > 0 ? (
          <dl className="mt-2 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
            {summary
              .filter(([, v]) => v)
              .map(([label, value]) => (
                <div key={label} className="flex gap-1">
                  <dt className="text-text-subtle">{label}:</dt>
                  <dd>{value}</dd>
                </div>
              ))}
          </dl>
        ) : null}
      </div>

      {data ? (
        <div className="flex flex-col gap-1 text-sm">
          <span className="text-text-muted font-semibold">
            Itens ({data.items.length})
          </span>
          <ul className="text-text-muted flex list-disc flex-col gap-1 pl-5">
            {data.items.map((item, index) => (
              <li key={index}>{item.description}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-text-muted font-semibold">Seu nome</span>
        <input
          value={signerName}
          onChange={(e) => setSignerName(e.target.value)}
          required
          maxLength={120}
          className="glass-input text-text rounded-card px-3 py-2 outline-none"
          placeholder="Nome completo"
        />
      </label>

      <div className="flex flex-col gap-1 text-sm">
        <span className="text-text-muted font-semibold">Assinatura</span>
        <SignaturePad ref={padRef} />
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <button
        type="submit"
        disabled={submitting}
        className="btn-primary rounded-pill self-start px-5 py-2.5 text-sm font-semibold transition-colors disabled:opacity-60"
      >
        {submitting ? "Enviando…" : "Assinar"}
      </button>
    </form>
  );
}
