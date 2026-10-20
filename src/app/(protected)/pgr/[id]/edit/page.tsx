import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { getPgrAction } from "@/shared/server/actions/pgr/pgr";
import { listCompanyOptionsAction } from "@/shared/server/actions/pgr/companies";
import { getPgrSignatureViewAction } from "@/shared/server/actions/pgr/pgr-signature";

import { PgrForm } from "../../_components/pgr-form";

export const dynamic = "force-dynamic";

export default async function EditPgrPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireOfficeStaffPage();
  const { id } = await params;

  const [pgrResult, companyOptions, signatureResult] = await Promise.all([
    getPgrAction(id),
    listCompanyOptionsAction("pgr"),
    getPgrSignatureViewAction({ pgrId: id }),
  ]);
  if (!pgrResult.ok) notFound();
  const companies = companyOptions.ok ? companyOptions.data : [];
  const pgr = pgrResult.data;

  // Bloqueia edição se o PGR já estiver assinado ou publicado
  const signatureState = signatureResult.ok ? signatureResult.data.state : null;
  if (pgr.publishedAt || signatureState === "signed") {
    redirect(`/pgr/${id}`);
  }

  const companyName =
    companies.find((c) => c.id === pgr.companyId)?.razaoSocial ?? "Empresa";

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 p-4 sm:p-8">
      {/* Header no padrão com ícone roxo (Imagem 2) */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-4">
          <Link
            href={`/pgr/${id}`}
            className="glass-panel text-text-muted hover:text-text flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] transition-colors"
            aria-label="Voltar para o PGR"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M15 6l-6 6 6 6" />
            </svg>
          </Link>
          <div className="bg-primary shadow-primary flex h-12 w-12 shrink-0 items-center justify-center rounded-[15px] text-white">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
          </div>
          <div>
            <h1 className="text-text text-xl font-extrabold tracking-tight sm:text-2xl">
              Editar PGR — {companyName}
            </h1>
            <p className="text-text-subtle mt-0.5 text-xs sm:text-sm">
              Programa de Gerenciamento de Riscos · Atualize os dados cadastrais e do
              responsável técnico
            </p>
          </div>
        </div>
      </div>

      <div className="glass-card rounded-[20px] p-6 sm:p-8">
        <PgrForm companies={companies} pgr={pgr} />
      </div>
    </div>
  );
}
