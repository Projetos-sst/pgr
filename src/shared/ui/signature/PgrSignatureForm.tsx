"use client";

import { useRef, useState } from "react";

import { submitPublicSignature } from "@/shared/server/actions/public-signatures";
import { pgrSignaturePayloadSchema } from "@/shared/domains/signatures/targets/pgr";

import { SignaturePad, type SignaturePadHandle } from "./SignaturePad";
import type { PublicFormProps } from "./form-registry";

const brDate = (d: string | null) => (d ? d.split("-").reverse().join("/") : null);

/**
 * Formulário público de captura para `target_type: 'pgr'` (fatia 022). Exibe **apenas** o
 * snapshot mínimo recebido no `payload` (título/empresa/obra/responsável/datas/revisão) — NUNCA
 * consulta o PGR, a consolidada, funcionários ou riscos ao vivo. Reusa `SignaturePad` e
 * `submitPublicSignature` (uso único / anti-replay do lado servidor).
 */
export function PgrSignatureForm({ token, payload }: PublicFormProps) {
  const parsed = pgrSignaturePayloadSchema.safeParse(payload);
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
      <div className="rounded-md border border-green-600/30 bg-green-50 p-4 text-green-800 dark:bg-green-950 dark:text-green-200">
        Assinatura registrada com sucesso. Você já pode fechar esta página.
      </div>
    );
  }

  const summary: [string, string | null][] = data
    ? [
        ["Empresa", data.companyName],
        ["Obra/Contrato", data.workUnitName],
        ["Responsável", data.responsibleName],
        ["Emissão", brDate(data.issuedAt)],
        ["Validade", brDate(data.validUntil)],
        ["Revisão nº", data.revisionNumber != null ? String(data.revisionNumber) : null],
      ]
    : [];

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">
          {data ? data.documentTitle : "Assinatura do PGR"}
        </h1>
        {summary.filter(([, v]) => v).length > 0 ? (
          <dl className="mt-2 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
            {summary
              .filter(([, v]) => v)
              .map(([label, value]) => (
                <div key={label} className="flex gap-1">
                  <dt className="text-zinc-500">{label}:</dt>
                  <dd>{value}</dd>
                </div>
              ))}
          </dl>
        ) : null}
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Seu nome</span>
        <input
          value={signerName}
          onChange={(e) => setSignerName(e.target.value)}
          required
          maxLength={120}
          className="rounded-md border border-black/15 px-3 py-2 dark:border-white/15"
          placeholder="Nome completo"
        />
      </label>

      <div className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Assinatura</span>
        <SignaturePad ref={padRef} />
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <button
        type="submit"
        disabled={submitting}
        className="bg-foreground text-background self-start rounded-full px-5 py-2.5 text-sm font-medium transition-colors hover:bg-[#383838] disabled:opacity-60"
      >
        {submitting ? "Enviando…" : "Assinar"}
      </button>
    </form>
  );
}
