import Link from "next/link";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import {
  PLAN_FEATURES,
  PLAN_LABEL,
  TRIAL_DAYS,
  type PlanKey,
} from "@/shared/domains/platform/billing";
import { isBillingEnabled } from "@/shared/integrations/stripe/config";

import { ManageBillingButton } from "./_components/manage-billing-button";
import { UpgradeButton } from "./_components/upgrade-button";

export const dynamic = "force-dynamic";

export default async function PlanosPage() {
  const ctx = await requireOfficeStaffPage();
  const currentPlan = ctx.plan as PlanKey;
  const billingOn = isBillingEnabled();
  const canUpgrade = ctx.role === "owner" && currentPlan === "free";

  return (
    <div className="flex flex-col gap-8 px-6 py-8">
      {/* Top Banner / Header */}
      <div className="glass-panel flex flex-col items-center gap-3 text-center rounded-3xl border border-white/60 p-8 shadow-xl">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#5b63f5]/15 px-3.5 py-1 text-xs font-extrabold text-[#5b63f5]">
          ✦ Planos de Assinatura SST Manager
        </span>
        <h1 className="text-3xl font-black tracking-tight text-[#1b1f2e] sm:text-4xl">
          Escolha o Plano Ideal para a Sua Empresa
        </h1>
        <p className="max-w-2xl text-xs font-medium text-[#7a7f97] sm:text-sm">
          Tenha acesso completo à gestão de PGR, controle de EPIs, treinamentos com alertas automáticos, IA assistida para riscos e assinaturas digitais ilimitadas.
        </p>

        {/* Current Plan Badge */}
        <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/60 px-4 py-1.5 backdrop-blur-md shadow-xs">
          <span className="text-xs font-semibold text-[#8c91a8]">Seu plano atual:</span>
          <span className="text-xs font-extrabold text-[#5b63f5] uppercase tracking-wider">
            {PLAN_LABEL[currentPlan] ?? currentPlan}
          </span>
        </div>
      </div>

      {/* 3 Pricing Tier Cards */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* Tier 1: Gratuito */}
        <div className="glass-card flex flex-col justify-between p-6 transition-all duration-200 hover:-translate-y-1">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-extrabold text-[#1b1f2e]">Gratuito</h3>
              {currentPlan === "free" ? (
                <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-[10px] font-bold text-slate-700">
                  PLANO ATUAL
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-xs font-medium text-[#7a7f97]">
              Para profissionais degustarem e pequenas empresas.
            </p>

            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-3xl font-black text-[#1b1f2e]">R$ 0</span>
              <span className="text-xs font-medium text-[#8c91a8]">/mês</span>
            </div>

            <div className="mt-6 flex flex-col gap-2.5 border-t border-black/5 pt-4 text-xs font-medium text-[#52576e]">
              <div className="flex items-center gap-2">
                <span className="text-emerald-600 font-bold">✓</span>
                <span>1 empresa cadastrada</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-emerald-600 font-bold">✓</span>
                <span>Até 10 funcionários no PGR</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-emerald-600 font-bold">✓</span>
                <span>20 sugestões de riscos por IA /mês</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-emerald-600 font-bold">✓</span>
                <span>10 assinaturas digitais por mês</span>
              </div>
              <div className="flex items-center gap-2 text-[#9095ad]">
                <span>✕</span>
                <span className="line-through">Gestão de Equipes / Multiusuário</span>
              </div>
              <div className="flex items-center gap-2 text-[#9095ad]">
                <span>✕</span>
                <span className="line-through">Relatórios executivos eSocial</span>
              </div>
            </div>
          </div>

          <div className="mt-6">
            {currentPlan === "free" ? (
              <button
                disabled
                className="w-full rounded-xl border border-slate-300 bg-slate-100 py-2.5 text-xs font-bold text-slate-500 cursor-default"
              >
                Seu Plano Atual
              </button>
            ) : (
              <button
                disabled
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 text-xs font-bold text-slate-400"
              >
                Incluído
              </button>
            )}
          </div>
        </div>

        {/* Tier 2: PLANO PRO (Destaque Recomendo) */}
        <div className="glass-card relative flex flex-col justify-between border-2 border-[#5b63f5] p-6 shadow-2xl shadow-[#5b63f5]/20 transition-all duration-200 hover:-translate-y-1 bg-gradient-to-b from-[#5b63f5]/10 via-white/80 to-white">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#5b63f5] px-3.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white shadow-md">
            ★ MAIS POPULAR & RECOMENDADO
          </div>

          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-extrabold text-[#1b1f2e]">Plano Pro</h3>
              {currentPlan === "pro" ? (
                <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[10px] font-extrabold text-emerald-700">
                  SEU PLANO ATUAL
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-xs font-medium text-[#7a7f97]">
              Para escritórios, consultorias e departamentos de SST.
            </p>

            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-3xl font-black text-[#1b1f2e]">R$ 197</span>
              <span className="text-xs font-medium text-[#8c91a8]">/mês</span>
            </div>

            <div className="mt-6 flex flex-col gap-2.5 border-t border-black/5 pt-4 text-xs font-medium text-[#52576e]">
              <div className="flex items-center gap-2 font-bold text-[#1b1f2e]">
                <span className="text-[#5b63f5] font-black">✓</span>
                <span>Empresas & PGRs ilimitados</span>
              </div>
              <div className="flex items-center gap-2 font-bold text-[#1b1f2e]">
                <span className="text-[#5b63f5] font-black">✓</span>
                <span>Sugestão de Riscos IA ilimitada</span>
              </div>
              <div className="flex items-center gap-2 font-bold text-[#1b1f2e]">
                <span className="text-[#5b63f5] font-black">✓</span>
                <span>Assinaturas Digitais ilimitadas</span>
              </div>
              <div className="flex items-center gap-2 font-bold text-[#1b1f2e]">
                <span className="text-[#5b63f5] font-black">✓</span>
                <span>Gestão de Equipe & Colaboradores</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-emerald-600 font-bold">✓</span>
                <span>Estoque, entregas e baixas de EPI</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-emerald-600 font-bold">✓</span>
                <span>Treinamentos & controle de vencimento</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-emerald-600 font-bold">✓</span>
                <span>Suporte prioritário via WhatsApp</span>
              </div>
            </div>
          </div>

          <div className="mt-6">
            {currentPlan === "pro" ? (
              <div className="flex flex-col gap-2">
                <p className="text-center text-xs font-bold text-emerald-700">✓ Assinatura Pro Ativa</p>
                {ctx.role === "owner" && billingOn ? <ManageBillingButton /> : null}
              </div>
            ) : canUpgrade && billingOn ? (
              <div className="flex flex-col gap-2">
                <UpgradeButton />
                <span className="text-center text-[10px] font-medium text-[#8c91a8]">
                  Teste grátis de {TRIAL_DAYS} dias. Cancele a qualquer momento.
                </span>
              </div>
            ) : canUpgrade && !billingOn ? (
              <p className="rounded-xl border border-dashed border-amber-300 bg-amber-50 px-3 py-2 text-center text-xs text-amber-800">
                Cobrança via cartão de crédito indisponível no ambiente de dev.
              </p>
            ) : (
              <p className="text-center text-xs font-medium text-[#8c91a8]">
                Disponível para administradores da org.
              </p>
            )}
          </div>
        </div>

        {/* Tier 3: Enterprise */}
        <div className="glass-card flex flex-col justify-between p-6 transition-all duration-200 hover:-translate-y-1">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-extrabold text-[#1b1f2e]">Enterprise</h3>
              <span className="rounded-full bg-purple-500/15 px-2.5 py-0.5 text-[10px] font-bold text-purple-700">
                CORPORATIVO
              </span>
            </div>
            <p className="mt-1 text-xs font-medium text-[#7a7f97]">
              Para grandes empresas e redes com filiais integradas.
            </p>

            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-3xl font-black text-[#1b1f2e]">R$ 497</span>
              <span className="text-xs font-medium text-[#8c91a8]">/mês</span>
            </div>

            <div className="mt-6 flex flex-col gap-2.5 border-t border-black/5 pt-4 text-xs font-medium text-[#52576e]">
              <div className="flex items-center gap-2 font-bold text-[#1b1f2e]">
                <span className="text-purple-600 font-bold">✓</span>
                <span>Tudo incluso no Plano Pro</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-purple-600 font-bold">✓</span>
                <span>Múltiplos CNPJs & Grupos de Filiais</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-purple-600 font-bold">✓</span>
                <span>Eventos eSocial (S-2210, S-2220, S-2240)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-purple-600 font-bold">✓</span>
                <span>Gerente de Sucesso dedicado</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-purple-600 font-bold">✓</span>
                <span>Treinamento de equipe personalizado</span>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <Link
              href="mailto:suporte@sstmanager.com.br?subject=Interesse%20no%20Plano%20Enterprise"
              className="block w-full rounded-xl border border-[#5b63f5] bg-white py-2.5 text-center text-xs font-bold text-[#5b63f5] transition-colors hover:bg-[#5b63f5]/10"
            >
              Falar com Consultor
            </Link>
          </div>
        </div>
      </div>

      {/* Comparison Table */}
      <div className="glass-panel overflow-hidden rounded-2xl border border-white/60 p-6 shadow-xl">
        <h3 className="text-base font-extrabold text-[#1b1f2e] mb-4">Comparativo Detalhado de Recursos</h3>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-left font-bold uppercase tracking-wider text-[#52576e]">
              <tr>
                <th className="px-4 py-3">Recurso / Módulo</th>
                <th className="px-4 py-3 text-center">Gratuito</th>
                <th className="px-4 py-3 text-center text-[#5b63f5]">Pro (Recomendado)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-[#1b1f2e]">
              {PLAN_FEATURES.map((row) => (
                <tr key={row.label} className="hover:bg-slate-50/60">
                  <td className="px-4 py-3 font-semibold">{row.label}</td>
                  <td className="px-4 py-3 text-center text-[#7a7f97]">{row.free}</td>
                  <td className="px-4 py-3 text-center font-extrabold text-[#5b63f5]">{row.pro}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
