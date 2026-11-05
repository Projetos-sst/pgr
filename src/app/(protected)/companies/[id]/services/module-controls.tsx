"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition } from "react";

import { changeCompanyModuleAction } from "@/shared/server/actions/platform/company-modules";
import type {
  CompanyModule,
  CompanyModuleView,
} from "@/shared/domains/platform/company-modules";

import { FormError } from "../../../_ui/form";
import { ServiceStatusBadge } from "../../_components/service-status";

/**
 * Gerenciar serviços (NOB-171): um cartão por serviço com estado em destaque (texto + ícone), o
 * que o estado permite e a ação possível. Só o administrador altera, e só depois de confirmar com
 * motivo; o estado exibido vem sempre do servidor (refetch após a resposta, sem otimismo).
 */
const COPY: Record<
  CompanyModule,
  {
    name: string;
    subtitle: string;
    on: string;
    off: string;
    enableEffect: string;
    disableEffect: string;
  }
> = {
  pgr: {
    name: "PGR / Segurança do Trabalho",
    subtitle: "Programa de Gerenciamento de Riscos (NR-01)",
    on: "O serviço PGR está disponível para esta empresa.",
    off: "O serviço PGR não está disponível. Esta empresa não aparecerá na seleção de Novo PGR.",
    enableEffect:
      "A empresa passa a aparecer em Novo PGR e os recursos de PGR ficam disponíveis para ela.",
    disableEffect:
      "A empresa deixa de aparecer em Novo PGR e os PGRs dela ficam inacessíveis até o serviço ser habilitado de novo. Nenhum registro é apagado.",
  },
  medicine: {
    name: "Medicina do Trabalho",
    subtitle: "PCMSO, ASO e exames ocupacionais",
    on: "O serviço Medicina do Trabalho está disponível para esta empresa, conforme as permissões de acesso.",
    off: "O serviço Medicina do Trabalho não está disponível para esta empresa.",
    enableEffect:
      "As funções de Medicina ficam disponíveis para a empresa. A verificação de identidade profissional e as permissões por perfil continuam valendo.",
    disableEffect:
      "As funções de Medicina ficam bloqueadas para a empresa até o serviço ser habilitado de novo. Nenhum registro é apagado.",
  },
};

const REASON_MAX = 500;

function ServiceIcon({ module }: { module: CompanyModule }) {
  return (
    <span
      className="bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
      aria-hidden="true"
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        {module === "pgr" ? (
          <path d="M12 3l8 3v6c0 4.5-3.4 8.4-8 9-4.6-.6-8-4.5-8-9V6l8-3z" />
        ) : (
          <path d="M3 12h4l2-5 4 10 2-5h6" />
        )}
      </svg>
    </span>
  );
}

export function ModuleControls({
  companyId,
  companyName,
  modules,
  canManage,
}: {
  companyId: string;
  companyName: string;
  modules: CompanyModuleView[];
  canManage: boolean;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {modules.map((entry) => (
        <ServiceCard
          key={entry.module}
          companyId={companyId}
          companyName={companyName}
          entry={entry}
          canManage={canManage}
        />
      ))}
    </div>
  );
}

function ServiceCard({
  companyId,
  companyName,
  entry,
  canManage,
}: {
  companyId: string;
  companyName: string;
  entry: CompanyModuleView;
  canManage: boolean;
}) {
  const copy = COPY[entry.module];
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  return (
    <section
      aria-labelledby={titleId}
      className="glass-card flex min-w-0 flex-col gap-4 rounded-[20px] p-6"
    >
      <header className="flex items-start gap-3">
        <ServiceIcon module={entry.module} />
        <div className="min-w-0">
          <h2 id={titleId} className="text-text text-base font-semibold">
            {copy.name}
          </h2>
          <p className="text-text-muted text-xs">{copy.subtitle}</p>
        </div>
      </header>
      <ServiceStatusBadge enabled={entry.enabled} />
      <p className="text-text-muted text-sm">{entry.enabled ? copy.on : copy.off}</p>
      <p
        role="status"
        aria-live="polite"
        className="text-sm text-emerald-800 empty:hidden"
      >
        {notice}
      </p>
      {canManage ? (
        <button
          ref={triggerRef}
          type="button"
          onClick={() => {
            setNotice(null);
            setOpen(true);
          }}
          className={
            entry.enabled
              ? "rounded-pill w-fit border border-red-300 px-5 py-2 text-sm font-semibold text-red-700 transition-colors hover:bg-red-50 focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:outline-none dark:text-red-300 dark:hover:bg-red-950/40"
              : "btn-primary rounded-pill w-fit px-5 py-2 text-sm font-semibold focus-visible:ring-2 focus-visible:outline-none"
          }
        >
          {entry.enabled ? "Desabilitar serviço" : "Habilitar serviço"}
        </button>
      ) : (
        <p className="text-text-muted rounded-xl border border-dashed px-3 py-2 text-sm">
          Somente o administrador do escritório altera os serviços. Solicite a alteração
          ao administrador.
        </p>
      )}
      {open ? (
        <ConfirmServiceChange
          companyId={companyId}
          companyName={companyName}
          entry={entry}
          onClose={(result) => {
            setOpen(false);
            if (result) setNotice(result);
            triggerRef.current?.focus();
          }}
        />
      ) : null}
    </section>
  );
}

/** Diálogo modal acessível: empresa, serviço, estado atual → novo, consequência e motivo. */
function ConfirmServiceChange({
  companyId,
  companyName,
  entry,
  onClose,
}: {
  companyId: string;
  companyName: string;
  entry: CompanyModuleView;
  onClose: (successMessage: string | null) => void;
}) {
  const copy = COPY[entry.module];
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const submitting = useRef(false);
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  const titleId = useId();
  const descId = useId();
  const next = !entry.enabled;

  useEffect(() => {
    reasonRef.current?.focus();
  }, []);

  function cancel() {
    if (!submitting.current) onClose(null);
  }

  function confirm() {
    if (submitting.current) return;
    if (!reason.trim()) {
      setError("Informe o motivo da alteração.");
      reasonRef.current?.focus();
      return;
    }
    submitting.current = true;
    setError(null);
    startTransition(async () => {
      try {
        const result = await changeCompanyModuleAction(companyId, {
          module: entry.module,
          enabled: next,
          reason,
        });
        if (!result.ok) {
          setError(result.error.fields?.reason ?? result.error.message);
          return;
        }
        router.refresh();
        onClose(
          `${copy.name}: serviço ${next ? "habilitado" : "desabilitado"}. O estado acima foi atualizado.`,
        );
      } catch {
        setError("Não foi possível alterar o serviço. Nada foi salvo; tente novamente.");
      } finally {
        submitting.current = false;
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onKeyDown={(event) => {
        if (event.key === "Escape") cancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="glass-card max-h-[90vh] w-full max-w-lg overflow-y-auto bg-white/95 p-6 dark:bg-neutral-900/95"
      >
        <h2 id={titleId} className="text-text text-lg font-semibold">
          {next ? "Habilitar" : "Desabilitar"} {copy.name}?
        </h2>
        <div id={descId} className="text-text-muted mt-3 flex flex-col gap-2 text-sm">
          <p>
            Empresa: <strong className="text-text">{companyName}</strong>
          </p>
          <p className="flex flex-wrap items-center gap-2">
            <span>Estado atual:</span>
            <ServiceStatusBadge enabled={entry.enabled} />
            <span aria-hidden="true">→</span>
            <span>Novo estado:</span>
            <ServiceStatusBadge enabled={next} />
          </p>
          <p>{next ? copy.enableEffect : copy.disableEffect}</p>
        </div>
        <label className="mt-4 block">
          <span className="text-text text-sm font-semibold">
            Motivo da alteração <span className="text-danger">*</span>
          </span>
          <textarea
            ref={reasonRef}
            name="reason"
            rows={3}
            required
            maxLength={REASON_MAX}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            disabled={pending}
            aria-invalid={error ? true : undefined}
            className="glass-input text-text rounded-field mt-1 w-full resize-y px-3.5 py-3 text-[13px] outline-none"
          />
          <span className="text-text-subtle text-xs">
            {reason.length}/{REASON_MAX} caracteres. Fica registrado no histórico.
          </span>
        </label>
        <div className="mt-3">
          <FormError message={error} />
        </div>
        <div className="mt-5 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={cancel}
            disabled={pending}
            className="glass-panel text-text-muted rounded-card hover:text-text px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={pending}
            className={
              next
                ? "btn-primary rounded-pill px-5 py-2 text-sm font-semibold disabled:opacity-50"
                : "rounded-pill bg-red-700 px-5 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50"
            }
          >
            {pending ? "Salvando…" : "Confirmar"}
          </button>
        </div>
      </div>
    </div>
  );
}
