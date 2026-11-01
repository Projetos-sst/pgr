import Link from "next/link";
import { notFound } from "next/navigation";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { getCompanyAction } from "@/shared/server/actions/pgr/companies";
import { listMedicosAction } from "@/shared/server/actions/pgr/medicos";
import { listPcmsoCoordinatorsAction } from "@/shared/server/actions/medicine/pcmso-coordinators";
import {
  formatProfessionalRegistration,
  MEDICAL_AFFILIATION_LABELS,
} from "@/shared/domains/pgr/medicos";

import { PageHeader } from "../../../_ui/list";
import { CloseCoordinatorForm, DesignateCoordinatorForm } from "./coordinator-forms";

export const dynamic = "force-dynamic";

const registration = (row: { medicoCrm: string; medicoRegistrationUf: string | null }) =>
  formatProfessionalRegistration({
    crm: row.medicoCrm,
    registrationUf: row.medicoRegistrationUf,
    profession: "physician",
  });

export default async function PcmsoCoordinatorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requireOfficeStaffPage();
  const { id } = await params;
  const company = await getCompanyAction(id);
  if (!company.ok) notFound();
  const history = await listPcmsoCoordinatorsAction(id);
  if (!history.ok)
    return (
      <div className="flex flex-col gap-3 p-6">
        <p role="alert">{history.error.message}</p>
        <Link href={`/companies/${id}/services`} className="text-primary underline">
          Consultar serviços da empresa
        </Link>
      </div>
    );
  const canManage = ctx.role === "owner";
  const open = history.data.find((row) => row.endsOn === null) ?? null;
  const medicos = canManage
    ? await listMedicosAction({ status: "active", pageSize: 200 })
    : null;
  const options =
    medicos && medicos.ok
      ? medicos.data.rows
          .filter((m) => m.profession === "physician")
          .map((m) => ({
            id: m.id,
            label: `${m.name} — ${formatProfessionalRegistration(m)}${
              m.rqe ? ` · RQE ${m.rqe}` : " · sem RQE"
            }`,
            hasRqe: Boolean(m.rqe),
            hasUf: Boolean(m.registrationUf),
          }))
      : [];

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader
        title={`Coordenador do PCMSO — ${company.data.razaoSocial}`}
        backHref={`/companies/${id}/edit`}
        description="Médico responsável pelo PCMSO da empresa (NR-7, item 7.4.1, alínea c), com histórico de designações."
      />

      <section className="glass-card flex flex-col gap-2 rounded-xl p-5">
        <h2 className="text-text text-base font-semibold">Designação vigente</h2>
        {open ? (
          <>
            <p className="text-text">
              <strong>{open.medicoName}</strong> · {registration(open)}
              {open.medicoRqe ? ` · RQE ${open.medicoRqe}` : ""} ·{" "}
              {MEDICAL_AFFILIATION_LABELS[open.medicoAffiliation]}
            </p>
            <p className="text-text-subtle text-sm">Desde {open.startsOn}</p>
            {open.rqeExceptionReason ? (
              <p
                role="note"
                className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900"
              >
                Designado sem RQE pela exceção do item 7.5.2 da NR-7:{" "}
                {open.rqeExceptionReason}
              </p>
            ) : null}
          </>
        ) : (
          <p role="status" className="text-text-subtle">
            Nenhum coordenador designado. O PCMSO desta empresa não pode ser emitido sem o
            médico responsável.
          </p>
        )}
      </section>

      {canManage ? (
        <section className="glass-card flex flex-col gap-4 rounded-xl p-5">
          <h2 className="text-text text-base font-semibold">
            {open ? "Trocar coordenador" : "Designar coordenador"}
          </h2>
          {open ? (
            <p className="text-text-subtle text-sm">
              A designação atual será encerrada na véspera do início da nova. O histórico
              é preservado.
            </p>
          ) : null}
          <DesignateCoordinatorForm companyId={id} options={options} />
          {open ? (
            <CloseCoordinatorForm
              companyId={id}
              assignmentId={open.id}
              startsOn={open.startsOn}
            />
          ) : null}
        </section>
      ) : (
        <p className="text-text-subtle text-sm">
          Somente o responsável pelo escritório pode designar ou encerrar o coordenador.
        </p>
      )}

      <section className="glass-card flex flex-col gap-3 rounded-xl p-5">
        <h2 className="text-text text-base font-semibold">Histórico</h2>
        {history.data.length === 0 ? (
          <p className="text-text-subtle text-sm">Sem designações registradas.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-text-subtle">
                <th className="py-2">Médico</th>
                <th>Registro</th>
                <th>Início</th>
                <th>Fim</th>
                <th>Motivo do encerramento</th>
              </tr>
            </thead>
            <tbody>
              {history.data.map((row) => (
                <tr key={row.id} className="border-t border-white/40">
                  <td className="py-2 font-semibold">{row.medicoName}</td>
                  <td className="font-mono">{registration(row)}</td>
                  <td>{row.startsOn}</td>
                  <td>{row.endsOn ?? "vigente"}</td>
                  <td>{row.endReason ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
