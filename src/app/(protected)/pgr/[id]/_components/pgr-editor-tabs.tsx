"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { Pgr } from "@/shared/domains/pgr/pgr";
import type { PgrGesLinkItem } from "@/shared/domains/pgr/pgr-ges";
import type { PgrRevisionListItem } from "@/shared/domains/pgr/pgr-revision";
import type { PgrConsolidated } from "@/shared/domains/pgr/pgr-consolidated";
import { isPgrEditLocked } from "@/shared/domains/pgr/pgr-lock";
import type { PgrSignatureView } from "@/shared/domains/pgr/pgr-signature";
import type { DocumentListItem } from "@/shared/domains/documents/documents";
import { publishPgrAction } from "@/shared/server/actions/pgr/pgr";

import { PgrBasicInfoTab } from "./pgr-basic-info-tab";
import { PgrGesTab } from "./pgr-ges-tab";
import { PgrRevisionsTab } from "./pgr-revisions-tab";
import { PgrConsolidatedTab } from "./pgr-consolidated-tab";
import { PgrSignaturePanel } from "./pgr-signature-panel";
import { PgrDocumentsTab } from "./pgr-documents-tab";

type TabKey = "basic" | "ges" | "consolidated" | "revisions" | "signature" | "documents";

interface StepItem {
  key: TabKey;
  label: string;
  subtitle: string;
  stepNumber: number;
  completed: boolean;
  unlocked: boolean;
  lockReason?: string;
}

export function PgrEditorTabs({
  pgrId,
  pgr,
  isPublished,
  companyName,
  workUnitName,
  availableGes,
  gesLinks,
  revisions,
  consolidated,
  signature,
  linkedDocuments,
  linkedDocumentsTotal,
  technicianDocuments,
  technicianDocumentsTotal,
}: {
  pgrId: string;
  pgr: Pgr;
  isPublished: boolean;
  companyName: string;
  workUnitName: string | null;
  availableGes: { id: string; name: string }[];
  gesLinks: PgrGesLinkItem[];
  revisions: PgrRevisionListItem[];
  consolidated: PgrConsolidated | null;
  signature?: PgrSignatureView;
  linkedDocuments: DocumentListItem[];
  linkedDocumentsTotal: number;
  technicianDocuments: DocumentListItem[];
  technicianDocumentsTotal: number;
}) {
  const router = useRouter();
  const [active, setActive] = useState<TabKey>("basic");
  const [lockNotice, setLockNotice] = useState<string | null>(null);
  const [liveSignature, setLiveSignature] = useState<PgrSignatureView | undefined>(
    signature,
  );
  const [publishPending, startPublishTransition] = useTransition();

  // Mesma regra que o servidor impõe em toda escrita (`assertPgrEditable`) — aqui ela só
  // antecipa o bloqueio na tela; quem garante a invariante é a Server Action / o REST.
  const isLocked = isPgrEditLocked({
    signatureState: liveSignature?.state ?? "none",
    publishedAt: isPublished ? new Date() : null,
  });

  // Métricas de riscos reais derivadas da visão consolidada
  let totalRisks = 0;
  let criticalCount = 0;
  let highCount = 0;
  let mediumCount = 0;
  let lowCount = 0;
  let pendingMeasuresCount = 0;

  if (consolidated && consolidated.ges) {
    for (const g of consolidated.ges) {
      for (const r of g.risks) {
        totalRisks++;
        const level = r.riskLevel;
        const res = r.result;

        if (
          res === "intolerable" ||
          res === "substantial" ||
          (level != null && level >= 15)
        ) {
          criticalCount++;
        } else if (res === "moderate" || (level != null && level >= 10)) {
          highCount++;
        } else if (res === "tolerable" || (level != null && level >= 5)) {
          mediumCount++;
        } else if (res === "trivial" || (level != null && level < 5)) {
          lowCount++;
        }

        for (const m of r.measures) {
          if (m.state === "without_plan" || m.state === "overdue") {
            pendingMeasuresCount++;
          }
        }
      }
    }
  }

  // Progresso & Trava sequencial de etapas (Guided Workflow)
  const stepBasicDone = Boolean(pgr.companyId && pgr.issuedAt && pgr.validUntil);
  const stepGesDone = gesLinks.length > 0;
  const stepRisksDone = totalRisks > 0;
  const stepSignatureDone = liveSignature?.state === "signed";

  // Regras de liberação gradual:
  // 1. Identificação -> sempre liberada
  // 2. Vínculos de GES -> liberado após Identificação
  // 3. Inventário de Riscos -> liberado após Vínculos de GES
  // 4. Revisões -> liberado após Identificação
  // 5. Assinatura -> liberado APENAS após Identificação, GES e Inventário concluídos
  const isBasicUnlocked = true;
  const isGesUnlocked = stepBasicDone;
  const isRisksUnlocked = stepBasicDone && stepGesDone;
  const isRevisionsUnlocked = stepBasicDone;
  const isSignatureUnlocked = stepBasicDone && stepGesDone && stepRisksDone;
  const isDocumentsUnlocked = stepBasicDone;

  let completedStepsCount = 0;
  if (stepBasicDone) completedStepsCount++;
  if (stepGesDone) completedStepsCount++;
  if (stepRisksDone) completedStepsCount++;
  if (stepSignatureDone) completedStepsCount++;

  const progressPercent = Math.round((completedStepsCount / 4) * 100);

  const steps: StepItem[] = [
    {
      key: "basic",
      label: "Identificação",
      subtitle: workUnitName ?? "Empresa & obra",
      stepNumber: 1,
      completed: stepBasicDone,
      unlocked: isBasicUnlocked,
    },
    {
      key: "ges",
      label: "Vínculos de GES",
      subtitle: `${gesLinks.length} ${gesLinks.length === 1 ? "GES vinculado" : "GES vinculados"}`,
      stepNumber: 2,
      completed: stepGesDone,
      unlocked: isGesUnlocked,
      lockReason:
        "Preencha a data de emissão e validade na etapa 1 (Identificação) para liberar.",
    },
    {
      key: "consolidated",
      label: "Inventário de Riscos",
      subtitle: `${totalRisks} ${totalRisks === 1 ? "risco mapeado" : "riscos mapeados"} · ${pendingMeasuresCount} ${pendingMeasuresCount === 1 ? "medida pendente" : "medidas pendentes"}`,
      stepNumber: 3,
      completed: stepRisksDone,
      unlocked: isRisksUnlocked,
      lockReason:
        "Vincule ao menos um GES na etapa 2 (Vínculos de GES) para compor o inventário.",
    },
    {
      key: "revisions",
      label: "Revisões",
      subtitle: `${revisions.length} ${revisions.length === 1 ? "registrada" : "registradas"}`,
      stepNumber: 4,
      completed: revisions.length > 0,
      unlocked: isRevisionsUnlocked,
      lockReason:
        "Preencha a etapa 1 (Identificação) para liberar o histórico de revisões.",
    },
    {
      key: "signature",
      label: "Assinatura",
      subtitle:
        liveSignature?.state === "signed"
          ? isPublished
            ? `Publicado · ${liveSignature.signerName ?? ""}`
            : `Assinado · ${liveSignature.signerName ?? ""}`
          : liveSignature?.state === "pending"
            ? "Aguardando assinatura"
            : "Responsável técnico",
      stepNumber: 5,
      completed: stepSignatureDone,
      unlocked: isSignatureUnlocked,
      lockReason:
        "Conclua a Identificação, os Vínculos de GES e o Inventário de Riscos para liberar a assinatura.",
    },
    {
      key: "documents",
      label: "Documentos e PDF",
      subtitle: `${linkedDocumentsTotal} ${linkedDocumentsTotal === 1 ? "anexo no GED" : "anexos no GED"}`,
      stepNumber: 6,
      completed: linkedDocumentsTotal > 0,
      unlocked: isDocumentsUnlocked,
      lockReason:
        "Preencha a etapa 1 (Identificação) para gerar o PDF e anexar documentos.",
    },
  ];

  function handlePublish() {
    startPublishTransition(async () => {
      const res = await publishPgrAction(pgrId);
      if (res.ok) {
        router.refresh();
      }
    });
  }

  function handleSelectStep(step: StepItem) {
    if (!step.unlocked) {
      setLockNotice(
        step.lockReason ??
          "Esta etapa está bloqueada até a conclusão dos pré-requisitos.",
      );
      return;
    }
    setLockNotice(null);
    setActive(step.key);
  }

  // Lista de etapas jogáveis para o rodapé "Avançar"
  const playableStepsKeys: TabKey[] = [
    "basic",
    "ges",
    "consolidated",
    "revisions",
    "signature",
    "documents",
  ];
  const currentStepIdx = playableStepsKeys.indexOf(active);
  const prevKey = currentStepIdx > 0 ? playableStepsKeys[currentStepIdx - 1] : null;
  const nextKey =
    currentStepIdx >= 0 && currentStepIdx < playableStepsKeys.length - 1
      ? playableStepsKeys[currentStepIdx + 1]
      : null;

  const nextStepObj = steps.find((s) => s.key === nextKey);

  const brDate = (d: string | null) => (d ? d.split("-").reverse().join("/") : "—");

  return (
    <div className="flex flex-col gap-6">
      {/* Top Header Bar do documento */}
      <div className="glass-card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/pgr"
            className="glass-panel text-text-muted hover:text-text flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] transition-colors"
            aria-label="Voltar para listagem de PGRs"
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
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-text text-xl font-extrabold tracking-tight sm:text-2xl">
                PGR — {companyName}
              </h1>
              {liveSignature?.state === "signed" ? (
                isPublished ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-0.5 text-xs font-bold text-emerald-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                    Assinado e Publicado
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-0.5 text-xs font-bold text-emerald-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                    Assinado (Aguardando publicação)
                  </span>
                )
              ) : liveSignature?.state === "pending" ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-3 py-0.5 text-xs font-bold text-amber-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-600" />
                  Aguardando assinatura
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-3 py-0.5 text-xs font-bold text-amber-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-600" />
                  Em elaboração
                </span>
              )}
            </div>
            <div className="text-text-subtle mt-1 font-mono text-xs">
              Doc. {pgr.id.slice(0, 8).toUpperCase()} ·{" "}
              {workUnitName ?? "Sem obra/contrato"} · Emitido em {brDate(pgr.issuedAt)}
            </div>
          </div>
        </div>
      </div>

      {/* Alerta de Etapa Bloqueada */}
      {lockNotice ? (
        <div className="glass-card flex items-center justify-between rounded-[16px] border border-amber-400/40 bg-amber-500/10 p-4 text-xs text-amber-900">
          <div className="flex items-center gap-2.5">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="shrink-0 text-amber-600"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span className="font-semibold">{lockNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setLockNotice(null)}
            className="text-[11px] font-bold text-amber-800 underline hover:text-amber-950"
          >
            Entendi
          </button>
        </div>
      ) : null}

      {/* Banner de documento bloqueado para edição */}
      {isLocked ? (
        <div className="glass-card flex items-center gap-3 rounded-[16px] border border-indigo-400/30 bg-indigo-500/8 px-5 py-3.5 text-xs">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="shrink-0 text-indigo-500"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <span className="font-semibold text-indigo-800">
            {isPublished
              ? "Documento publicado — apenas leitura. Nenhuma edição é permitida."
              : "Documento assinado digitalmente — apenas leitura. A partir da assinatura o PGR não pode mais ser editado."}
          </span>
        </div>
      ) : null}

      {/* Editor Body Grid: Stepper + Area Principal */}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[250px_1fr]">
        {/* Stepper Lateral Sticky */}
        <aside className="glass-panel flex flex-col gap-1.5 rounded-[20px] p-3 shadow-md lg:sticky lg:top-24">
          <nav
            className="flex flex-col gap-1"
            aria-label="Navegação por capítulos do PGR"
          >
            {steps.map((s) => {
              const isActive = active === s.key;
              const isLocked = !s.unlocked;

              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => handleSelectStep(s)}
                  title={isLocked ? s.lockReason : undefined}
                  className={`flex items-center gap-3 rounded-[13px] p-3 text-left transition-all ${
                    isActive
                      ? "bg-primary shadow-primary text-white"
                      : isLocked
                        ? "text-text-subtle cursor-not-allowed opacity-50 hover:bg-black/5"
                        : "text-text-muted hover:text-text hover:bg-white/30"
                  }`}
                >
                  <span
                    className={`flex h-6.5 w-6.5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      isActive
                        ? "bg-white/25 text-white"
                        : s.completed
                          ? "bg-emerald-600 text-white"
                          : isLocked
                            ? "text-text-subtle bg-black/10"
                            : "text-text-subtle bg-black/10"
                    }`}
                  >
                    {s.completed && !isActive ? (
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                      >
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    ) : isLocked && !isActive ? (
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                      >
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                    ) : (
                      s.stepNumber
                    )}
                  </span>
                  <div className="min-w-0 flex-1 leading-tight">
                    <div className="flex items-center justify-between truncate text-xs font-bold sm:text-sm">
                      <span>{s.label}</span>
                    </div>
                    <div
                      className={`truncate text-[11px] ${
                        isActive
                          ? "text-white/80"
                          : s.completed
                            ? "font-medium text-emerald-700"
                            : "text-text-subtle"
                      }`}
                    >
                      {s.subtitle}
                    </div>
                  </div>
                </button>
              );
            })}
          </nav>

          {/* Barra de Progresso */}
          <div className="mt-2 border-t border-black/5 px-2 pt-3 pb-1">
            <div className="text-text-subtle mb-1.5 flex justify-between text-[11px] font-semibold">
              <span>Progresso</span>
              <span className="text-primary font-bold">{progressPercent}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-black/10">
              <div
                className="bg-primary h-full rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </aside>

        {/* ÁREA PRINCIPAL */}
        <main className="flex min-w-0 flex-col gap-6">
          {/* KPI Summary Bar (Níveis de Risco Mapeados) */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
            <div className="glass-card flex flex-col rounded-[16px] p-4">
              <span className="text-2xl font-extrabold text-[#d33a3f] sm:text-3xl">
                {criticalCount}
              </span>
              <span className="text-text-subtle mt-0.5 text-xs font-medium">
                Risco crítico
              </span>
            </div>
            <div className="glass-card flex flex-col rounded-[16px] p-4">
              <span className="text-2xl font-extrabold text-[#c9820a] sm:text-3xl">
                {highCount}
              </span>
              <span className="text-text-subtle mt-0.5 text-xs font-medium">
                Risco alto
              </span>
            </div>
            <div className="glass-card flex flex-col rounded-[16px] p-4">
              <span className="text-primary text-2xl font-extrabold sm:text-3xl">
                {mediumCount}
              </span>
              <span className="text-text-subtle mt-0.5 text-xs font-medium">
                Risco moderado
              </span>
            </div>
            <div className="glass-card flex flex-col rounded-[16px] p-4">
              <span className="text-2xl font-extrabold text-[#0e9f6e] sm:text-3xl">
                {lowCount}
              </span>
              <span className="text-text-subtle mt-0.5 text-xs font-medium">
                Risco baixo
              </span>
            </div>
          </div>

          {/* Conteúdo da Etapa Ativa */}
          {active === "basic" ? (
            <PgrBasicInfoTab
              pgrId={pgrId}
              pgr={pgr}
              companyName={companyName}
              workUnitName={workUnitName}
              technicianDocuments={technicianDocuments}
              technicianDocumentsTotal={technicianDocumentsTotal}
              readOnly={isLocked}
            />
          ) : null}
          {active === "ges" ? (
            <PgrGesTab
              pgrId={pgrId}
              links={gesLinks}
              availableGes={availableGes}
              readOnly={isLocked}
            />
          ) : null}
          {active === "consolidated" ? (
            <PgrConsolidatedTab consolidated={consolidated} />
          ) : null}
          {active === "revisions" ? (
            <PgrRevisionsTab pgrId={pgrId} revisions={revisions} readOnly={isLocked} />
          ) : null}
          {active === "signature" ? (
            <PgrSignaturePanel
              pgrId={pgrId}
              signature={liveSignature}
              onSignatureChange={setLiveSignature}
              isPublished={isPublished}
              onPublish={handlePublish}
              publishPending={publishPending}
            />
          ) : null}
          {active === "documents" ? (
            <PgrDocumentsTab
              pgrId={pgrId}
              pgrLabel={`PGR — ${companyName}`}
              linkedDocuments={linkedDocuments}
              linkedTotal={linkedDocumentsTotal}
            />
          ) : null}

          {/* Rodapé de Navegação Guiada por Etapas */}
          <div className="glass-card flex items-center justify-between p-4">
            {prevKey ? (
              <button
                type="button"
                onClick={() => setActive(prevKey)}
                className="glass-panel text-text-muted hover:text-text rounded-card flex items-center gap-2 px-4 py-2 text-xs font-bold transition-all sm:text-sm"
              >
                &larr; Etapa anterior
              </button>
            ) : (
              <div />
            )}

            {nextKey && nextStepObj ? (
              <button
                type="button"
                onClick={() => {
                  if (nextStepObj.unlocked) {
                    setActive(nextKey);
                    setLockNotice(null);
                  } else {
                    setLockNotice(
                      nextStepObj.lockReason ??
                        "Esta etapa está bloqueada até a conclusão dos pré-requisitos.",
                    );
                  }
                }}
                className={`rounded-card flex items-center gap-2 px-4 py-2 text-xs font-bold transition-all sm:text-sm ${
                  nextStepObj.unlocked
                    ? "btn-primary shadow-primary text-white"
                    : "text-text-subtle cursor-not-allowed bg-black/10"
                }`}
              >
                Próxima etapa: {nextStepObj.label} &rarr;
              </button>
            ) : null}
          </div>
        </main>
      </div>
    </div>
  );
}
