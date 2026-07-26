import Link from "next/link";

import { pgrRegistrationTypeLabel, type Pgr } from "@/shared/domains/pgr/pgr";

function Field({
  label,
  value,
  isMono,
}: {
  label: string;
  value: string | null | undefined;
  isMono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 p-1">
      <span className="text-text-subtle font-mono text-[10px] font-bold tracking-wider uppercase">
        {label}
      </span>
      <span
        className={`text-text text-sm font-semibold ${isMono ? "font-mono text-xs" : ""}`}
      >
        {value && value !== "" ? value : "—"}
      </span>
    </div>
  );
}

const brDate = (d: string | null) => (d ? d.split("-").reverse().join("/") : "—");

/**
 * Aba Informações básicas: exibe os campos cadastrais reais do `pgr`.
 */
export function PgrBasicInfoTab({
  pgrId,
  pgr,
  companyName,
  workUnitName,
  readOnly = false,
}: {
  pgrId: string;
  pgr: Pgr;
  companyName: string;
  workUnitName: string | null;
  readOnly?: boolean;
}) {
  return (
    <section className="flex flex-col gap-6">
      <div className="glass-card flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-text text-base font-bold sm:text-lg">
            Identificação do Documento
          </h2>
          <p className="text-text-subtle mt-0.5 text-xs">
            Dados cadastrais e responsável técnico pela elaboração do PGR
          </p>
        </div>
        {!readOnly ? (
          <Link
            href={`/pgr/${pgrId}/edit`}
            className="glass-panel text-text-muted hover:text-text flex items-center justify-center gap-2 rounded-[12px] px-4 py-2 text-xs font-bold transition-all sm:text-sm"
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            Editar informações
          </Link>
        ) : null}
      </div>

      <div className="glass-card grid gap-6 p-6 sm:grid-cols-3">
        <Field label="Empresa" value={companyName} />
        <Field label="Obra / Contrato" value={workUnitName ?? "Sem obra específica"} />
        <Field label="Responsável Técnico" value={pgr.responsible} />
        <Field
          label="Tipo de registro"
          value={pgrRegistrationTypeLabel(pgr.registrationType)}
        />
        <Field label="Nº do registro" value={pgr.registrationNumber} isMono />
        <Field label="Data de emissão" value={brDate(pgr.issuedAt)} isMono />
        <Field label="Data de validade" value={brDate(pgr.validUntil)} isMono />
      </div>
    </section>
  );
}
