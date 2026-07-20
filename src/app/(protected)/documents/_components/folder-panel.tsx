import Link from "next/link";

import type { FolderNode } from "@/shared/domains/documents/folders";

import { NewFolderModal } from "./new-folder-modal";
import { RenameFolderModal } from "./rename-folder-modal";

export function FolderPanel({
  folders,
  currentFolderId,
}: {
  folders: FolderNode[];
  currentFolderId: string | null;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-text-muted text-sm font-semibold tracking-wide uppercase">
          Pastas
        </h2>
        <NewFolderModal parentId={currentFolderId} />
      </div>

      {folders.length === 0 ? (
        <p className="text-text-subtle text-sm">Nenhuma subpasta aqui.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {folders.map((folder) => (
            <div
              key={folder.id}
              className="glass-panel rounded-card flex items-center gap-2 px-3 py-2 text-sm"
            >
              <Link
                href={`/documents?folderId=${folder.id}`}
                className="text-text font-medium hover:underline"
              >
                📁 {folder.name}
              </Link>
              <RenameFolderModal folderId={folder.id} currentName={folder.name} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
