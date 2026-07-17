"use client";

import { useState } from "react";

type Field = { label: string; value: string };
type TabKey = "dados" | "causas" | "fotos";

const TABS: { key: TabKey; label: string }[] = [
  { key: "dados", label: "Dados" },
  { key: "causas", label: "Causas e investigação" },
  { key: "fotos", label: "Fotos" },
];

function FieldGrid({ fields }: { fields: Field[] }) {
  if (fields.length === 0) {
    return <p className="text-text-subtle text-sm">Nenhuma informação registrada.</p>;
  }
  return (
    <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
      {fields.map((f) => (
        <div key={f.label} className="flex flex-col gap-1">
          <span className="text-text-subtle text-xs font-semibold tracking-wide uppercase">
            {f.label}
          </span>
          <span className="text-text whitespace-pre-wrap">{f.value}</span>
        </div>
      ))}
    </div>
  );
}

export function IncidentDetailTabs({
  dados,
  causas,
}: {
  dados: Field[];
  causas: Field[];
}) {
  const [active, setActive] = useState<TabKey>("dados");

  return (
    <div className="flex flex-col gap-4">
      <nav className="flex flex-wrap gap-2 text-sm">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActive(t.key)}
            className={`glass-panel rounded-card px-3 py-1 font-semibold transition-colors ${
              active === t.key ? "text-primary-strong" : "text-text-muted hover:text-text"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className="glass-card p-5">
        {active === "dados" ? <FieldGrid fields={dados} /> : null}
        {active === "causas" ? <FieldGrid fields={causas} /> : null}
        {active === "fotos" ? (
          <div className="text-text-subtle flex flex-col items-center gap-2 py-8 text-center text-sm">
            <span aria-hidden className="text-2xl">
              🖼️
            </span>
            <p>
              O envio de fotos ainda não está disponível nesta versão. O upload será
              liberado após a implantação da infraestrutura de documentos/storage.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
