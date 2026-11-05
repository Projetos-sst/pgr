import Link from "next/link";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import {
  NTEP_LISTA_C_SOURCE,
  NTEP_NOTICE,
  type NtepLookup,
} from "@/shared/domains/medicine/ntep/lista-c";
import { listCompanyOptionsAction } from "@/shared/server/actions/pgr/companies";
import {
  getCompanyNtepAction,
  lookupNtepAction,
} from "@/shared/server/actions/medicine/ntep";

import { PageHeader } from "../../_ui/list";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ cid?: string; cnae?: string; company?: string }>;

const inputClass =
  "glass-input text-text rounded-field h-11 w-full px-3.5 text-[13px] outline-none";

function Alert({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="alert"
      className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900"
    >
      {children}
    </p>
  );
}

function LookupResult({ result }: { result: NtepLookup }) {
  if (result.kind === "invalid") return <Alert>{result.message}</Alert>;
  if (result.kind === "unavailable" || result.kind === "unvalidated")
    return <Alert>{result.message}</Alert>;
  if (result.kind === "version_not_available")
    return (
      <Alert>
        {result.message} Versão disponível: {result.available}.
      </Alert>
    );
  const subject = [
    result.cid ? `CID-10 ${result.cid}` : null,
    result.cnaeClass ? `classe CNAE ${result.cnaeClass}` : null,
  ]
    .filter(Boolean)
    .join(" e ");
  if (result.kind === "no_match")
    return (
      <p role="status" className="glass-card rounded-[20px] p-5 text-sm">
        <strong>Sem correspondência na Lista C</strong> para {subject}. Isso não afasta
        nexo por outros meios; a avaliação é do médico.
      </p>
    );
  return (
    <section role="status" className="glass-card flex flex-col gap-3 rounded-[20px] p-5">
      <p className="text-sm">
        <strong>Correspondência encontrada na Lista C</strong> para {subject}:
      </p>
      <ul className="flex flex-col gap-2 text-sm">
        {result.matches.map((m) => (
          <li key={m.interval}>
            <span className="font-mono font-semibold">{m.interval}</span>
            {result.cnaeClass ? (
              <span> · classe {m.cnaeClasses.join(", ")}</span>
            ) : (
              <span className="text-text-muted block font-mono text-xs break-words">
                Classes CNAE ({m.cnaeClasses.length}): {m.cnaeClasses.join(" ")}
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Lista C do Anexo II do Decreto 3.048/1999 (NTEP) — consulta informativa por CID-10 e classe
 * CNAE (NOB-113, MED-16). Catálogo global; nenhum dado de trabalhador entra ou sai daqui.
 */
export default async function NtepPage({ searchParams }: { searchParams: SearchParams }) {
  await requireOfficeStaffPage();
  const sp = await searchParams;
  const companies = await listCompanyOptionsAction("medicine");
  const company = sp.company ? await getCompanyNtepAction(sp.company) : null;
  const lookup =
    !sp.company && (sp.cid || sp.cnae)
      ? await lookupNtepAction({ cid: sp.cid, cnae: sp.cnae })
      : null;

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader
        backHref="/medicine"
        title="Lista C — NTEP"
        description="Consulta à Lista C do Anexo II do Decreto 3.048/1999: intervalos de CID-10 × classes CNAE (4 dígitos) com Nexo Técnico Epidemiológico Previdenciário."
      />
      <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        {NTEP_NOTICE} Não indica doença ocupacional, incapacidade, aptidão nem necessidade
        de CAT.
      </p>

      <form
        method="get"
        className="glass-card grid gap-4 rounded-[20px] p-5 md:grid-cols-3"
      >
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold">CID-10</span>
          <input
            name="cid"
            defaultValue={sp.cid ?? ""}
            placeholder="ex.: M54.5"
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold">Classe CNAE</span>
          <input
            name="cnae"
            defaultValue={sp.cnae ?? ""}
            placeholder="ex.: 4120 ou 4120-4/00"
            className={inputClass}
          />
        </label>
        <div className="flex items-end">
          <button
            type="submit"
            className="btn-primary rounded-pill h-11 px-6 text-sm font-semibold"
          >
            Consultar
          </button>
        </div>
      </form>

      <form
        method="get"
        className="glass-card flex flex-col gap-3 rounded-[20px] p-5 md:flex-row md:items-end"
      >
        <label className="flex flex-1 flex-col gap-1 text-sm">
          <span className="font-semibold">
            Ou pela classe CNAE cadastrada da empresa (Medicina habilitada)
          </span>
          <select name="company" defaultValue={sp.company ?? ""} className={inputClass}>
            <option value="">— selecione —</option>
            {(companies.ok ? companies.data : []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.razaoSocial}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="btn-primary rounded-pill h-11 px-6 text-sm font-semibold"
        >
          Consultar empresa
        </button>
      </form>
      {!companies.ok ? <Alert>Não foi possível carregar as empresas.</Alert> : null}

      {lookup ? (
        lookup.ok ? (
          <LookupResult result={lookup.data} />
        ) : (
          <Alert>{lookup.error.message}</Alert>
        )
      ) : null}

      {company ? (
        !company.ok ? (
          <Alert>{company.error.message}</Alert>
        ) : company.data.status === "missing_cnae" ? (
          <Alert>
            {company.data.company.razaoSocial} não tem CNAE cadastrado: não é possível
            consultar a Lista C.{" "}
            <Link
              href={`/companies/${company.data.company.id}/edit`}
              className="font-semibold underline"
            >
              Completar cadastro
            </Link>
          </Alert>
        ) : company.data.status === "invalid_cnae" ? (
          <Alert>
            O CNAE cadastrado de {company.data.company.razaoSocial} (
            {company.data.company.cnae}) não permite identificar a classe de 4 dígitos.
          </Alert>
        ) : company.data.result ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm">
              {company.data.company.razaoSocial} · CNAE cadastrado{" "}
              {company.data.company.cnae} → classe {company.data.cnaeClass}
            </p>
            <LookupResult result={company.data.result} />
          </div>
        ) : null
      ) : null}

      <section className="text-text-muted flex flex-col gap-1 text-xs">
        {NTEP_LISTA_C_SOURCE ? (
          <>
            <p>
              Fonte: {NTEP_LISTA_C_SOURCE.source} · {NTEP_LISTA_C_SOURCE.includedBy}.
            </p>
            <p>Versão: {NTEP_LISTA_C_SOURCE.version}.</p>
            <p>
              Texto oficial:{" "}
              <a
                href={NTEP_LISTA_C_SOURCE.url}
                className="underline"
                rel="noreferrer"
                target="_blank"
              >
                Câmara dos Deputados
              </a>{" "}
              (conferido com o Planalto) · extraído em {NTEP_LISTA_C_SOURCE.extractedOn} ·{" "}
              {NTEP_LISTA_C_SOURCE.counts.intervals} intervalos,{" "}
              {NTEP_LISTA_C_SOURCE.counts.relations} relações · SHA-256 da fonte{" "}
              {NTEP_LISTA_C_SOURCE.sha256.slice(0, 12)}…
            </p>
          </>
        ) : (
          <p>Catálogo da Lista C não validado: consultas suspensas.</p>
        )}
        <p>
          O CID-10 é conferido só no formato; a classe CNAE, só nos 4 dígitos (sem
          conferir o dígito verificador).
        </p>
      </section>
    </div>
  );
}
