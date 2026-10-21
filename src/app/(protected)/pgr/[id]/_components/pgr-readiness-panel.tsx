"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { getPgrReadinessAction } from "@/shared/server/actions/pgr/pgr-readiness";
type Report = Extract<
  Awaited<ReturnType<typeof getPgrReadinessAction>>,
  { ok: true }
>["data"];
export function PgrReadinessPanel({ pgrId }: { pgrId: string }) {
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  function check() {
    setError(null);
    start(async () => {
      const result = await getPgrReadinessAction(pgrId);
      if (!result.ok) {
        setReport(null);
        setError(result.error.message);
      } else setReport(result.data);
    });
  }
  function generate(format: "docx" | "pdf") {
    if (!report) return;
    setError(null);
    start(async () => {
      try {
        const response = await fetch(`/api/v1/pgr/${pgrId}/docx`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            format,
            purpose: "issue",
            expectedSourceSha256: report.sourceSha256,
          }),
        });
        if (!response.ok) {
          const body = await response.json();
          setError(body.error?.message ?? "Não foi possível gerar o documento.");
          return;
        }
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        const suggested = response.headers
          .get("Content-Disposition")
          ?.match(/filename="([^"]+)"/)?.[1];
        link.download = suggested ?? `pgr.${format}`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
      } catch {
        setError("Falha de conexão ao gerar. Tente novamente.");
      }
    });
  }
  return (
    <div className="glass-panel flex flex-col gap-3 rounded-xl p-4">
      <h3 className="font-semibold">Conferência para geração</h3>
      <p className="text-sm">
        Os downloads diretos são prévias. A conferência identifica pendências de
        preenchimento e inconsistências; não substitui revisão técnica nem assinatura.
      </p>
      <button
        type="button"
        onClick={check}
        disabled={pending}
        className="btn-primary rounded-lg px-4 py-2 disabled:opacity-50"
      >
        {pending ? "Processando…" : "Conferir preenchimento"}
      </button>
      {error && <p role="alert">{error}</p>}
      {report && (
        <>
          <p role="status">
            {report.blockingCount} pendência(s) de preenchimento · {report.warningCount}{" "}
            aviso(s) para revisão.
          </p>
          <ul className="flex max-h-96 flex-col gap-2 overflow-auto">
            {report.issues.map((issue, index) => (
              <li
                key={`${issue.code}-${index}`}
                className="rounded-lg border p-3 text-sm"
              >
                <strong>{issue.context}</strong>: {issue.message}{" "}
                <Link className="underline" href={issue.href}>
                  Conferir cadastro
                </Link>
                <span className="ml-2">
                  {issue.severity === "blocking" ? "Impede geração conferida" : "Aviso"}
                </span>
              </li>
            ))}
          </ul>
          {report.ready && (
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                disabled={pending}
                onClick={() => generate("docx")}
                className="btn-primary rounded-lg px-4 py-2"
              >
                Gerar DOCX após conferência
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => generate("pdf")}
                className="btn-primary rounded-lg px-4 py-2"
              >
                Gerar PDF após conferência
              </button>
            </div>
          )}
          <p className="text-sm">{report.notice}</p>
        </>
      )}
    </div>
  );
}
