"use client";

import { useEffect, useState } from "react";

import {
  getSignatureStatus,
  type CreateSignatureRequestResult,
  type SignatureStatusResult,
} from "@/shared/server/actions/signatures";
import { requestInspectionSignatureAction } from "@/shared/server/actions/inspections/safety-inspections";
import { QrCode } from "@/shared/ui/signature/QrCode";

const POLL_INTERVAL_MS = 3000;

const STATUS_LABELS: Record<SignatureStatusResult["status"], string> = {
  pending: "Aguardando",
  signed: "Assinado",
  expired: "Expirado",
  cancelled: "Cancelado",
};

// Solicita assinatura digital da inspeção reusando a infra de assinaturas
// (target_type `inspection`); o payload é montado no servidor.
export function InspectionSignaturePanel({ inspectionId }: { inspectionId: string }) {
  const [generating, setGenerating] = useState(false);
  const [request, setRequest] = useState<CreateSignatureRequestResult | null>(null);
  const [status, setStatus] = useState<SignatureStatusResult["status"]>("pending");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!request || status !== "pending") return;
    const id = setInterval(async () => {
      const result = await getSignatureStatus(request.requestId);
      if (result.ok) setStatus(result.data.status);
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [request, status]);

  async function handleGenerate() {
    setError(null);
    setGenerating(true);
    const result = await requestInspectionSignatureAction(inspectionId);
    setGenerating(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setRequest(result.data);
    setStatus("pending");
    setCopied(false);
  }

  async function handleCopy() {
    if (!request) return;
    await navigator.clipboard.writeText(request.publicUrl);
    setCopied(true);
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-black/10 p-4 dark:border-white/10">
      <span className="text-sm font-medium">Assinatura digital</span>
      {!request ? (
        <button
          type="button"
          onClick={handleGenerate}
          disabled={generating}
          className="self-start rounded-full bg-black px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-black/85 disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {generating ? "Gerando…" : "Solicitar assinatura (link/QR)"}
        </button>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Status:</span>
            <span
              className={`rounded-full px-3 py-1 text-sm ${
                status === "signed"
                  ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200"
                  : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200"
              }`}
            >
              {STATUS_LABELS[status]}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <code className="max-w-md truncate rounded-md border border-black/10 px-2 py-1 text-xs dark:border-white/10">
              {request.publicUrl}
            </code>
            <button
              type="button"
              onClick={handleCopy}
              className="rounded-md border border-black/15 px-3 py-1 text-sm transition-colors hover:bg-black/5 dark:border-white/15"
            >
              {copied ? "Copiado!" : "Copiar link"}
            </button>
          </div>
          <QrCode dataUrl={request.qrCodeDataUrl} />
        </div>
      )}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
