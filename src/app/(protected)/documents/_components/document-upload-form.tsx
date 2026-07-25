"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import type { FolderNode } from "@/shared/domains/documents/folders";
import { createDocumentAction } from "@/shared/server/actions/documents/documents";

import {
  FormActions,
  FormError,
  SelectField,
  SubmitButton,
  TextField,
} from "../../_ui/form";
import { UPLOAD_TRANSPORT_ERROR_MESSAGE } from "./format";

type Option = { value: string; label: string };

export function DocumentUploadForm({
  folders,
  defaultFolderId,
}: {
  folders: FolderNode[];
  defaultFolderId: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [linkToPgr, setLinkToPgr] = useState(false);

  const folderOptions: Option[] = folders.map((f) => ({ value: f.id, label: f.name }));

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    if (!linkToPgr) {
      formData.delete("relatedEntityType");
      formData.delete("relatedEntityId");
    }
    startTransition(async () => {
      try {
        const result = await createDocumentAction(formData);
        if (result.ok) {
          setFormError(null);
          router.push(
            result.data.folderId
              ? `/documents?folderId=${result.data.folderId}`
              : "/documents",
          );
          router.refresh();
        } else {
          setFormError(result.error.message);
        }
      } catch {
        // Corpo maior do que o proxy/Server Action aceitam (transporte, não
        // validação) — a Server Action lança em vez de devolver {ok:false}.
        setFormError(UPLOAD_TRANSPORT_ERROR_MESSAGE);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex w-full flex-col gap-4">
      <FormError message={formError} />

      <label className="flex flex-col gap-1.5">
        <span className="text-text text-xs font-semibold sm:text-sm">Arquivo *</span>
        <input
          type="file"
          name="file"
          required
          accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx"
          className="glass-input text-text rounded-card file:rounded-card file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer px-3.5 py-2.5 text-sm outline-none file:mr-4 file:border-0 file:px-3 file:py-1 file:text-xs file:font-semibold"
        />
        <span className="text-text-subtle text-xs">
          PDF, PNG, JPG, DOC/DOCX ou XLS/XLSX — até 25 MB.
        </span>
      </label>

      <TextField label="Nome" name="name" required />
      <TextField label="Tipo do documento" name="docType" required />
      <TextField label="Validade (opcional)" name="validUntil" type="date" />

      <SelectField
        label="Pasta de destino"
        name="folderId"
        options={folderOptions}
        defaultValue={defaultFolderId ?? undefined}
        emptyLabel="— Início (raiz) —"
      />

      <label className="mt-1 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={linkToPgr}
          onChange={(e) => setLinkToPgr(e.target.checked)}
          className="text-primary focus:ring-primary h-4 w-4 rounded border-white/60"
        />
        <span className="text-text-muted text-xs font-semibold sm:text-sm">
          Vincular a um PGR
        </span>
      </label>
      {linkToPgr ? (
        <>
          <input type="hidden" name="relatedEntityType" value="pgr" />
          <TextField label="ID do PGR" name="relatedEntityId" required defaultValue="" />
        </>
      ) : null}

      <FormActions>
        <SubmitButton pending={pending} label="Enviar documento" />
      </FormActions>
    </form>
  );
}
