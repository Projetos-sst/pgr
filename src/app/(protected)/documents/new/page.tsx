import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { listFolderTreeAction } from "@/shared/server/actions/documents/folders";

import { PageHeader } from "../../_ui/list";
import { DocumentUploadForm } from "../_components/document-upload-form";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  folderId?: string;
  docType?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  returnTo?: string;
  returnLabel?: string;
}>;

/** Só aceita retorno interno — `returnTo` vem da URL e não pode virar open redirect. */
function safeReturnTo(value: string | undefined): string | null {
  if (!value) return null;
  return value.startsWith("/") && !value.startsWith("//") ? value : null;
}

export default async function NewDocumentPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireOfficeStaffPage();
  const sp = await searchParams;
  const defaultFolderId = sp.folderId && sp.folderId !== "" ? sp.folderId : null;

  const foldersResult = await listFolderTreeAction(null);
  const folders = foldersResult.ok ? foldersResult.data.folders : [];

  return (
    <div className="mx-auto flex w-full max-w-[940px] flex-col gap-[22px] px-[30px] pt-7 pb-10">
      <PageHeader
        backHref="/documents"
        title="Novo Documento — GED"
        description="Envie um arquivo para o acervo (laudo, contrato, ficha etc.)."
        icon={
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
        }
      />
      <div className="glass-card rounded-[20px] p-6 sm:p-8">
        <DocumentUploadForm
          folders={folders}
          defaultFolderId={defaultFolderId}
          defaultDocType={sp.docType ?? null}
          defaultRelatedEntityType={sp.relatedEntityType ?? null}
          defaultRelatedEntityId={sp.relatedEntityId ?? null}
          returnTo={safeReturnTo(sp.returnTo)}
          returnLabel={sp.returnLabel ?? null}
        />
      </div>
    </div>
  );
}
