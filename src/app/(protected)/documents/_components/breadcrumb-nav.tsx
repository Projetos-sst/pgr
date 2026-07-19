import Link from "next/link";

import type { BreadcrumbItem } from "@/shared/domains/documents/folders";

export function BreadcrumbNav({ breadcrumb }: { breadcrumb: BreadcrumbItem[] }) {
  return (
    <nav className="text-text-muted flex flex-wrap items-center gap-1 text-sm">
      {breadcrumb.map((item, index) => {
        const isLast = index === breadcrumb.length - 1;
        const href = item.id ? `/documents?folderId=${item.id}` : "/documents";
        return (
          <span key={item.id ?? "root"} className="flex items-center gap-1">
            {index > 0 ? <span className="text-text-subtle">/</span> : null}
            {isLast ? (
              <span className="text-text font-semibold">{item.name}</span>
            ) : (
              <Link href={href} className="hover:text-text hover:underline">
                {item.name}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
