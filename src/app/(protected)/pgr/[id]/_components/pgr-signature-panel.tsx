"use client";

import { useState, useTransition } from "react";

import {
  createPgrSignatureRequestAction,
  getPgrSignatureViewAction,
} from "@/shared/server/actions/pgr/pgr-signature";
import type {
  PgrSignatureState,
  PgrSignatureView,
} from "@/shared/domains/pgr/pgr-signature";
import { QrCode } from "@/shared/ui/signature/QrCode";

const STATE_LABEL: Record<PgrSignatureState, string> = {
  none: "Sem solicitação",
  pending: "Aguardando assinatura",
  signed: "Assinado",
  expired: "Expirado",
  cancelled: "Cancelado",
};

const STATE_CLASS: Record<PgrSignatureState, string> = {
  none: "bg-black/5 text-text-muted",
  pending: "bg-amber-100 text-amber-800",
  signed: "bg-green-100 text-green-800",
  expired: "bg-red-50 text-red-700",
  cancelled: "bg-black/5 text-text-muted",
};

/**
 * Painel protegido de assinatura do PGR (fatia 022). O **estado** vem do servidor (derivado, sem
 * coluna no `pgr`). O **link/QR só aparece na resposta recém-criada** — nunca é persistido no
 * navegador nem reexibido após reload (o token cru não é recuperável). Gerar outro link consome
 * outra unidade da cota mensal.
 */
export function PgrSignaturePanel({
  pgrId,
  signature,
}: {
  pgrId: string;
  signature?: PgrSignatureView;
}) {
  const [state, setState] = useState<PgrSignatureState>(signature?.state ?? "none");
  const [signerName, setSignerName] = useState<string | null>(
    signature?.signerName ?? null,
  );
  const [fresh, setFresh] = useState<{ publicUrl: string; qrCodeDataUrl: string } | null>(
    null,
  );
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleGenerate() {
    setError(null);
    setCopied(false);
    startTransition(async () => {
      const res = await createPgrSignatureRequestAction({ pgrId });
      if (!res.ok) {
        setError(
          res.error.code === "QUOTA_EXCEEDED"
            ? "Cota mensal de assinaturas atingida no plano atual."
            : res.error.message,
        );
        return;
      }
      setFresh({ publicUrl: res.data.publicUrl, qrCodeDataUrl: res.data.qrCodeDataUrl });
      setState("pending");
      setSignerName(null);
    });
  }

  function handleRefresh() {
    startTransition(async () => {
      const res = await getPgrSignatureViewAction({ pgrId });
      if (res.ok) {
        setState(res.data.state);
        setSignerName(res.data.signerName);
      }
    });
  }

  async function handleCopy() {
    if (!fresh) return;
    await navigator.clipboard.writeText(fresh.publicUrl);
    setCopied(true);
  }

  return (
    <section className="glass-card flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-text text-sm font-semibold">Assinatura do PGR</h3>
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${STATE_CLASS[state]}`}
        >
          {STATE_LABEL[state]}
          {state === "signed" && signerName ? ` · ${signerName}` : ""}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={pending}
          className="btn-primary rounded-pill px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50"
        >
          {pending ? "…" : "Gerar link de assinatura"}
        </button>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={pending}
          className="glass-panel text-text-muted rounded-card hover:text-text px-3 py-2 text-sm font-semibold transition-colors disabled:opacity-50"
        >
          Atualizar estado
        </button>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {fresh ? (
        <div className="rounded-card flex flex-col gap-2 border border-amber-300 bg-amber-50 p-3">
          <p className="text-xs font-medium text-amber-800">
            Copie este link agora. Por segurança, ele não poderá ser exibido novamente.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="rounded-card max-w-md truncate border border-amber-300 px-2 py-1 text-xs">
              {fresh.publicUrl}
            </code>
            <button
              type="button"
              onClick={handleCopy}
              className="glass-panel text-text-muted rounded-card hover:text-text px-3 py-1 text-sm font-semibold transition-colors"
            >
              {copied ? "Copiado!" : "Copiar link"}
            </button>
          </div>
          <QrCode dataUrl={fresh.qrCodeDataUrl} />
        </div>
      ) : (
        <p className="text-text-subtle text-xs">
          O link público só é exibido no momento da criação. Gerar um novo consome uma
          unidade da cota mensal.
        </p>
      )}
    </section>
  );
}
