"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type ChangeEvent,
  type FormEvent,
} from "react";

import { listCategoriesAction } from "@/shared/server/actions/pgr/categories";
import {
  createEpiCatalogAction,
  updateEpiCatalogAction,
  uploadEpiCatalogPhotoAction,
  getEpiCatalogPhotoUrlAction,
} from "@/shared/server/actions/pgr/epi-catalog";
import type { EpiCatalog, EpiCatalogInput } from "@/shared/domains/pgr/epi-catalog";
import { CaField } from "@/shared/integrations/caepi/client/ca-field";
import type { CaFound } from "@/shared/integrations/caepi/client/use-caepi-validation";

import {
  CancelLink,
  FieldError,
  FormActions,
  FormError,
  FormSection,
  SelectField,
  SubmitButton,
  TextField,
} from "../../_ui/form";

const TYPE_OPTIONS = [
  { value: "epi", label: "EPI" },
  { value: "machine", label: "Máquinas e Equipamentos" },
];

const TYPE_LABELS: Record<string, string> = {
  epi: "EPI",
  machine: "máquina/equipamento",
};

type CategoryOption = { value: string; label: string };
type CategoriesStatus = "idle" | "loading" | "loaded" | "error";

export function EpiCatalogForm({ item }: { item?: EpiCatalog }) {
  const router = useRouter();
  const [type, setType] = useState<string>(item?.type ?? "");
  const [categoryId, setCategoryId] = useState<string>(item?.categoryId ?? "");
  // Controlados por causa do autofill do CAEPI (US1/012): `onFound` escreve
  // fabricante/norma/validade no estado; os quatro campos seguem editáveis.
  const [ca, setCa] = useState<string>(item?.ca ?? "");
  const [caValidUntil, setCaValidUntil] = useState<string>(item?.caValidUntil ?? "");
  const [manufacturer, setManufacturer] = useState<string>(item?.manufacturer ?? "");
  const [norm, setNorm] = useState<string>(item?.norm ?? "");
  const [replacementDate, setReplacementDate] = useState<string>(
    item?.replacementDate ?? "",
  );
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [categoriesStatus, setCategoriesStatus] = useState<CategoriesStatus>("idle");
  const [categoriesReloadToken, setCategoriesReloadToken] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Foto (issue #30): o arquivo só sobe ao Storage no submit final — até lá o
  // preview é local (object URL), sem round-trip nenhum ao servidor.
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPath, setPhotoPath] = useState<string>(item?.photoPath ?? "");
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);

  // Tipo → Categoria em cascata: carrega categorias do tipo selecionado (009).
  // Diferencia "carregando" / "erro ao carregar" / "sem categorias cadastradas"
  // (issue #21) — antes o campo ficava simplesmente `disabled` sem explicação.
  useEffect(() => {
    // Sem tipo selecionado ainda: nada a buscar — `categoriesStatus` fica no
    // valor anterior, mas o campo continua desabilitado (guarda também por
    // `type === ""` no `disabled` abaixo, não só por `categoriesStatus`).
    if (type !== "epi" && type !== "machine") return;
    let active = true;
    (async () => {
      setCategoriesStatus("loading");
      const result = await listCategoriesAction({ type, pageSize: 100 });
      if (!active) return;
      if (result.ok) {
        setCategories(
          result.data.rows.map((row) => ({ value: row.id, label: row.name })),
        );
        setCategoriesStatus("loaded");
      } else {
        setCategories([]);
        setCategoriesStatus("error");
      }
    })();
    return () => {
      active = false;
    };
  }, [type, categoriesReloadToken]);

  // Foto já salva (edição): bucket é privado, então o preview exige URL
  // assinada — buscada uma vez, na montagem, a partir do registro no servidor.
  useEffect(() => {
    if (!item?.id || !item.photoPath) return;
    let active = true;
    (async () => {
      const result = await getEpiCatalogPhotoUrlAction(item.id);
      if (!active) return;
      if (result.ok && result.data.url) setPhotoPreviewUrl(result.data.url);
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id]);

  // Revoga a object URL local ao trocar de foto ou desmontar (evita vazamento).
  useEffect(() => {
    return () => {
      if (photoPreviewUrl?.startsWith("blob:")) URL.revokeObjectURL(photoPreviewUrl);
    };
  }, [photoPreviewUrl]);

  function handleTypeChange(value: string) {
    setType(value);
    // Trocar o tipo invalida a categoria selecionada (coerência Tipo×Categoria).
    if (value !== item?.type) setCategoryId("");
    else setCategoryId(item?.categoryId ?? "");
  }

  function retryCategories() {
    setCategoriesReloadToken((n) => n + 1);
  }

  function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    event.target.value = ""; // permite reselecionar o mesmo arquivo depois
    if (!file) return;
    if (file.type !== "image/png" && file.type !== "image/jpeg") {
      setPhotoError("Formato não permitido (use PNG ou JPG).");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setPhotoError("Foto excede o tamanho máximo de 5 MB.");
      return;
    }
    setPhotoError(null);
    setPhotoFile(file);
    setPhotoPreviewUrl(URL.createObjectURL(file));
  }

  function clearPhoto() {
    setPhotoFile(null);
    setPhotoPath("");
    setPhotoPreviewUrl(null);
    setPhotoError(null);
  }

  // Última sugestão aplicada pelo CAEPI: permite descartá-la quando o CA muda
  // para um não encontrado, sem apagar o que o usuário digitou por conta própria.
  const lastCaAutofill = useRef<CaFound | null>(null);

  function handleCaFound(data: CaFound) {
    // Cópia por valor: o formulário é dono dos campos; o CAEPI só sugere.
    lastCaAutofill.current = data;
    setManufacturer(data.manufacturer);
    setNorm(data.norm);
    setCaValidUntil(data.validUntil);
  }

  function handleCaNotFound() {
    const previous = lastCaAutofill.current;
    if (!previous) return;
    lastCaAutofill.current = null;
    // Limpa apenas os campos que ainda carregam a sugestão anterior.
    setManufacturer((current) => (current === previous.manufacturer ? "" : current));
    setNorm((current) => (current === previous.norm ? "" : current));
    setCaValidUntil((current) => (current === previous.validUntil ? "" : current));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const value = (key: string) => String(fd.get(key) ?? "");

    startTransition(async () => {
      let finalPhotoPath = photoPath;
      if (photoFile) {
        const uploadFd = new FormData();
        uploadFd.set("file", photoFile);
        try {
          const uploaded = await uploadEpiCatalogPhotoAction(uploadFd);
          if (!uploaded.ok) {
            setPhotoError(uploaded.error.message);
            return;
          }
          finalPhotoPath = uploaded.data.path;
        } catch {
          // Corpo maior do que o proxy/Server Action aceitam (transporte, não
          // validação) — a Server Action lança em vez de devolver {ok:false}.
          setFormError(
            "Não foi possível enviar a foto — verifique o tamanho e tente novamente.",
          );
          return;
        }
      }

      const input: EpiCatalogInput = {
        type: type as EpiCatalogInput["type"],
        categoryId,
        name: value("name"),
        ca,
        caValidUntil,
        manufacturer,
        norm,
        material: value("material"),
        size: value("size"),
        unitOfMeasure: value("unitOfMeasure"),
        description: value("description"),
        photoPath: finalPhotoPath,
        replacementDate,
      };

      const result = item
        ? await updateEpiCatalogAction(item.id, input)
        : await createEpiCatalogAction(input);
      if (result.ok) {
        router.push("/epi-catalog");
        router.refresh();
        return;
      }
      setErrors(result.error.fields ?? {});
      setFormError(result.error.fields ? null : result.error.message);
    });
  }

  const categoryTypeLabel = TYPE_LABELS[type] ?? "";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <FormError message={formError} />

      {item?.createdBy ? (
        <p className="text-text-subtle text-xs">
          Cadastrado por: <span className="font-mono">{item.createdBy}</span>
        </p>
      ) : null}

      <FormSection title="Classificação">
        <SelectField
          label="Tipo"
          name="type"
          required
          value={type}
          onChange={handleTypeChange}
          options={TYPE_OPTIONS}
          error={errors.type}
        />
        <div>
          <SelectField
            label="Categoria"
            name="categoryId"
            required
            value={categoryId}
            onChange={setCategoryId}
            options={categories}
            error={errors.categoryId}
            disabled={
              type === "" || categoriesStatus !== "loaded" || categories.length === 0
            }
            emptyLabel={
              type === ""
                ? "— selecione o tipo primeiro —"
                : categoriesStatus === "loading"
                  ? "Carregando categorias…"
                  : "— selecione a categoria —"
            }
          />
          {type !== "" && categoriesStatus === "error" ? (
            <p className="text-danger mt-1.5 text-xs">
              Não foi possível carregar as categorias.{" "}
              <button
                type="button"
                onClick={retryCategories}
                className="font-semibold underline"
              >
                Tentar novamente
              </button>{" "}
              ou{" "}
              <Link
                href={`/categories/new?type=${type}`}
                className="text-primary font-semibold underline"
              >
                cadastrar uma categoria
              </Link>
              .
            </p>
          ) : null}
          {type !== "" && categoriesStatus === "loaded" && categories.length === 0 ? (
            <p className="text-text-muted mt-1.5 text-xs">
              Nenhuma categoria de {categoryTypeLabel} cadastrada.{" "}
              <Link
                href={`/categories/new?type=${type}`}
                className="text-primary font-semibold underline"
              >
                Cadastrar categoria
              </Link>
            </p>
          ) : null}
        </div>
      </FormSection>

      <FormSection title="Identificação & CA">
        <TextField
          label="Nome"
          name="name"
          required
          isFullWidth
          placeholder="Ex.: Capacete de segurança aba frontal"
          defaultValue={item?.name}
          error={errors.name}
        />
        <CaField
          label="CA"
          value={ca}
          onChange={setCa}
          onFound={handleCaFound}
          onNotFound={handleCaNotFound}
          error={errors.ca}
        />
        <TextField
          label="Validade do CA"
          name="caValidUntil"
          type="date"
          value={caValidUntil}
          onChange={setCaValidUntil}
          error={errors.caValidUntil}
        />
        <TextField
          label="Data de substituição"
          name="replacementDate"
          type="date"
          value={replacementDate}
          onChange={setReplacementDate}
          error={errors.replacementDate}
        />
        <TextField
          label="Fabricante"
          name="manufacturer"
          value={manufacturer}
          onChange={setManufacturer}
          error={errors.manufacturer}
        />
        <TextField
          label="Norma"
          name="norm"
          value={norm}
          onChange={setNorm}
          error={errors.norm}
        />
      </FormSection>

      <FormSection title="Especificações">
        <TextField
          label="Material"
          name="material"
          placeholder="Ex.: couro, PVC, policarbonato"
          defaultValue={item?.material}
          error={errors.material}
        />
        <TextField
          label="Tamanho"
          name="size"
          defaultValue={item?.size}
          error={errors.size}
        />
        <TextField
          label="Unidade de medida"
          name="unitOfMeasure"
          placeholder="Ex.: par, unidade"
          defaultValue={item?.unitOfMeasure}
          error={errors.unitOfMeasure}
        />
        <TextField
          label="Descrição"
          name="description"
          isFullWidth
          defaultValue={item?.description}
          error={errors.description}
        />
        <div className="block sm:col-span-full">
          <span className="text-text-muted mb-1.5 block text-xs font-semibold">Foto</span>
          {photoPreviewUrl ? (
            <div className="mb-2 flex items-center gap-3">
              <img
                src={photoPreviewUrl}
                alt="Pré-visualização da foto do item"
                className="glass-panel rounded-card h-24 w-24 object-contain p-2"
              />
              <button
                type="button"
                onClick={clearPhoto}
                className="text-text-subtle hover:text-danger text-xs font-semibold underline"
              >
                Remover foto
              </button>
            </div>
          ) : null}
          <input
            type="file"
            accept="image/png,image/jpeg"
            onChange={handlePhotoChange}
            className="glass-input text-text rounded-card file:rounded-card file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer px-3.5 py-2.5 text-sm outline-none file:mr-4 file:border-0 file:px-3 file:py-1 file:text-xs file:font-semibold"
          />
          <span className="text-text-subtle mt-1 block text-xs">
            PNG ou JPG — até 5 MB.
          </span>
          <FieldError message={photoError ?? errors.photoPath} />
        </div>
      </FormSection>

      <FieldError message={errors._} />
      <FormActions>
        <CancelLink href="/epi-catalog" />
        <SubmitButton
          pending={pending}
          label={item ? "Salvar alterações" : "Criar item"}
        />
      </FormActions>
    </form>
  );
}
