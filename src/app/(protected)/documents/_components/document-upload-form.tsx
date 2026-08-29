"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import type { FolderNode } from "@/shared/domains/documents/folders";
import { SUGGESTED_DOC_TYPES } from "@/shared/domains/documents/documents";
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

const LINK_CHECKBOX_LABEL: Record<string, string> = {
  pgr: "Vincular a um PGR",
  ges: "Vincular a este GES",
  risk: "Vincular a este risco",
};

export function DocumentUploadForm({
  folders,
  defaultFolderId,
  defaultRelatedEntityType = null,
  defaultRelatedEntityId = null,
  returnTo = null,
  returnLabel = null,
}: {
  folders: FolderNode[];
  defaultFolderId: string | null;
  defaultRelatedEntityType?: string | null;
  defaultRelatedEntityId?: string | null;
  returnTo?: string | null;
  returnLabel?: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  // Pré-vinculado cobre qualquer entidade do enum (pgr/ges/risk) que chegue via
  // query string (ex.: "Anexar Documento" do GES/Risco); o fluxo manual — checkbox +
  // ID digitado — continua exclusivo de PGR (ver comentário no botão abaixo).
  const isPreLinked = !!defaultRelatedEntityType && !!defaultRelatedEntityId;
  const [linkToEntity, setLinkToEntity] = useState(isPreLinked);

  const folderOptions: Option[] = folders.map((f) => ({ value: f.id, label: f.name }));

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    if (!linkToEntity) {
      formData.delete("relatedEntityType");
      formData.delete("relatedEntityId");
    }
    startTransition(async () => {
      try {
        const result = await createDocumentAction(formData);
        if (result.ok) {
          setFormError(null);
          // Quando o upload nasceu de outra tela (ex.: etapa de Documentos do PGR),
          // devolve o usuário ao ponto de origem em vez de largá-lo no acervo.
          router.push(
            returnTo ??
              (result.data.folderId
                ? `/documents?folderId=${result.data.folderId}`
                : "/documents"),
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
      <TextField
        label="Tipo do documento"
        name="docType"
        required
        suggestions={SUGGESTED_DOC_TYPES}
      />
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
          checked={linkToEntity}
          onChange={(e) => setLinkToEntity(e.target.checked)}
          className="text-primary focus:ring-primary h-4 w-4 rounded border-white/60"
        />
        <span className="text-text-muted text-xs font-semibold sm:text-sm">
          {isPreLinked
            ? (LINK_CHECKBOX_LABEL[defaultRelatedEntityType ?? "pgr"] ??
              LINK_CHECKBOX_LABEL.pgr)
            : LINK_CHECKBOX_LABEL.pgr}
        </span>
      </label>
      {linkToEntity ? (
        <>
          <input
            type="hidden"
            name="relatedEntityType"
            value={isPreLinked ? (defaultRelatedEntityType ?? "pgr") : "pgr"}
          />
          {isPreLinked ? (
            <>
              <input
                type="hidden"
                name="relatedEntityId"
                value={defaultRelatedEntityId ?? ""}
              />
              <p className="glass-panel text-text-muted rounded-card px-3.5 py-2.5 text-xs sm:text-sm">
                Vinculado a <strong>{returnLabel ?? "este PGR"}</strong>.
              </p>
            </>
          ) : (
            <TextField
              label="ID do PGR"
              name="relatedEntityId"
              required
              defaultValue=""
            />
          )}
        </>
      ) : null}

      <FormActions>
        <SubmitButton pending={pending} label="Enviar documento" />
      </FormActions>
    </form>
  );
}
