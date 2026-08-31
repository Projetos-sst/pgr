import { notFound } from "next/navigation";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import {
  getEpiCatalogAction,
  listEpiCatalogAuditAction,
} from "@/shared/server/actions/pgr/epi-catalog";

import { EmptyState, PageHeader } from "../../../_ui/list";
import { FormSection } from "../../../_ui/form";
import { EpiCatalogForm } from "../../_components/epi-catalog-form";
import { EpiIcon } from "../../_components/epi-icon";
import { DeleteEpiCatalog } from "../../_components/delete-epi-catalog";

export const dynamic = "force-dynamic";

function formatAuditDate(date: Date): string {
  return new Date(date).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export default async function EditEpiCatalogPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireOfficeStaffPage();
  const { id } = await params;
  const [result, auditResult] = await Promise.all([
    getEpiCatalogAction(id),
    listEpiCatalogAuditAction(id),
  ]);
  if (!result.ok) notFound();
  const auditEntries = auditResult.ok ? auditResult.data : [];

  return (
    <div className="mx-auto flex w-full max-w-[940px] flex-col gap-[22px] px-[30px] pt-7 pb-10">
      <PageHeader
        backHref="/epi-catalog"
        icon={<EpiIcon />}
        title="Editar item de catálogo"
        description={result.data.name}
        action={
          <DeleteEpiCatalog
            id={result.data.id}
            redirectTo="/epi-catalog"
            variant="text"
          />
        }
      />
      <EpiCatalogForm item={result.data} />

      {/* Histórico de alterações (issue #25): resumo do diff a cada create/update. */}
      <FormSection title="Histórico de alterações" columns={1}>
        {auditEntries.length === 0 ? (
          <EmptyState message="Nenhum registro de alteração ainda." isFlat />
        ) : (
          <ul className="flex flex-col gap-3">
            {auditEntries.map((entry) => (
              <li
                key={entry.id}
                className="border-white/60 pb-3 text-sm last:border-0 last:pb-0"
                style={{ borderBottomWidth: 1 }}
              >
                <p className="text-text-subtle font-mono text-[11px]">
                  {formatAuditDate(entry.changedAt)}
                  {entry.changedBy ? ` · ${entry.changedBy}` : ""}
                </p>
                <p className="text-text mt-0.5">{entry.summary}</p>
              </li>
            ))}
          </ul>
        )}
      </FormSection>
    </div>
  );
}
