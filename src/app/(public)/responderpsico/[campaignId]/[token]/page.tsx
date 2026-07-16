import { loadPublicPsychosocialCampaign } from "@/shared/server/actions/public-psychosocial";

import { PublicQuestionnaire } from "./_form";

export const dynamic = "force-dynamic";

export default async function ResponderPsicoPage({
  params,
}: {
  params: Promise<{ campaignId: string; token: string }>;
}) {
  const { campaignId, token } = await params;
  const resolved = await loadPublicPsychosocialCampaign(campaignId, token);

  if (resolved.kind === "invalid") {
    return <PublicMessage title="Link inválido" body="Verifique o endereço recebido." />;
  }
  if (resolved.kind === "not_open") {
    return (
      <PublicMessage
        title="Campanha indisponível"
        body="Esta campanha está encerrada ou fora do período de resposta."
      />
    );
  }

  const { campaign, questions } = resolved.view;
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col gap-6 px-4 py-10">
      <header
        className="rounded-xl p-6 text-white"
        style={{ backgroundColor: campaign.themeColor || "#2563eb" }}
      >
        <h1 className="text-xl font-semibold">{campaign.name}</h1>
        {campaign.workerDescription ? (
          <p className="mt-2 text-sm opacity-90">{campaign.workerDescription}</p>
        ) : null}
      </header>
      <p className="text-sm text-zinc-500">
        Suas respostas são <strong>anônimas</strong> — não identificamos você
        nominalmente.
      </p>
      <PublicQuestionnaire campaignId={campaign.id} token={token} questions={questions} />
    </main>
  );
}

function PublicMessage({ title, body }: { title: string; body: string }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="text-sm text-zinc-500">{body}</p>
    </main>
  );
}
