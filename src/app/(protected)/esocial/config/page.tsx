import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import {
  getEsocialConfigAction,
  getEsocialEventCountsAction,
} from "@/shared/server/actions/esocial/config";

import { PageHeader } from "../../_ui/list";
import { EsocialConfigIcon } from "./_components/esocial-config-icon";
import { EsocialConfigForm } from "./_components/esocial-config-form";

export const dynamic = "force-dynamic";

export default async function EsocialConfigPage() {
  await requireOfficeStaffPage();
  const [configResult, countsResult] = await Promise.all([
    getEsocialConfigAction(),
    getEsocialEventCountsAction(),
  ]);
  const config = configResult.ok ? configResult.data : null;
  const counts = countsResult.ok ? countsResult.data : { pending: 0, sent: 0, total: 0 };

  return (
    <div className="flex flex-col gap-[22px] px-[30px] pt-8 pb-10">
      <PageHeader
        icon={<EsocialConfigIcon />}
        title="Configurações do eSocial"
        description="Parâmetros de transmissão de eventos SST para o eSocial"
        backHref="/esocial"
      />
      <EsocialConfigForm config={config} counts={counts} />
    </div>
  );
}
