import Link from "next/link";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { listFolderTreeAction } from "@/shared/server/actions/documents/folders";

import { PageHeader } from "../../_ui/list";
import { DocumentUploadForm } from "../_components/document-upload-form";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ folderId?: string }>;

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
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader
        title="Novo documento"
        description="Envie um arquivo para o acervo (laudo, contrato, ficha etc.)."
      />
      <DocumentUploadForm folders={folders} defaultFolderId={defaultFolderId} />
      <Link href="/documents" className="text-text-subtle text-sm hover:underline">
        ← Voltar
      </Link>
    </div>
  );
}
