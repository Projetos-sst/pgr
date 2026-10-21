"use client";
import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  createBasicOfferAction,
  publishBasicOfferAction,
} from "@/shared/server/actions/pgr/basic-offers";
import {
  TextField,
  TextAreaField,
  SelectField,
  SubmitButton,
  FormError,
} from "../_ui/form";
import { basicOfferPriceSchema } from "@/shared/domains/pgr/basic-offer";
import type { BasicOfferInput } from "@/shared/domains/pgr/basic-offer";
export function BasicOfferForm({ initial }: { initial?: BasicOfferInput }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState(initial?.billingPeriod ?? "");
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const t = (key: string) => String(fd.get(key) ?? "");
    const number = (key: string) => (t(key).trim() === "" ? null : Number(t(key)));
    const price = t("price").trim();
    setError(null);
    const parsedPrice = price ? basicOfferPriceSchema.safeParse(price) : null;
    if (parsedPrice && !parsedPrice.success) {
      setError(parsedPrice.error.issues[0].message);
      return;
    }
    start(async () => {
      const r = await createBasicOfferAction({
        name: t("name"),
        eligibility: t("eligibility"),
        technicalScope: t("technicalScope"),
        servicesIncluded: t("servicesIncluded"),
        limitations: t("limitations"),
        priceCents: parsedPrice?.success ? parsedPrice.data : null,
        currency: "BRL",
        billingPeriod: period || null,
        maxEmployees: number("maxEmployees"),
        maxWorkUnits: number("maxWorkUnits"),
        maxRevisions: number("maxRevisions"),
        reason: t("reason"),
      });
      if (!r.ok)
        setError(
          r.error.fields ? Object.values(r.error.fields).join(" · ") : r.error.message,
        );
      else router.refresh();
    });
  }
  return (
    <form
      onSubmit={submit}
      className="glass-card grid gap-4 rounded-xl p-5 sm:grid-cols-2"
    >
      <h2 className="font-semibold sm:col-span-2">Salvar nova versão em rascunho</h2>
      <FormError message={error} />
      <TextField
        name="name"
        label="Nome da oferta"
        defaultValue={initial?.name ?? "PGR básico"}
        required
      />
      <TextField
        name="price"
        label="Preço em reais (deixe vazio se ainda não definido)"
        defaultValue={
          initial?.priceCents != null
            ? (initial.priceCents / 100).toFixed(2).replace(".", ",")
            : ""
        }
      />
      <SelectField
        name="period"
        label="Periodicidade"
        value={period}
        onChange={setPeriod}
        options={[
          { value: "one_time", label: "Pagamento único" },
          { value: "monthly", label: "Mensal" },
          { value: "annual", label: "Anual" },
        ]}
        emptyLabel="Ainda não definida"
      />
      <TextField
        name="maxEmployees"
        type="number"
        label="Limite comercial de funcionários, se definido"
        defaultValue={initial?.maxEmployees?.toString()}
      />
      <TextField
        name="maxWorkUnits"
        type="number"
        label="Limite comercial de obras/unidades, se definido"
        defaultValue={initial?.maxWorkUnits?.toString()}
      />
      <TextField
        name="maxRevisions"
        type="number"
        label="Revisões incluídas, se definido"
        defaultValue={initial?.maxRevisions?.toString()}
      />
      <TextAreaField
        name="eligibility"
        label="Público elegível e critérios de verificação"
        defaultValue={initial?.eligibility}
      />
      <TextAreaField
        name="technicalScope"
        label="Escopo técnico e referência ao modelo adotado"
        defaultValue={initial?.technicalScope}
      />
      <TextAreaField
        name="servicesIncluded"
        label="Serviços incluídos (coleta, visitas, elaboração, revisão, assinatura, suporte)"
        defaultValue={initial?.servicesIncluded}
      />
      <TextAreaField
        name="limitations"
        label="Limites, exclusões e tratamento de excedentes"
        defaultValue={initial?.limitations}
      />
      <TextField name="reason" label="Motivo desta versão" required />
      <p className="text-sm sm:col-span-2">
        Limites comerciais não dispensam levantamento, revisão técnica ou requisitos do
        documento. Salvar não publica, contrata, habilita módulos ou gera cobrança.
      </p>
      <SubmitButton pending={pending} label="Salvar rascunho versionado" />
    </form>
  );
}
export function OfferPublicationForm({
  id,
  activeVersionId,
  isActive,
}: {
  id: string;
  activeVersionId: string | null;
  isActive: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const reason = String(fd.get("reason") ?? "");
    start(async () => {
      const r = await publishBasicOfferAction(
        id,
        isActive
          ? { active: false, expectedActiveVersionId: activeVersionId, reason }
          : {
              active: true,
              expectedActiveVersionId: activeVersionId,
              reason,
              commercialApprovalReference: String(fd.get("commercial") ?? ""),
              technicalApprovalReference: String(fd.get("technical") ?? ""),
            },
      );
      if (!r.ok)
        setError(
          r.error.fields ? Object.values(r.error.fields).join(" · ") : r.error.message,
        );
      else router.refresh();
    });
  }
  return (
    <form onSubmit={submit} className="mt-4 flex flex-col gap-3">
      <FormError message={error} />
      {!isActive && (
        <>
          <TextField
            name="commercial"
            label="Referência da aprovação comercial desta versão"
            required
          />
          <TextField
            name="technical"
            label="Referência da aprovação técnica do escopo desta versão"
            required
          />
        </>
      )}
      <TextField name="reason" label="Motivo da publicação ou retirada" required />
      <SubmitButton
        pending={pending}
        label={isActive ? "Retirar publicação" : "Publicar versão aprovada no catálogo"}
      />
    </form>
  );
}
