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
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <h2 className="text-text-subtle font-mono text-[11px] font-semibold tracking-wider uppercase">
          Pastas
        </h2>
        <NewFolderModal parentId={currentFolderId} />
      </div>

      {folders.length === 0 ? (
        <p className="text-text-subtle text-xs sm:text-sm">
          Nenhuma subpasta nesta localização.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {folders.map((folder) => (
            <div
              key={folder.id}
              className="glass-panel rounded-card flex items-center gap-2 px-3.5 py-2 text-xs font-medium transition-all hover:bg-white/60 sm:text-sm"
            >
              <Link
                href={`/documents?folderId=${folder.id}`}
                className="text-text hover:text-primary flex items-center gap-1.5 font-semibold transition-colors"
              >
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-primary"
                >
                  <path d="M3 7h6l2 2h10v11H3z" />
                </svg>
                {folder.name}
              </Link>
              <RenameFolderModal folderId={folder.id} currentName={folder.name} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
