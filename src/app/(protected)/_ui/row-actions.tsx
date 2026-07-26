import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Ações de linha das tabelas de listagem. Padrão do projeto: **somente ícone**,
 * em chip quadrado — o rótulo vive em `aria-label` (leitores de tela) e `title`
 * (tooltip no hover), nunca como texto visível, para manter a coluna compacta.
 */
const rowActionBaseClass =
  "glass-panel rounded-card text-text-muted flex h-8 w-8 items-center justify-center transition-all duration-200 hover:-translate-y-0.5 hover:scale-110 hover:bg-white/80 hover:shadow-md active:scale-95";

export const rowActionClass = `${rowActionBaseClass} hover:text-primary`;

export const rowActionDangerClass = `${rowActionBaseClass} hover:text-danger hover:bg-red-50/80`;

export function RowActions({ children }: { children: ReactNode }) {
  return <div className="flex items-center justify-end gap-1.5">{children}</div>;
}

function RowActionLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} aria-label={label} title={label} className={rowActionClass}>
      {children}
    </Link>
  );
}

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

export function TrashIcon() {
  return (
    <Icon>
      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
    </Icon>
  );
}

export function ViewRowAction({
  href,
  label = "Ver detalhes",
}: {
  href: string;
  label?: string;
}) {
  return (
    <RowActionLink href={href} label={label}>
      <Icon>
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
        <circle cx="12" cy="12" r="3" />
      </Icon>
    </RowActionLink>
  );
}

export function EditRowAction({
  href,
  label = "Editar",
}: {
  href: string;
  label?: string;
}) {
  return (
    <RowActionLink href={href} label={label}>
      <Icon>
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
      </Icon>
    </RowActionLink>
  );
}

export function ChecklistRowAction({
  href,
  label = "Checklist",
}: {
  href: string;
  label?: string;
}) {
  return (
    <RowActionLink href={href} label={label}>
      <Icon>
        <path d="M9 11l2 2 4-4" />
        <rect x="3" y="4" width="18" height="17" rx="2" />
        <path d="M8 2v4M16 2v4" />
      </Icon>
    </RowActionLink>
  );
}
