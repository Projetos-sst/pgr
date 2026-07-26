"use client";

export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  variant = "danger",
  pending = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "primary";
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  return (
    <div className="animate-backdrop-fade fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-md">
      <div className="glass-card animate-modal-pop flex w-full max-w-md flex-col gap-4 rounded-[20px] border border-white/50 bg-white/95 p-6 shadow-2xl">
        <div className="flex items-start gap-3.5">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
              variant === "danger"
                ? "bg-red-500/15 text-red-600"
                : variant === "warning"
                  ? "bg-amber-500/15 text-amber-700"
                  : "bg-primary/15 text-primary"
            }`}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              {variant === "danger" ? (
                <>
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </>
              ) : (
                <>
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </>
              )}
            </svg>
          </div>
          <div>
            <h3 className="text-text text-base font-extrabold sm:text-lg">{title}</h3>
            <p className="text-text-subtle mt-1 text-xs leading-relaxed sm:text-sm">
              {description}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-black/5 pt-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="glass-panel text-text-muted hover:text-text rounded-[12px] px-4 py-2 text-xs font-bold transition-all disabled:opacity-50 sm:text-sm"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className={`rounded-[12px] px-4 py-2 text-xs font-bold text-white transition-all disabled:opacity-50 sm:text-sm ${
              variant === "danger"
                ? "bg-red-600 shadow-md shadow-red-500/20 hover:bg-red-700"
                : "btn-primary shadow-primary"
            }`}
          >
            {pending ? "Processando…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
