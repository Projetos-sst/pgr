import {
  findCatalogEntry,
  matchAgainstCatalog,
  toTrainingDraft,
  trainingDraftErrors,
  parseModelTrainings,
  sameTrainingName,
  type CatalogEntry,
} from "@/shared/domains/pgr/ai-training-suggestion";

const treino = (over: Record<string, unknown> = {}) => ({
  name: "NR-35 — Trabalho em Altura",
  referenceNorm: "NR-35",
  periodicity: "annual",
  workloadHours: 8,
  ...over,
});

describe("parseModelTrainings", () => {
  it("aceita envelope { trainings } e array cru", () => {
    expect(parseModelTrainings({ trainings: [treino()] })).toHaveLength(1);
    expect(parseModelTrainings([treino()])).toHaveLength(1);
  });

  it.each([
    ["anual", "annual"],
    ["Bienal", "biennial"],
    ["trienal", "triennial"],
    ["quinquenal", "quinquennial"],
    ["única", "single"],
  ])("traduz a periodicidade %s para %s", (input, expected) => {
    const [t] = parseModelTrainings([treino({ periodicity: input })]);
    expect(t.periodicity).toBe(expected);
  });

  it("coage carga horária vinda como texto", () => {
    expect(parseModelTrainings([treino({ workloadHours: "40" })])[0].workloadHours).toBe(
      40,
    );
  });

  /** Carga absurda denuncia alucinação; melhor perder o item do que cadastrar lixo. */
  it.each([0, -8, 5000])("descarta carga horária implausível (%s)", (h) => {
    expect(parseModelTrainings([treino({ workloadHours: h })])).toEqual([]);
  });

  it("descarta item inválido sem derrubar o lote", () => {
    const out = parseModelTrainings([{ name: "sem periodicidade" }, treino()]);
    expect(out).toHaveLength(1);
  });

  it("remove nome repetido, mesmo com grafia diferente", () => {
    const out = parseModelTrainings([
      treino({ name: "NR-35 — Trabalho em Altura" }),
      treino({ name: "nr 35 trabalho em altura" }),
    ]);
    expect(out).toHaveLength(1);
  });
});

/**
 * O modelo prefixa "NR-35 — " no que o catálogo guarda como "Trabalho em Altura".
 * Sem reconciliar, aceitar a sugestão criaria um curso duplicado ao lado do existente.
 */
describe("sameTrainingName", () => {
  it.each([
    ["Trabalho em Altura", "NR-35 — Trabalho em Altura"],
    ["Segurança em Instalações Elétricas", "NR-10 — Segurança em Instalações Elétricas"],
    ["Espaço Confinado", "NR-33 — Segurança em Espaços Confinados"],
    ["Uso e Conservação de EPI", "NR-06 — Uso e Conservação de EPI"],
  ])("reconhece %s e %s como o mesmo curso", (a, b) => {
    expect(sameTrainingName(a, b)).toBe(true);
  });

  it.each([
    ["Trabalho em Altura", "NR-18 — Trabalho em Canteiro de Obra"],
    ["Segurança em Instalações Elétricas", "Segurança na Construção Civil"],
  ])("não confunde %s com %s", (a, b) => {
    expect(sameTrainingName(a, b)).toBe(false);
  });

  /** Um token em comum casaria cursos distintos — vínculo errado é pior que duplicata. */
  it("exige ao menos dois tokens em comum", () => {
    expect(sameTrainingName("Altura", "NR-35 — Trabalho em Altura")).toBe(false);
  });
});

describe("matchAgainstCatalog", () => {
  const catalog: CatalogEntry[] = [
    { id: "cat-1", name: "Trabalho em Altura", periodicity: "annual" },
  ];

  it("liga ao catálogo e adota o nome de lá", () => {
    const [m] = matchAgainstCatalog(parseModelTrainings([treino()]), catalog, []);
    expect(m.trainingId).toBe("cat-1");
    expect(m.name).toBe("Trabalho em Altura");
  });

  it("marca como criar o que não está no catálogo", () => {
    const [m] = matchAgainstCatalog(
      parseModelTrainings([treino({ name: "NR-10 — Instalações Elétricas" })]),
      catalog,
      [],
    );
    expect(m.trainingId).toBeNull();
  });

  it("sinaliza o que já é obrigatório para a função", () => {
    const [m] = matchAgainstCatalog(parseModelTrainings([treino()]), catalog, ["cat-1"]);
    expect(m.alreadyRequired).toBe(true);
  });
});

describe("rascunho editável de treinamento", () => {
  it("vira campos de texto, com norma vazia quando a IA não informou", () => {
    expect(
      toTrainingDraft({
        name: "Brigada de Incêndio",
        periodicity: "annual",
        workloadHours: 8,
      }),
    ).toEqual({
      name: "Brigada de Incêndio",
      referenceNorm: "",
      periodicity: "annual",
      workloadHours: "8",
    });
  });

  it("cobra nome, periodicidade e carga horária plausível", () => {
    const errors = trainingDraftErrors({
      name: " ",
      referenceNorm: "",
      periodicity: "",
      workloadHours: "0",
    });
    expect(Object.keys(errors).sort()).toEqual(["name", "periodicity", "workloadHours"]);
    expect(
      trainingDraftErrors({
        name: "NR-35",
        referenceNorm: "",
        periodicity: "biennial",
        workloadHours: "8",
      }),
    ).toEqual({});
  });

  it("recusa carga horária quebrada ou acima de 200h", () => {
    const base = { name: "NR-35", referenceNorm: "", periodicity: "annual" };
    expect(
      trainingDraftErrors({ ...base, workloadHours: "7.5" }).workloadHours,
    ).toBeDefined();
    expect(
      trainingDraftErrors({ ...base, workloadHours: "201" }).workloadHours,
    ).toBeDefined();
  });
});

describe("findCatalogEntry — reaproveita o curso no aceite", () => {
  const catalog: CatalogEntry[] = [
    { id: "t1", name: "Trabalho em Altura", periodicity: "biennial" },
    { id: "t2", name: "Brigada", periodicity: "annual" },
  ];

  it("acha o curso de mesmo nome, sem diferenciar maiúsculas nem espaços", () => {
    expect(findCatalogEntry(" brigada ", catalog)?.id).toBe("t2");
  });

  it("respeita o nome editado na revisão: nome só parecido vira curso novo", () => {
    expect(findCatalogEntry("Trabalho em Altura revisado", catalog)).toBeUndefined();
    expect(findCatalogEntry("Espaço Confinado", catalog)).toBeUndefined();
  });
});
