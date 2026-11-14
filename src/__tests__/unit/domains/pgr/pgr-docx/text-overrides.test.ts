import {
  DEFAULT_LABELS,
  DEFAULT_TEXTS,
  DEFAULT_TITLES,
  type RichBlock,
} from "@/shared/domains/pgr/pgr-docx/defaults";
import { plainTextToBlocks } from "@/shared/domains/pgr/pgr-docx/rich-text";
import {
  PGR_DOCX_EDITABLE_DEFAULTS,
  blocksToPlainText,
  canonicalPgrDocxTexts,
  changedOverrides,
  editableTextGroups,
  mergeOverrides,
  pgrDocxTextVersionSchema,
} from "@/shared/domains/pgr/pgr-docx/text-overrides";

describe("textos padrão editáveis do PGR", () => {
  it("expõe todo rótulo, título e texto padrão como texto simples editável", () => {
    expect(Object.keys(PGR_DOCX_EDITABLE_DEFAULTS.labels)).toEqual(
      Object.keys(DEFAULT_LABELS),
    );
    expect(Object.keys(PGR_DOCX_EDITABLE_DEFAULTS.titles)).toEqual(
      Object.keys(DEFAULT_TITLES),
    );
    expect(Object.keys(PGR_DOCX_EDITABLE_DEFAULTS.texts)).toEqual(
      Object.keys(DEFAULT_TEXTS),
    );
    expect(PGR_DOCX_EDITABLE_DEFAULTS.texts.introduction).toContain("{empresa}");
  });

  it("subtítulo volta como '## ' e cada bloco ocupa uma linha", () => {
    expect(
      blocksToPlainText([
        { kind: "subtitle", text: "Matriz" },
        { kind: "paragraph", text: "Primeiro parágrafo." },
        { kind: "item", text: "a) primeiro item;" },
      ]),
    ).toBe("## Matriz\nPrimeiro parágrafo.\na) primeiro item;");
  });

  it("texto padrão reescrito sem alteração gera o mesmo número de blocos", () => {
    const standard: Record<string, readonly RichBlock[]> = DEFAULT_TEXTS;
    const editable: Record<string, string> = PGR_DOCX_EDITABLE_DEFAULTS.texts;
    for (const key of Object.keys(standard)) {
      expect(plainTextToBlocks(editable[key]).map((block) => block.text)).toEqual(
        standard[key].map((block) => block.text),
      );
    }
  });

  it("só o que difere do padrão vira alteração; espaço nas pontas não conta", () => {
    const overrides = changedOverrides({
      labels: { ...PGR_DOCX_EDITABLE_DEFAULTS.labels, company: "Organização:" },
      titles: {
        ...PGR_DOCX_EDITABLE_DEFAULTS.titles,
        introduction: `  ${DEFAULT_TITLES.introduction}  `,
      },
      texts: {
        ...PGR_DOCX_EDITABLE_DEFAULTS.texts,
        objective: "Objetivo reescrito pelo responsável.",
      },
    });
    expect(overrides).toEqual({
      labels: { company: "Organização:" },
      texts: { objective: "Objetivo reescrito pelo responsável." },
    });
  });

  it("nada alterado resulta em alteração vazia", () => {
    expect(changedOverrides(PGR_DOCX_EDITABLE_DEFAULTS)).toEqual({});
  });

  it("alteração avulsa da prévia se sobrepõe à versão salva, seção a seção", () => {
    expect(
      mergeOverrides(
        { titles: { introduction: "1 - ABERTURA", objective: "2 - META" } },
        { titles: { objective: "2 - PROPÓSITO" }, labels: { company: "Cliente:" } },
      ),
    ).toEqual({
      titles: { introduction: "1 - ABERTURA", objective: "2 - PROPÓSITO" },
      labels: { company: "Cliente:" },
    });
    expect(mergeOverrides(null, undefined)).toEqual({});
  });

  it("forma canônica muda com qualquer texto alterado e é estável sem alteração", () => {
    const standard = canonicalPgrDocxTexts({});
    expect(canonicalPgrDocxTexts({ labels: {}, titles: {} })).toBe(standard);
    expect(canonicalPgrDocxTexts({ labels: { company: DEFAULT_LABELS.company } })).toBe(
      standard,
    );
    expect(canonicalPgrDocxTexts({ labels: { company: "Organização:" } })).not.toBe(
      standard,
    );
    expect(canonicalPgrDocxTexts({ texts: { objective: "Outro objetivo." } })).not.toBe(
      standard,
    );
    expect(
      canonicalPgrDocxTexts({
        campaigns: [{ month: "Janeiro", theme: "Tema", actions: "Ação" }],
      }),
    ).not.toBe(standard);
  });

  it("versão exige motivo e recusa chave de texto desconhecida", () => {
    expect(
      pgrDocxTextVersionSchema.safeParse({
        reason: "Ajuste pedido pelo responsável técnico",
        overrides: { titles: { introduction: "1 - ABERTURA" } },
      }).success,
    ).toBe(true);
    expect(
      pgrDocxTextVersionSchema.safeParse({ reason: " ", overrides: {} }).success,
    ).toBe(false);
    expect(
      pgrDocxTextVersionSchema.safeParse({
        reason: "Ajuste",
        overrides: { titles: { inexistente: "x" } },
      }).success,
    ).toBe(false);
    expect(
      pgrDocxTextVersionSchema.safeParse({ reason: "Ajuste", overrides: {}, extra: 1 })
        .success,
    ).toBe(false);
  });

  it("tela de edição recebe um campo por título, texto e rótulo, com padrão e valor atual", () => {
    const groups = editableTextGroups({
      titles: { introduction: "1 - ABERTURA" },
      texts: { objective: "Objetivo do responsável." },
    });
    expect(groups.map((group) => group.section)).toEqual(["titles", "texts", "labels"]);
    const [titles, texts, labels] = groups;
    expect(titles.fields).toHaveLength(Object.keys(DEFAULT_TITLES).length);
    expect(texts.fields).toHaveLength(Object.keys(DEFAULT_TEXTS).length);
    expect(labels.fields).toHaveLength(Object.keys(DEFAULT_LABELS).length);
    expect(titles.fields[0]).toEqual({
      name: "titles.introduction",
      label: DEFAULT_TITLES.introduction,
      standard: DEFAULT_TITLES.introduction,
      value: "1 - ABERTURA",
      changed: true,
    });
    const objective = texts.fields.find((field) => field.name === "texts.objective");
    expect(objective).toMatchObject({
      label: `Texto de ${DEFAULT_TITLES.objective}`,
      value: "Objetivo do responsável.",
      changed: true,
    });
    const company = labels.fields.find((field) => field.name === "labels.company");
    expect(company).toMatchObject({
      label: DEFAULT_LABELS.company,
      value: DEFAULT_LABELS.company,
      changed: false,
    });
  });
});
