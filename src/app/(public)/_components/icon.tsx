import type { IconName } from "../_content/platform";

/**
 * Ícones do portal público. Mesmo traço do menu autenticado (`nav-menu.tsx`):
 * `viewBox 0 0 24 24`, só contorno, `stroke="currentColor"`, sem preenchimento —
 * para herdar a cor do contexto e manter a identidade entre as duas áreas.
 *
 * Conjunto próprio e inline de propósito: nenhuma biblioteca de ícones nova
 * (o projeto não tem uma) e nenhum emoji no lugar de ícone.
 */
export function Icon({
  name,
  className = "h-5 w-5",
  strokeWidth = 1.7,
}: {
  name: IconName;
  className?: string;
  strokeWidth?: number;
}) {
  const props = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    "aria-hidden": true,
    focusable: false,
  };

  switch (name) {
    case "shield":
      return (
        <svg {...props}>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      );
    case "stethoscope":
      return (
        <svg {...props}>
          <path d="M4 3v6a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3" />
          <path d="M10 15v2a4 4 0 0 0 8 0v-1" />
          <circle cx="19" cy="14" r="2" />
        </svg>
      );
    case "alert-triangle":
      return (
        <svg {...props}>
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <path d="M12 9v4M12 17h.01" />
        </svg>
      );
    case "clipboard-check":
      return (
        <svg {...props}>
          <path d="M9 3h6v3H9z" />
          <path d="M15 4h2a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
          <path d="M9 14l2 2 4-4" />
        </svg>
      );
    case "layers":
      return (
        <svg {...props}>
          <path d="M12 2L2 7l10 5 10-5z" />
          <path d="M2 12l10 5 10-5" />
          <path d="M2 17l10 5 10-5" />
        </svg>
      );
    case "hardhat":
      return (
        <svg {...props}>
          <path d="M2 17h20" />
          <path d="M4 17v-2a8 8 0 0 1 16 0v2" />
          <path d="M10 9V5a2 2 0 0 1 4 0v4" />
        </svg>
      );
    case "building":
      return (
        <svg {...props}>
          <path d="M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16" />
          <path d="M16 10h2a2 2 0 0 1 2 2v9" />
          <path d="M8 7h4M8 11h4M8 15h4M2 21h20" />
        </svg>
      );
    case "users":
      return (
        <svg {...props}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13A4 4 0 0 1 16 11" />
        </svg>
      );
    case "book-open":
      return (
        <svg {...props}>
          <path d="M2 4h6a3 3 0 0 1 3 3v13a2.5 2.5 0 0 0-2.5-2.5H2z" />
          <path d="M22 4h-6a3 3 0 0 0-3 3v13a2.5 2.5 0 0 1 2.5-2.5H22z" />
        </svg>
      );
    case "file-text":
      return (
        <svg {...props}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6M8 13h8M8 17h5" />
        </svg>
      );
    case "calendar":
      return (
        <svg {...props}>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M8 3v4M16 3v4M3 11h18" />
        </svg>
      );
    case "activity":
      return (
        <svg {...props}>
          <path d="M3 12h4l3 7 4-14 3 7h4" />
        </svg>
      );
    case "heart-pulse":
      return (
        <svg {...props}>
          <path d="M19.5 5.5a5 5 0 0 0-7.5.5 5 5 0 0 0-7.5-.5 5.3 5.3 0 0 0 0 7.4L12 21l7.5-8.1a5.3 5.3 0 0 0 0-7.4z" />
          <path d="M7 12h2l1.5-2.5L13 15l1.5-3H17" />
        </svg>
      );
    case "folder":
      return (
        <svg {...props}>
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        </svg>
      );
    case "pen-tool":
      return (
        <svg {...props}>
          <path d="M12 19l7-7 3 3-7 7-3-3z" />
          <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18z" />
          <path d="M2 2l7.586 7.586" />
          <circle cx="11" cy="11" r="2" />
        </svg>
      );
    case "brain":
      return (
        <svg {...props}>
          <path d="M9.5 3A3.5 3.5 0 0 0 6 6.5 3 3 0 0 0 4 9.5a3 3 0 0 0 1 2.2A3 3 0 0 0 4 14a3 3 0 0 0 2.5 3A3.5 3.5 0 0 0 10 20.5V3.5A.5.5 0 0 0 9.5 3z" />
          <path d="M14.5 3A3.5 3.5 0 0 1 18 6.5a3 3 0 0 1 2 3 3 3 0 0 1-1 2.2A3 3 0 0 1 20 14a3 3 0 0 1-2.5 3A3.5 3.5 0 0 1 14 20.5V3.5a.5.5 0 0 1 .5-.5z" />
        </svg>
      );
    case "car":
      return (
        <svg {...props}>
          <path d="M5 17h14M4 17v-4l2-5h12l2 5v4" />
          <circle cx="7.5" cy="17.5" r="1.5" />
          <circle cx="16.5" cy="17.5" r="1.5" />
        </svg>
      );
    case "wrench":
      return (
        <svg {...props}>
          <path d="M14.7 6.3a4 4 0 1 0 5 5L21 21l-2 2-9.7-9.7a4 4 0 0 1-5-5L6 5l3 3 2-2-3-3z" />
        </svg>
      );
    case "lock":
      return (
        <svg {...props}>
          <rect x="4" y="11" width="16" height="10" rx="2" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </svg>
      );
    case "search":
      return (
        <svg {...props}>
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" />
        </svg>
      );
    case "route":
      return (
        <svg {...props}>
          <circle cx="6" cy="19" r="2" />
          <circle cx="18" cy="5" r="2" />
          <path d="M8 19h6a4 4 0 0 0 0-8H8a4 4 0 0 1 0-8h4" />
        </svg>
      );
    case "check":
      return (
        <svg {...props}>
          <path d="M20 6L9 17l-5-5" />
        </svg>
      );
  }
}
