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
    <div className="glass-card flex flex-col gap-3 p-4">
      <span className="text-text text-sm font-semibold">Assinatura digital</span>
      {!request ? (
        <button
          type="button"
          onClick={handleGenerate}
          disabled={generating}
          className="btn-primary rounded-pill self-start px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50"
        >
          {generating ? "Gerando…" : "Solicitar assinatura (link/QR)"}
        </button>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="text-text text-sm font-semibold">Status:</span>
            <span
              className={`rounded-full px-3 py-1 text-sm ${
                status === "signed"
                  ? "bg-green-100 text-green-800"
                  : "bg-amber-100 text-amber-800"
              }`}
            >
              {STATUS_LABELS[status]}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <code className="glass-panel text-text-muted rounded-card max-w-md truncate px-2 py-1 text-xs">
              {request.publicUrl}
            </code>
            <button
              type="button"
              onClick={handleCopy}
              className="glass-panel text-text-muted rounded-card hover:text-text px-3 py-1 text-sm font-semibold transition-colors"
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
