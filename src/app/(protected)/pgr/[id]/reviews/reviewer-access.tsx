"use client";
import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  addRestrictedReviewerAction,
  downloadReviewSampleAction,
  revokeRestrictedReviewerAction,
} from "@/shared/server/actions/pgr/document-approval";
import { switchTenantAction } from "@/shared/server/actions/switch-tenant";
import { FormError, TextField, SubmitButton } from "../../../_ui/form";
export function RestrictedReviewerForm({
  pgrId,
  reviewerId,
}: {
  pgrId: string;
  reviewerId?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email") ?? "");
    start(async () => {
      const result = await addRestrictedReviewerAction(pgrId, { email });
      if (!result.ok) setError(result.error.message);
      else {
        setError(null);
        setLink(window.location.origin + result.data.reviewPath);
        router.refresh();
      }
    });
  }
  return (
    <form onSubmit={submit} className="glass-card grid gap-3 rounded-xl p-5">
      <h2 className="font-semibold">Adicionar revisor com acesso restrito</h2>
      <p>
        Disponível no Gratuito e no Pro. O profissional precisa de conta própria e e-mail
        verificado. Depois de adicioná-lo, selecione-o como revisor do PGR. Isso não
        concede acesso operacional à equipe nem altera o plano. Nenhum convite é enviado
        automaticamente.
      </p>
      <FormError message={error} />
      <TextField
        name="email"
        type="email"
        label="E-mail verificado do profissional"
        required
      />
      <SubmitButton pending={pending} label="Adicionar acesso restrito" />
      {reviewerId ? (
        <button
          type="button"
          className="text-red-700 underline"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const result = await revokeRestrictedReviewerAction(pgrId, {
                userId: reviewerId,
              });
              if (!result.ok) setError(result.error.message);
              else {
                setError(null);
                router.refresh();
              }
            })
          }
        >
          Revogar o acesso restrito do revisor a esta empresa
        </button>
      ) : null}
      {link ? (
        <p>
          Compartilhe este endereço com o profissional após designá-lo:{" "}
          <a className="break-all underline" href={link}>
            {link}
          </a>
        </p>
      ) : null}
    </form>
  );
}
export function ReviewSampleDownloadButton({
  pgrId,
  sampleId,
}: {
  pgrId: string;
  sampleId: string;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <button
        type="button"
        disabled={pending}
        className="text-primary underline"
        onClick={() =>
          start(async () => {
            const result = await downloadReviewSampleAction(pgrId, sampleId);
            if (!result.ok) setError(result.error.message);
            else {
              setError(null);
              window.open(result.data.url, "_blank", "noopener,noreferrer");
            }
          })
        }
      >
        {pending ? "Preparando amostra…" : "Baixar amostra para revisão"}
      </button>
      {error ? <p role="alert">{error}</p> : null}
    </div>
  );
}
export function ReviewTenantSwitch({ orgId }: { orgId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <section className="p-6">
      <p>Abra o escritório que concedeu o acesso para revisar este documento.</p>
      <button
        className="text-primary underline"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const result = await switchTenantAction(orgId);
            if (!result.ok) setError(result.error.message);
            else router.refresh();
          })
        }
      >
        Abrir escritório do documento
      </button>
      {error ? <p role="alert">{error}</p> : null}
    </section>
  );
}
