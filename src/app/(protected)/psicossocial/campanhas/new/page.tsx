import Link from "next/link";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { listCampaignOptionsAction } from "@/shared/server/actions/psychosocial/campaigns";

import { PageHeader } from "../../../_ui/list";
import { CampaignForm } from "../_components/campaign-form";

export const dynamic = "force-dynamic";

export default async function NovaCampanhaPage() {
  await requireOfficeStaffPage();
  const optionsResult = await listCampaignOptionsAction();
  const companies = optionsResult.ok ? optionsResult.data.companies : [];

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader
        title="Nova campanha psicossocial"
        description="Aba Informações — depois monte o questionário na aba Perguntas."
      />
      <CampaignForm companies={companies} initialWorkUnits={[]} />
      <Link
        href="/psicossocial/campanhas"
        className="text-sm text-zinc-500 hover:underline"
      >
        ← Voltar
      </Link>
    </div>
  );
}
