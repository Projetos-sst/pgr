"use client";

import { useRef, useState } from "react";

import { submitPublicSignature } from "@/shared/server/actions/public-signatures";
import { demoPayloadSchema } from "@/shared/domains/signatures/targets/demo";

import { SignaturePad, type SignaturePadHandle } from "./SignaturePad";
import type { PublicFormProps } from "./form-registry";

/** Formulário público de captura para `target_type: 'demo'`. */
export function DemoSignatureForm({ token, payload }: PublicFormProps) {
  const parsed = demoPayloadSchema.safeParse(payload);
  const data = parsed.success
    ? parsed.data
    : { title: "Assinatura", description: undefined };

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

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">{data.title}</h1>
        {data.description ? (
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {data.description}
          </p>
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
        className="btn-primary rounded-pill self-start px-5 py-2.5 text-sm font-semibold transition-colors disabled:opacity-60"
      >
        {submitting ? "Enviando…" : "Assinar"}
      </button>
    </form>
  );
}
