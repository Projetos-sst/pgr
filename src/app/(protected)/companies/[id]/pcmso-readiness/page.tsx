import Link from "next/link";
import { notFound } from "next/navigation";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import type {
  PcmsoReadinessItem,
  PcmsoReadinessSeverity,
} from "@/shared/domains/medicine/pcmso-readiness";
import { getCompanyAction } from "@/shared/server/actions/pgr/companies";
import { getPcmsoReadinessAction } from "@/shared/server/actions/medicine/pcmso-readiness";

import { PageHeader } from "../../../_ui/list";

export const dynamic = "force-dynamic";

const SECTIONS: { severity: PcmsoReadinessSeverity; title: string; tone: string }[] = [
  {
    severity: "blocking",
    title: "Pendências que impedem a geração",
    tone: "text-danger",
  },
  {
    severity: "not_available",
    title: "Etapas que o sistema ainda não tem",
    tone: "text-amber-900",
  },
  { severity: "warning", title: "Avisos", tone: "text-text-subtle" },
];

function ItemRow({ item }: { item: PcmsoReadinessItem }) {
  return (
    <li className="rounded-lg border border-white/50 p-3 text-sm">
      <p className="text-text">{item.message}</p>
      <p className="text-text-subtle text-xs">
        {item.reference}
        {item.href ? (
          <>
            {" · "}
            <Link href={item.href} className="text-primary underline">
              Corrigir
            </Link>
          </>
        ) : null}
      </p>
    </li>
  );
}

/** Conferência só leitura (NOB-148): não gera, não aprova e não assina o PCMSO. */
export default async function PcmsoReadinessPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireOfficeStaffPage();
  const { id } = await params;
  const company = await getCompanyAction(id);
  if (!company.ok) notFound();
  const result = await getPcmsoReadinessAction(id);
  if (!result.ok)
    return (
      <div className="flex flex-col gap-3 p-6">
        <p role="alert">{result.error.message}</p>
        <Link href={`/companies/${id}/services`} className="text-primary underline">
          Consultar serviços da empresa
        </Link>
      </div>
    );
  const { items, counts, ready } = result.data;

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader
        title={`Conferência do PCMSO — ${company.data.razaoSocial}`}
        backHref={`/companies/${id}/medical-risks`}
        description="O que falta para o PCMSO desta empresa poder ser gerado. Esta tela só confere os dados: não gera, não aprova e não assina."
      />

      <p
        role="status"
        className={`glass-card rounded-xl p-4 text-sm ${ready ? "text-text" : "text-amber-900"}`}
      >
        {ready
          ? "Todos os dados conferidos estão disponíveis."
          : `O PCMSO ainda não pode ser gerado: ${counts.blocking} pendência(s), ${counts.not_available} etapa(s) ainda inexistente(s) no sistema e ${counts.warning} aviso(s).`}
      </p>

      <Link href={`/companies/${id}/pcmso`} className="text-primary text-sm underline">
        PCMSO: prévias geradas e versões arquivadas
      </Link>

      {SECTIONS.map(({ severity, title, tone }) => {
        const rows = items.filter((item) => item.severity === severity);
        if (!rows.length) return null;
        return (
          <section
            key={severity}
            className="glass-card flex flex-col gap-3 rounded-xl p-5"
          >
            <h2 className={`text-base font-semibold ${tone}`}>
              {title} ({rows.length})
            </h2>
            <ul className="flex flex-col gap-2">
              {rows.map((item) => (
                <ItemRow key={item.code} item={item} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
