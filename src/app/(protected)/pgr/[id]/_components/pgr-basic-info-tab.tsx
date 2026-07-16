import Link from "next/link";

import { pgrRegistrationTypeLabel, type Pgr } from "@/shared/domains/pgr/pgr";
import type { PgrSignatureView } from "@/shared/domains/pgr/pgr-signature";

import { PgrSignaturePanel } from "./pgr-signature-panel";

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex flex-col">
      <span className="text-text-subtle text-xs tracking-wide uppercase">{label}</span>
      <span className="text-sm">{value && value !== "" ? value : "—"}</span>
    </div>
  );
}

const brDate = (d: string | null) => (d ? d.split("-").reverse().join("/") : "—");

/**
 * Aba Informações básicas: exibe os campos reais de `pgr` e **reaproveita** a edição
 * existente (`/pgr/[id]/edit`) — sem duplicar o CRUD do documento.
 */
export function PgrBasicInfoTab({
  pgrId,
  pgr,
  companyName,
  workUnitName,
  signature,
}: {
  pgrId: string;
  pgr: Pgr;
  companyName: string;
  workUnitName: string | null;
  signature?: PgrSignatureView;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Link
          href={`/pgr/${pgrId}/edit`}
          className="glass-panel text-text-muted rounded-card hover:text-text px-4 py-2 text-sm font-semibold transition-colors"
        >
          Editar informações básicas
        </Link>
      </div>
      <div className="glass-card grid gap-4 p-4 sm:grid-cols-3">
        <Field label="Empresa" value={companyName} />
        <Field label="Obra/Contrato" value={workUnitName} />
        <Field label="Responsável pela elaboração" value={pgr.responsible} />
        <Field
          label="Tipo de registro"
          value={pgrRegistrationTypeLabel(pgr.registrationType)}
        />
        <Field label="Nº do registro" value={pgr.registrationNumber} />
        <Field label="Data de emissão" value={brDate(pgr.issuedAt)} />
        <Field label="Data de validade" value={brDate(pgr.validUntil)} />
      </div>

      <PgrSignaturePanel pgrId={pgrId} signature={signature} />
    </section>
  );
}
