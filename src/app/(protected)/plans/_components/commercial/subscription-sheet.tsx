import type { ReactNode } from "react";

import type { SubscriptionStatus } from "@/shared/domains/commercial/billing-model";
import {
  ACCESS_LABEL,
  FINANCIAL_LABEL,
  PAYMENT_METHOD_TEXT,
  PORTAL_NOTICE,
  type AccessState,
  type SheetAction,
} from "@/shared/domains/commercial/subscription-sheet";
import type {
  SheetContract,
  SubscriptionSheet as SheetData,
} from "@/shared/server/commercial/subscription-sheet-core";

import { StatusBadge, type StatusTone } from "../../../_ui/status-badge";
import {
  PERIOD_LABEL,
  SERVICE_LABEL,
  UNIT_LABEL,
  formatBrl,
  formatCivilDate,
} from "./format";
import { PortalButton } from "./portal-button";
import { ResumeCheckoutButton } from "./resume-checkout-button";
import { formatInstant } from "./sheet-format";

const EMPTY_MESSAGE = "Nenhuma contratação registrada para este escritório.";
const NO_ACTION_MESSAGE = "Nenhuma ação disponível no momento.";

const FINANCIAL_TONE: Record<SubscriptionStatus | "none", StatusTone> = {
  none: "neutral",
  incomplete: "amber",
  incomplete_expired: "red",
  trialing: "green",
  active: "green",
  past_due: "red",
  unpaid: "red",
  canceled: "red",
  paused: "amber",
};

const ACCESS_TONE: Record<AccessState, StatusTone> = {
  granted: "green",
  legacy: "amber",
  suspended: "red",
  none: "neutral",
};

const ACTION_VIEW: Record<SheetAction, (contractId: string) => ReactNode> = {
  manage_in_portal: (contractId) => <PortalButton contractId={contractId} />,
  resume_checkout: (contractId) => <ResumeCheckoutButton contractId={contractId} />,
};

function Block({
  title,
  badge,
  children,
}: {
  title: string;
  badge: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-label={title} className="glass-card flex flex-col gap-2 p-4">
      <h4 className="text-text text-sm font-extrabold">{title}</h4>
      {badge}
      <div className="text-text-muted flex flex-col gap-1 text-xs">{children}</div>
    </section>
  );
}

function renewalText(financial: SheetContract["financial"]): string {
  if (financial.cancelAtPeriodEnd)
    return `Cancelamento agendado para ${formatInstant(financial.currentPeriodEnd)}`;
  if (financial.status === "active" || financial.status === "trialing")
    return `Renovação em ${formatInstant(financial.currentPeriodEnd)}`;
  return "Sem renovação prevista";
}

function PaymentBlock({ financial }: { financial: SheetContract["financial"] }) {
  const key = financial.status ?? "none";
  return (
    <Block
      title="Pagamento"
      badge={<StatusBadge tone={FINANCIAL_TONE[key]} label={FINANCIAL_LABEL[key]} />}
    >
      <p>
        Período atual: {formatInstant(financial.currentPeriodStart)} a{" "}
        {formatInstant(financial.currentPeriodEnd)}
      </p>
      <p>{renewalText(financial)}</p>
      {financial.canceledAt ? (
        <p>Cancelada em {formatInstant(financial.canceledAt)}</p>
      ) : null}
      <p>Método de pagamento: {PAYMENT_METHOD_TEXT}</p>
    </Block>
  );
}

function AccessBlock({ access }: { access: SheetContract["access"] }) {
  return (
    <Block
      title="Acesso"
      badge={
        <StatusBadge
          tone={ACCESS_TONE[access.state]}
          label={ACCESS_LABEL[access.state]}
        />
      }
    >
      <p>O acesso vem dos direitos de uso, separado da situação do pagamento.</p>
      {access.keptUntil ? (
        <p>O acesso é mantido até {formatInstant(access.keptUntil)}.</p>
      ) : null}
    </Block>
  );
}

function ItemList({ contract }: { contract: SheetContract }) {
  return (
    <ul aria-label="Itens contratados" className="flex flex-col gap-1 text-xs">
      {contract.items.map((item) => (
        <li key={item.position}>
          {SERVICE_LABEL[item.service]} · {item.label} — {formatBrl(item.unitAmountCents)}{" "}
          {UNIT_LABEL[item.unit]}
        </li>
      ))}
    </ul>
  );
}

function Scope({ contract }: { contract: SheetContract }) {
  const names = contract.companies.map((company) => company.name).join(", ");
  return (
    <div className="text-text-muted flex flex-col gap-1 text-xs">
      <p>Empresas atendidas: {names || "Todo o escritório"}</p>
      {contract.trials.map((trial) => (
        <p key={trial.companyId}>
          Teste de {trial.companyName}:{" "}
          {trial.status === "active" ? "em andamento" : "encerrado"} (até{" "}
          {formatInstant(trial.endsAt)})
        </p>
      ))}
    </div>
  );
}

function Actions({ contract }: { contract: SheetContract }) {
  if (contract.availableActions.length === 0)
    return <p className="text-text-muted text-xs">{NO_ACTION_MESSAGE}</p>;
  return (
    <div className="flex flex-wrap gap-3">
      {contract.availableActions.map((action) => (
        <div key={action}>{ACTION_VIEW[action](contract.id)}</div>
      ))}
    </div>
  );
}

function ContractCard({ contract }: { contract: SheetContract }) {
  return (
    <article
      aria-label={contract.offerName}
      className="glass-panel flex flex-col gap-4 rounded-2xl p-5"
    >
      <header className="flex flex-col gap-1">
        <h3 className="text-text text-lg font-extrabold">{contract.offerName}</h3>
        <p className="text-text-muted text-xs">
          {contract.customerLegalName} · {PERIOD_LABEL[contract.billingPeriod]} · desde{" "}
          {formatCivilDate(contract.termStart)}
        </p>
      </header>
      <ItemList contract={contract} />
      <Scope contract={contract} />
      <div className="grid gap-4 md:grid-cols-2">
        <PaymentBlock financial={contract.financial} />
        <AccessBlock access={contract.access} />
      </div>
      <Actions contract={contract} />
    </article>
  );
}

export function SubscriptionSheetView({ sheet }: { sheet: SheetData }) {
  return (
    <div className="flex flex-col gap-5">
      <p role="note" className="glass-card rounded-[16px] p-4 text-sm font-semibold">
        {PORTAL_NOTICE}
      </p>
      {sheet.contracts.length === 0 ? (
        <p role="status" className="text-text-muted text-sm">
          {EMPTY_MESSAGE}
        </p>
      ) : (
        sheet.contracts.map((contract) => (
          <ContractCard key={contract.id} contract={contract} />
        ))
      )}
    </div>
  );
}
