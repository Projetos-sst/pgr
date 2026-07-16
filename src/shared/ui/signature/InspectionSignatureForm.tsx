"use client";

import { useRef, useState } from "react";

import { inspectionPayloadSchema } from "@/shared/domains/signatures/targets/inspection";
import { submitPublicSignature } from "@/shared/server/actions/public-signatures";

import { SignaturePad, type SignaturePadHandle } from "./SignaturePad";
import type { PublicFormProps } from "./form-registry";

/** Formulário público de captura para `target_type: 'inspection'` (fatia 039). */
export function InspectionSignatureForm({ token, payload }: PublicFormProps) {
  const parsed = inspectionPayloadSchema.safeParse(payload);
  const data = parsed.success ? parsed.data : { title: "Inspeção de segurança" };

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
      <div className="rounded-card border border-green-300 bg-green-50 p-6 text-center text-green-800">
        Assinatura registrada. Obrigado!
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-text text-xl font-semibold">{data.title}</h1>
        <dl className="text-text-muted text-sm">
          {data.category ? (
            <div className="flex gap-2">
              <dt className="font-medium">Categoria:</dt>
              <dd>{data.category}</dd>
            </div>
          ) : null}
          {data.area ? (
            <div className="flex gap-2">
              <dt className="font-medium">Área:</dt>
              <dd>{data.area}</dd>
            </div>
          ) : null}
          {data.responsible ? (
            <div className="flex gap-2">
              <dt className="font-medium">Responsável:</dt>
              <dd>{data.responsible}</dd>
            </div>
          ) : null}
          {data.inspectedAt ? (
            <div className="flex gap-2">
              <dt className="font-medium">Data:</dt>
              <dd>{data.inspectedAt}</dd>
            </div>
          ) : null}
          {typeof data.occurrenceCount === "number" ? (
            <div className="flex gap-2">
              <dt className="font-medium">Ocorrências:</dt>
              <dd>{data.occurrenceCount}</dd>
            </div>
          ) : null}
        </dl>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-text-muted text-sm font-semibold">Seu nome</span>
        <input
          value={signerName}
          onChange={(e) => setSignerName(e.target.value)}
          className="glass-input text-text rounded-card px-3 py-2 text-sm outline-none"
          required
        />
      </label>

      <div className="flex flex-col gap-1">
        <span className="text-text-muted text-sm font-semibold">Assinatura</span>
        <SignaturePad ref={padRef} />
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <button
        type="submit"
        disabled={submitting}
        className="btn-primary rounded-pill px-5 py-2 text-sm font-semibold transition-colors disabled:opacity-50"
      >
        {submitting ? "Enviando…" : "Assinar"}
      </button>
    </form>
  );
}
