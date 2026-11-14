"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { FormError, SubmitButton } from "../../../_ui/form";

type Outcome = { ok: true; summary: string } | { ok: false; message: string };

const STATUS_LABELS: Record<string, string> = {
  complete: "completo",
  incomplete: "incompleto (veja os itens ausentes ou divergentes no manifesto)",
};
const CONNECTION_FAILED = "Falha de conexão ao exportar. Tente novamente.";
const EXPORT_FAILED = "Não foi possível gerar o pacote.";
const REVOKE_AFTER_MS = 10000;

function save(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_AFTER_MS);
}

async function failureOf(response: Response): Promise<Outcome> {
  const body: { error?: { message?: string } } = await response.json().catch(() => ({}));
  return { ok: false, message: body.error?.message ?? EXPORT_FAILED };
}

async function requestExport(pgrId: string): Promise<Outcome> {
  const response = await fetch(`/api/v1/pgr/${pgrId}/retention-exports`, {
    method: "POST",
  }).catch(() => null);
  if (!response) return { ok: false, message: CONNECTION_FAILED };
  if (!response.ok) return failureOf(response);
  const fileName = response.headers
    .get("Content-Disposition")
    ?.match(/filename="([^"]+)"/)?.[1];
  save(await response.blob(), fileName ?? `pgr-${pgrId}-guarda.zip`);
  const status = response.headers.get("X-Retention-Export-Status") ?? "";
  const digest = response.headers.get("X-Retention-Export-Sha256") ?? "";
  return {
    ok: true,
    summary: `Pacote ${STATUS_LABELS[status] ?? status}. SHA-256 do conjunto: ${digest}`,
  };
}

export function PgrRetentionExportForm({ pgrId }: { pgrId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    start(async () => {
      const outcome = await requestExport(pgrId);
      setError(outcome.ok ? null : outcome.message);
      setDone(outcome.ok ? outcome.summary : null);
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <FormError message={error} />
      {done ? (
        <p role="status" className="text-sm break-all">
          {done}
        </p>
      ) : null}
      <SubmitButton pending={pending} label="Exportar pacote de guarda" />
    </form>
  );
}
