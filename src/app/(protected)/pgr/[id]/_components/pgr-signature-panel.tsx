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
  none: "bg-black/5 text-zinc-600 dark:bg-white/10 dark:text-zinc-300",
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  signed: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200",
  expired: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400",
  cancelled: "bg-black/5 text-zinc-600 dark:bg-white/10 dark:text-zinc-300",
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
    <section className="flex flex-col gap-3 rounded-lg border border-black/10 p-4 dark:border-white/10">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Assinatura do PGR</h3>
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
          className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-black/85 disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {pending ? "…" : "Gerar link de assinatura"}
        </button>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={pending}
          className="rounded-md border border-black/15 px-3 py-2 text-sm transition-colors hover:bg-black/5 disabled:opacity-50 dark:border-white/15"
        >
          Atualizar estado
        </button>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {fresh ? (
        <div className="flex flex-col gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/30">
          <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
            Copie este link agora. Por segurança, ele não poderá ser exibido novamente.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="max-w-md truncate rounded-md border border-black/10 px-2 py-1 text-xs dark:border-white/10">
              {fresh.publicUrl}
            </code>
            <button
              type="button"
              onClick={handleCopy}
              className="rounded-md border border-black/15 px-3 py-1 text-sm transition-colors hover:bg-black/5 dark:border-white/15"
            >
              {copied ? "Copiado!" : "Copiar link"}
            </button>
          </div>
          <QrCode dataUrl={fresh.qrCodeDataUrl} />
        </div>
      ) : (
        <p className="text-xs text-zinc-500">
          O link público só é exibido no momento da criação. Gerar um novo consome uma
          unidade da cota mensal.
        </p>
      )}
    </section>
  );
}
