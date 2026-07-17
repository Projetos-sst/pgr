"use client";

import { useState, useTransition } from "react";

import {
  createServiceOrderSignatureRequestAction,
  getServiceOrderSignatureViewAction,
} from "@/shared/server/actions/safety/service-order-signature";
import type {
  ServiceOrderSignatureState,
  ServiceOrderSignatureView,
} from "@/shared/domains/safety/service-order-signature";
import { isServiceOrderSigned } from "@/shared/domains/safety/service-order-signature";
import { QrCode } from "@/shared/ui/signature/QrCode";

const STATE_LABEL: Record<ServiceOrderSignatureState, string> = {
  none: "Sem solicitação",
  pending: "Aguardando assinatura",
  signed: "Documento assinado",
  expired: "Solicitação expirada",
  cancelled: "Solicitação cancelada",
};

const STATE_CLASS: Record<ServiceOrderSignatureState, string> = {
  none: "bg-black/5 text-text-muted",
  pending: "bg-amber-100 text-amber-800",
  signed: "bg-green-100 text-green-800",
  expired: "bg-red-50 text-red-700",
  cancelled: "bg-black/5 text-text-muted",
};

const brDateTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR") : null;

/**
 * Painel protegido de assinatura da OS (fase 06 / US3). O **estado** vem do servidor (derivado —
 * a OS não tem coluna de assinatura). O **link/QR só aparece na resposta recém-criada**: nunca é
 * persistido no navegador nem reexibido após reload (o token cru não é recuperável, nem pelo GET
 * protegido). Gerar outro link consome outra unidade da cota mensal compartilhada.
 */
export function ServiceOrderSignaturePanel({
  serviceOrderId,
  signature,
}: {
  serviceOrderId: string;
  signature?: ServiceOrderSignatureView;
}) {
  const [state, setState] = useState<ServiceOrderSignatureState>(
    signature?.state ?? "none",
  );
  const [signerName, setSignerName] = useState<string | null>(
    signature?.signerName ?? null,
  );
  const [signedAt, setSignedAt] = useState<string | null>(signature?.signedAt ?? null);
  const [expiresAt, setExpiresAt] = useState<string | null>(signature?.expiresAt ?? null);
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
      const res = await createServiceOrderSignatureRequestAction({ serviceOrderId });
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
      setSignedAt(null);
      setExpiresAt(res.data.signature.expiresAt);
    });
  }

  function handleRefresh() {
    startTransition(async () => {
      const res = await getServiceOrderSignatureViewAction({ serviceOrderId });
      if (res.ok) {
        setState(res.data.state);
        setSignerName(res.data.signerName);
        setSignedAt(res.data.signedAt);
        setExpiresAt(res.data.expiresAt);
      }
    });
  }

  async function handleCopy() {
    if (!fresh) return;
    await navigator.clipboard.writeText(fresh.publicUrl);
    setCopied(true);
  }

  const signed = isServiceOrderSigned(state);

  return (
    <section className="glass-card flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-text text-sm font-semibold">Assinatura da OS</h3>
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${STATE_CLASS[state]}`}
        >
          {STATE_LABEL[state]}
          {signed && signerName ? ` · ${signerName}` : ""}
        </span>
      </div>

      {signed ? (
        <p className="text-text-muted text-xs">
          Assinada{signedAt ? ` em ${brDateTime(signedAt)}` : ""}. A OS ficou imutável:
          não pode ser editada nem excluída.
        </p>
      ) : state === "pending" && expiresAt ? (
        <p className="text-text-muted text-xs">
          Link válido até {brDateTime(expiresAt)}.
        </p>
      ) : null}

      {!signed ? (
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
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {fresh ? (
        <div className="rounded-card flex flex-col gap-2 border border-amber-300 bg-amber-50 p-3">
          <p className="text-xs font-medium text-amber-800">
            Copie este link agora. Por segurança, ele não será exibido novamente.
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
      ) : !signed ? (
        <p className="text-text-subtle text-xs">
          O link público só é exibido no momento da criação. Gerar um novo consome uma
          unidade da cota mensal.
        </p>
      ) : null}
    </section>
  );
}
