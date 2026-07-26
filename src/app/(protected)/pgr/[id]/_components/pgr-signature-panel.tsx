"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

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
  pending: "bg-amber-500/15 text-amber-700",
  signed: "bg-emerald-500/15 text-emerald-700",
  expired: "bg-red-500/15 text-red-700",
  cancelled: "bg-black/5 text-text-muted",
};

/**
 * Painel protegido de assinatura do PGR estilizado com o redesign.
 */
export function PgrSignaturePanel({
  pgrId,
  signature,
  onSignatureChange,
  isPublished = false,
  onPublish,
  publishPending = false,
}: {
  pgrId: string;
  signature?: PgrSignatureView;
  onSignatureChange?: (view: PgrSignatureView) => void;
  isPublished?: boolean;
  onPublish?: () => void;
  publishPending?: boolean;
}) {
  const router = useRouter();
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

  const [prevSignature, setPrevSignature] = useState(signature);
  if (signature !== prevSignature) {
    setPrevSignature(signature);
    if (signature) {
      setState(signature.state);
      setSignerName(signature.signerName);
    }
  }

  // Polling automático enquanto estiver aguardando assinatura (3 em 3 segundos)
  useEffect(() => {
    if (state !== "pending") return;

    const interval = setInterval(async () => {
      const res = await getPgrSignatureViewAction({ pgrId });
      if (res.ok) {
        setState(res.data.state);
        setSignerName(res.data.signerName);
        onSignatureChange?.(res.data);
        if (res.data.state === "signed") {
          setFresh(null);
          router.refresh();
        }
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [pgrId, state, onSignatureChange, router]);

  // Garante que a URL seja completa com protocolo e domínio do navegador
  const fullPublicUrl = fresh?.publicUrl
    ? typeof window !== "undefined" && fresh.publicUrl.startsWith("/")
      ? `${window.location.origin}${fresh.publicUrl}`
      : fresh.publicUrl
    : "";

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
      onSignatureChange?.({
        state: "pending",
        requestId: res.data.requestId,
        signerName: null,
        signedAt: null,
        expiresAt: null,
      });
    });
  }

  function handleRefresh() {
    startTransition(async () => {
      const res = await getPgrSignatureViewAction({ pgrId });
      if (res.ok) {
        setState(res.data.state);
        setSignerName(res.data.signerName);
        onSignatureChange?.(res.data);
        if (res.data.state === "signed") {
          setFresh(null);
          router.refresh();
        }
      }
    });
  }

  async function handleCopy() {
    if (!fullPublicUrl) return;
    await navigator.clipboard.writeText(fullPublicUrl);
    setCopied(true);
  }

  const isSigned = state === "signed";

  return (
    <section className="glass-card flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-text text-base font-bold sm:text-lg">
            Assinatura e Validação Digital
          </h2>
          <p className="text-text-subtle mt-0.5 text-xs">
            Solicite ou acompanhe a assinatura digital do responsável técnico pelo
            documento
          </p>
        </div>
        <span
          className={`inline-flex items-center rounded-full px-3.5 py-1 text-xs font-bold ${STATE_CLASS[state]}`}
        >
          {isSigned
            ? isPublished
              ? `Assinado e Publicado · ${signerName ?? ""}`
              : `Assinado (Aguardando publicação) · ${signerName ?? ""}`
            : STATE_LABEL[state]}
        </span>
      </div>

      <div className="flex flex-wrap gap-3">
        {!isSigned ? (
          <button
            type="button"
            onClick={handleGenerate}
            disabled={pending}
            className="btn-primary rounded-card shadow-primary flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white transition-all disabled:opacity-50 sm:text-sm"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
            {pending ? "Gerando..." : "Gerar link de assinatura"}
          </button>
        ) : null}

        <button
          type="button"
          onClick={handleRefresh}
          disabled={pending}
          className="glass-panel text-text-muted hover:text-text rounded-card flex items-center gap-2 px-4 py-2.5 text-xs font-bold transition-all disabled:opacity-50 sm:text-sm"
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M21.5 2v6h-6" />
            <path d="M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
          </svg>
          {pending ? "Verificando..." : "Atualizar estado"}
        </button>
      </div>

      {/* Aviso de bloqueio de edição após assinatura */}
      {!isSigned ? (
        <div className="flex items-start gap-2.5 rounded-[12px] border border-amber-300/50 bg-amber-500/8 px-4 py-3">
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="mt-0.5 shrink-0 text-amber-600"
          >
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <p className="text-xs leading-relaxed font-medium text-amber-800">
            <strong className="font-bold">Atenção:</strong> após a assinatura digital ser
            concluída, o documento PGR ficará bloqueado para edição. Certifique-se de que
            todas as informações estão corretas antes de solicitar a assinatura.
          </p>
        </div>
      ) : null}

      {error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}

      {/* Se o documento já estiver assinado */}
      {isSigned ? (
        <div className="glass-panel flex flex-col gap-4 rounded-[16px] border border-emerald-400/40 bg-emerald-500/10 p-5 text-xs text-emerald-950">
          <div className="flex items-start gap-3.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold text-emerald-900">
                Documento Assinado Digitalmente
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-emerald-800">
                Assinado por <strong>{signerName ?? "Responsável Técnico"}</strong>. A
                assinatura digital foi validada com sucesso.
                {isPublished
                  ? " O documento foi oficialmente publicado."
                  : " Clique no botão abaixo para publicar o documento."}
              </p>
            </div>
          </div>

          {!isPublished && onPublish ? (
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={onPublish}
                disabled={publishPending}
                className="btn-primary rounded-card shadow-primary flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white transition-all disabled:opacity-60 sm:text-sm"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                {publishPending ? "Publicando…" : "Publicar Documento PGR"}
              </button>
            </div>
          ) : null}
        </div>
      ) : fresh ? (
        /* Se houver solicitação pendente recém-criada */
        <div className="glass-panel flex flex-col gap-3 rounded-[16px] border border-amber-300/50 bg-amber-500/10 p-4">
          <p className="text-xs font-bold text-amber-800">
            Copie este link agora. Por segurança, o token cru não será reexibido após
            atualizar a página.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <code className="rounded-card text-text max-w-lg truncate border border-amber-300/50 bg-white/50 px-3 py-1.5 font-mono text-xs">
              {fullPublicUrl}
            </code>
            <button
              type="button"
              onClick={handleCopy}
              className="glass-panel text-text-muted hover:text-text rounded-card px-3.5 py-1.5 text-xs font-bold transition-colors"
            >
              {copied ? "Copiado!" : "Copiar link"}
            </button>
          </div>
          <div className="mt-1">
            <QrCode dataUrl={fresh.qrCodeDataUrl} />
          </div>
        </div>
      ) : (
        <p className="text-text-subtle text-xs">
          O link público e QR Code só são exibidos no momento da emissão. Cada novo link
          gerado consome uma unidade da cota mensal.
        </p>
      )}
    </section>
  );
}
