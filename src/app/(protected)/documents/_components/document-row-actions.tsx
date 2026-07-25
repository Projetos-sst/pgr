import type { DocumentListItem } from "@/shared/domains/documents/documents";

import { DeleteDocumentButton } from "./delete-document-button";
import { DownloadDocumentButton } from "./download-document-button";
import { EditDocumentModal } from "./edit-document-modal";
import { MoveDocumentModal } from "./move-document-modal";
import { NewVersionModal } from "./new-version-modal";

export function DocumentRowActions({ doc }: { doc: DocumentListItem }) {
  return (
    <div className="flex items-center justify-end gap-1">
      <DownloadDocumentButton documentId={doc.id} />
      <EditDocumentModal doc={doc} />
      <NewVersionModal documentId={doc.id} currentVersion={doc.version} />
      <MoveDocumentModal documentId={doc.id} currentFolderId={doc.folderId} />
      <DeleteDocumentButton documentId={doc.id} name={doc.name} />
    </div>
  );
}
