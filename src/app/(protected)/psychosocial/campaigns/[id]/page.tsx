import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import {
  campaignStatusLabel,
  questionTypeLabel,
} from "@/shared/domains/psychosocial/campaigns";
import {
  getCampaignAction,
  getCampaignStatsAction,
  listCampaignGesOptionsAction,
  listCampaignOptionsAction,
  listDerivedRisksAction,
  listWorkUnitOptionsAction,
} from "@/shared/server/actions/psychosocial/campaigns";

import { MIN_PSYCHOSOCIAL_GROUP_SIZE } from "@/shared/domains/psychosocial/anonymity";
import type { PsychosocialCampaign } from "@/shared/domains/psychosocial/campaigns";

import { PageHeader } from "../../../_ui/list";
import { CampaignControls } from "../_components/campaign-controls";
import { CampaignForm } from "../_components/campaign-form";
import { ConcludeButton } from "../_components/conclude-button";
import { QuestionsEditor } from "../_components/questions-editor";
import { RisksPanel } from "../_components/risks-panel";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "informacoes", label: "Informações" },
  { key: "perguntas", label: "Perguntas" },
  { key: "respostas", label: "Respostas" },
  { key: "dashboard", label: "Dashboard" },
  { key: "riscos", label: "Riscos" },
  { key: "conclusao", label: "Conclusão" },
];

type SearchParams = Promise<{ tab?: string }>;

export default async function CampanhaEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  await requireOfficeStaffPage();
  const { id } = await params;
  const { tab: rawTab } = await searchParams;
  const tab = TABS.some((t) => t.key === rawTab) ? rawTab! : "informacoes";

  const result = await getCampaignAction(id);
  if (!result.ok) notFound();
  const { campaign, questions } = result.data;

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const publicUrl = `${proto}://${host}/psychosocial-response/${campaign.id}/${campaign.publicToken}`;

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader
        title={campaign.name}
        description={`Campanha psicossocial · ${campaignStatusLabel(campaign.status)}`}
      />

      <nav className="flex flex-wrap gap-1 border-b border-white/50">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/psychosocial/campaigns/${id}?tab=${t.key}`}
            className={`rounded-t-md px-3 py-2 text-sm ${
              t.key === tab
                ? "border-b-2 border-black font-medium"
                : "text-text-subtle hover:text-text"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === "informacoes" ? (
        <InformacoesTab id={id} campaign={campaign} publicUrl={publicUrl} />
      ) : null}
      {tab === "perguntas" ? (
        <QuestionsEditor campaignId={id} questions={questions} />
      ) : null}
      {tab === "respostas" ? <RespostasTab id={id} /> : null}
      {tab === "dashboard" ? <DashboardTab id={id} /> : null}
      {tab === "riscos" ? <RiscosTab id={id} /> : null}
      {tab === "conclusao" ? <ConclusaoTab id={id} status={campaign.status} /> : null}

      <Link
        href="/psychosocial/campaigns"
        className="text-text-subtle text-sm hover:underline"
      >
        ← Voltar
      </Link>
    </div>
  );
}

async function InformacoesTab({
  id,
  campaign,
  publicUrl,
}: {
  id: string;
  campaign: PsychosocialCampaign;
  publicUrl: string;
}) {
  const optionsResult = await listCampaignOptionsAction();
  const companies = optionsResult.ok ? optionsResult.data.companies : [];
  const wuResult = await listWorkUnitOptionsAction(campaign.companyId);
  const workUnits = wuResult.ok ? wuResult.data : [];

  return (
    <div className="flex flex-col gap-6">
      <CampaignControls id={id} status={campaign.status} publicUrl={publicUrl} />
      <CampaignForm
        id={id}
        companies={companies}
        initialWorkUnits={workUnits}
        initial={{
          name: campaign.name,
          companyId: campaign.companyId,
          workUnitId: campaign.workUnitId,
          startsAt: campaign.startsAt,
          endsAt: campaign.endsAt,
          themeColor: campaign.themeColor,
          coverPath: campaign.coverPath,
          workerDescription: campaign.workerDescription,
        }}
      />
    </div>
  );
}

async function RespostasTab({ id }: { id: string }) {
  const result = await getCampaignStatsAction(id);
  const count = result.ok ? result.data.responseCount : 0;
  return (
    <div className="glass-card p-6">
      <p className="text-text-muted text-sm">
        Respostas anônimas coletadas via link público.
      </p>
      <p className="mt-2 text-3xl font-semibold tabular-nums">{count}</p>
      <p className="text-text-subtle text-sm">resposta(s) recebida(s)</p>
    </div>
  );
}

async function DashboardTab({ id }: { id: string }) {
  const result = await getCampaignStatsAction(id);
  if (!result.ok) return <p className="text-text-subtle text-sm">Sem dados.</p>;
  const { responseCount, questions } = result.data;
  if (responseCount === 0) {
    return (
      <p className="text-text-subtle text-sm">
        Nenhuma resposta coletada ainda — o dashboard aparece após a participação.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <p className="text-text-subtle text-sm">
        {responseCount} participante(s) · escala Likert 1–5 (maior = mais exposição)
      </p>
      <p className="text-text-subtle text-xs">
        Para preservar o anonimato, o resultado de uma pergunta só aparece a partir de{" "}
        {MIN_PSYCHOSOCIAL_GROUP_SIZE} respostas.
      </p>
      <ul className="flex flex-col gap-3">
        {questions.map((q) => (
          <li key={q.questionId} className="flex flex-col gap-1">
            <div className="flex justify-between text-sm">
              <span>{q.text}</span>
              <span className="text-text-subtle tabular-nums">
                {q.average == null ? "—" : q.average.toFixed(2)}
                {q.questionType === "likert" ? " / 5" : ""}
              </span>
            </div>
            {q.questionType === "likert" && q.average != null ? (
              <div className="h-2 w-full rounded-full bg-black/10">
                <div
                  className="h-2 rounded-full bg-black"
                  style={{ width: `${(q.average / 5) * 100}%` }}
                />
              </div>
            ) : (
              <span className="text-text-subtle text-xs">
                {q.suppressed
                  ? `Resultado oculto: menos de ${MIN_PSYCHOSOCIAL_GROUP_SIZE} respostas`
                  : `${questionTypeLabel(q.questionType)} · ${q.responseCount} resposta(s)`}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

async function RiscosTab({ id }: { id: string }) {
  const [risksResult, gesResult] = await Promise.all([
    listDerivedRisksAction(id),
    listCampaignGesOptionsAction(id),
  ]);
  const risks = risksResult.ok ? risksResult.data : [];
  const gesOptions = gesResult.ok ? gesResult.data : [];
  return <RisksPanel campaignId={id} risks={risks} gesOptions={gesOptions} />;
}

async function ConclusaoTab({ id, status }: { id: string; status: string }) {
  const result = await getCampaignStatsAction(id);
  const count = result.ok ? result.data.responseCount : 0;
  return (
    <div className="flex flex-col gap-4">
      <div className="glass-card p-4">
        <p className="text-text-muted text-sm">Resumo da campanha</p>
        <p className="mt-1 text-sm">
          Status atual: <strong>{campaignStatusLabel(status)}</strong> · {count}{" "}
          resposta(s)
        </p>
      </div>
      {status === "closed" || status === "archived" ? (
        <p className="text-text-subtle text-sm">Campanha já encerrada.</p>
      ) : (
        <ConcludeButton id={id} disabled={status === "draft"} />
      )}
    </div>
  );
}
