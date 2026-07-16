"use client";

import { useEffect, useState } from "react";

import {
  createSignatureRequest,
  getSignatureStatus,
  signManually,
  type CreateSignatureRequestResult,
  type SignatureStatusResult,
} from "@/shared/server/actions/signatures";
import { QrCode } from "@/shared/ui/signature/QrCode";

const POLL_INTERVAL_MS = 3000;

const STATUS_LABELS: Record<SignatureStatusResult["status"], string> = {
  pending: "Aguardando",
  signed: "Assinado",
  expired: "Expirado",
  cancelled: "Cancelado",
};

export function SignaturePanel() {
  const [title, setTitle] = useState("Termo de demonstração");
  const [generating, setGenerating] = useState(false);
  const [request, setRequest] = useState<CreateSignatureRequestResult | null>(null);
  const [status, setStatus] = useState<SignatureStatusResult["status"]>("pending");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Polling de status (~3s) enquanto o pedido está pendente → reflete <5s (FR-013).
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
    const result = await createSignatureRequest({
      targetType: "demo",
      payload: { title },
    });
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

  async function handleManual() {
    if (!request) return;
    const signerName = window.prompt("Nome de quem assinou (manual):")?.trim();
    if (!signerName) return;
    const result = await signManually(request.requestId, { signerName });
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setStatus("signed");
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 rounded-xl border border-black/10 p-4 dark:border-white/10">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Título do termo (payload demo)</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="max-w-md rounded-md border border-black/15 px-3 py-2 dark:border-white/15"
          />
        </label>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={generating}
          className="btn-primary rounded-pill self-start px-5 py-2.5 text-sm font-semibold transition-colors disabled:opacity-60"
        >
          {generating ? "Gerando…" : "Gerar link/QR"}
        </button>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </div>

      {request ? (
        <div className="flex flex-col gap-4 rounded-xl border border-black/10 p-4 dark:border-white/10">
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

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">Link público</span>
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
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">QR Code</span>
            <QrCode dataUrl={request.qrCodeDataUrl} />
          </div>

          {status === "pending" ? (
            <button
              type="button"
              onClick={handleManual}
              className="self-start rounded-md border border-black/15 px-3 py-1 text-sm transition-colors hover:bg-black/5 dark:border-white/15"
            >
              Registrar assinatura manual
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
