import Link from "next/link";

import type { BreadcrumbItem } from "@/shared/domains/documents/folders";

export function BreadcrumbNav({ breadcrumb }: { breadcrumb: BreadcrumbItem[] }) {
  return (
    <nav
      aria-label="Navegação de pastas"
      className="text-text-subtle flex flex-wrap items-center gap-1.5 text-xs sm:text-sm"
    >
      {breadcrumb.map((item, index) => {
        const isLast = index === breadcrumb.length - 1;
        const href = item.id ? `/documents?folderId=${item.id}` : "/documents";
        return (
          <span key={item.id ?? "root"} className="flex items-center gap-1.5">
            {index > 0 ? (
              <span className="text-text-subtle/60 font-semibold">/</span>
            ) : null}
            {isLast ? (
              <span className="text-text rounded-card bg-white/40 px-2 py-0.5 font-bold">
                {item.name}
              </span>
            ) : (
              <Link
                href={href}
                className="text-text-muted hover:text-primary font-medium transition-colors"
              >
                {item.name}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
