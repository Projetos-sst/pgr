"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  COMPANY_MODULE_LABELS,
  type CompanyModuleView,
} from "@/shared/domains/platform/company-modules";
import { changeCompanyModuleAction } from "@/shared/server/actions/platform/company-modules";
import { FormError, FormSection, TextField, SubmitButton } from "../../../_ui/form";

export function ModuleControls({
  companyId,
  modules,
  canManage,
}: {
  companyId: string;
  modules: CompanyModuleView[];
  canManage: boolean;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {modules.map((entry) => (
        <ModuleControl
          key={entry.module}
          companyId={companyId}
          entry={entry}
          canManage={canManage}
        />
      ))}
    </div>
  );
}

function ModuleControl({
  companyId,
  entry,
  canManage,
}: {
  companyId: string;
  entry: CompanyModuleView;
  canManage: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  return (
    <FormSection title={COMPANY_MODULE_LABELS[entry.module]} columns={1}>
      <p>{entry.enabled ? "Habilitado" : "Não habilitado"}</p>
      {canManage ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const data = new FormData(form);
            setError(null);
            startTransition(async () => {
              try {
                const result = await changeCompanyModuleAction(companyId, {
                  module: entry.module,
                  enabled: !entry.enabled,
                  reason: String(data.get("reason") ?? ""),
                });
                if (!result.ok) {
                  setError(result.error.fields?.reason ?? result.error.message);
                  return;
                }
                form.reset();
                router.refresh();
              } catch {
                setError("Não foi possível alterar o serviço. Tente novamente.");
              }
            });
          }}
          className="flex flex-col gap-3"
        >
          <TextField
            name="reason"
            label="Motivo da alteração (até 500 caracteres)"
            required
          />
          {entry.enabled && (
            <p className="text-text-muted text-sm">
              Desabilitar bloqueia o uso deste módulo para a empresa e preserva seus
              registros.
            </p>
          )}
          <FormError message={error} />
          <SubmitButton
            pending={pending}
            label={entry.enabled ? "Desabilitar serviço" : "Habilitar serviço"}
          />
        </form>
      ) : (
        <p className="text-text-muted text-sm">
          Somente o administrador altera os serviços.
        </p>
      )}
    </FormSection>
  );
}
