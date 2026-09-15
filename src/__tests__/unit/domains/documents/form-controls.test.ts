import {
  buildFormControlPreview,
  formControlInputSchema,
  formControlStatusLabel,
  formControlStatusTone,
  formControlTypeLabel,
  formatIsoDateBr,
} from "@/shared/domains/documents/form-controls";

describe("formControlInputSchema (issue #88)", () => {
  const base = {
    formType: "PGR",
    frmCode: "FRM-001",
    revision: "00",
    issueDate: "2026-01-15",
    position: "top",
  };

  it("aceita entrada mínima válida (campos opcionais ausentes)", () => {
    const parsed = formControlInputSchema.parse(base);
    expect(parsed.formType).toBe("PGR");
    expect(parsed.frmCode).toBe("FRM-001");
    expect(parsed.revision).toBe("00");
    expect(parsed.issueDate).toBe("2026-01-15");
    expect(parsed.position).toBe("top");
    expect(parsed.companyId).toBeUndefined();
    expect(parsed.gesId).toBeUndefined();
    expect(parsed.nonConformityNumber).toBeUndefined();
    expect(parsed.notes).toBeUndefined();
  });

  it("aceita entrada completa com opcionais preenchidos", () => {
    const parsed = formControlInputSchema.parse({
      ...base,
      companyId: "11111111-1111-1111-1111-111111111111",
      gesId: "11111111-1111-1111-1111-1111111111a2",
      nonConformityNumber: "NC-01",
      position: "both",
      notes: "observação livre",
    });
    expect(parsed.companyId).toBe("11111111-1111-1111-1111-111111111111");
    expect(parsed.gesId).toBe("11111111-1111-1111-1111-1111111111a2");
    expect(parsed.position).toBe("both");
  });

  it.each(["formType", "frmCode", "revision", "issueDate", "position"])(
    "exige %s (obrigatório)",
    (field) => {
      const input = { ...base } as Record<string, unknown>;
      delete input[field];
      expect(() => formControlInputSchema.parse(input)).toThrow();
    },
  );

  it("rejeita formType vazio (após trim)", () => {
    expect(() => formControlInputSchema.parse({ ...base, formType: "   " })).toThrow();
  });

  it("rejeita posicionamento fora de top|bottom|both", () => {
    expect(() => formControlInputSchema.parse({ ...base, position: "middle" })).toThrow();
  });

  it("rejeita data em formato inválido", () => {
    expect(() =>
      formControlInputSchema.parse({ ...base, issueDate: "15/01/2026" }),
    ).toThrow();
  });

  it("trata companyId/gesId vazios como undefined (sem empresa/GES)", () => {
    const parsed = formControlInputSchema.parse({ ...base, companyId: "", gesId: "" });
    expect(parsed.companyId).toBeUndefined();
    expect(parsed.gesId).toBeUndefined();
  });

  // Regressão do bug de QA (issue #88): o form de criação/edição
  // (form-control-form.tsx) envia `null` — não só string vazia — para
  // companyId/gesId quando o <select> é limpo (`companyId: companyId ? companyId
  // : null`), e o schema rejeitava `null` com 422 (`optionalUuid` só tratava
  // string vazia → undefined, nunca aceitava `null`). Mesmo padrão de
  // `safety/service-order.ts` (`optionalUuid.nullable().optional()`).
  it("aceita companyId/gesId = null (form limpo) sem lançar", () => {
    const parsed = formControlInputSchema.parse({
      ...base,
      companyId: null,
      gesId: null,
    });
    expect(parsed.companyId).toBeNull();
    expect(parsed.gesId).toBeNull();
  });
});

describe("formatIsoDateBr", () => {
  it("converte AAAA-MM-DD para DD/MM/AAAA", () => {
    expect(formatIsoDateBr("2026-01-15")).toBe("15/01/2026");
  });

  it("devolve a entrada como está se não tiver o formato esperado", () => {
    expect(formatIsoDateBr("data-invalida")).toBe("data-invalida");
  });
});

describe("buildFormControlPreview (montagem do preview em tempo real)", () => {
  it("monta o preview com todos os campos preenchidos", () => {
    const preview = buildFormControlPreview({
      formType: "PGR",
      companyName: "Empresa A",
      frmCode: "FRM-001",
      revision: "00",
      issueDate: "2026-01-15",
      nonConformityNumber: "NC-01",
      gesName: "GES A",
      position: "both",
      notes: "obs",
    });
    expect(preview).toEqual({
      formType: "PGR",
      companyName: "Empresa A",
      frmCode: "FRM-001",
      revision: "00",
      issueDateDisplay: "15/01/2026",
      nonConformityNumber: "NC-01",
      gesName: "GES A",
      positionLabel: "Topo e rodapé",
      notes: "obs",
    });
  });

  it("usa placeholders para campos ainda não preenchidos (form vazio)", () => {
    const preview = buildFormControlPreview({});
    expect(preview.formType).toBe("—");
    expect(preview.frmCode).toBe("—");
    expect(preview.revision).toBe("—");
    expect(preview.issueDateDisplay).toBe("—");
    expect(preview.companyName).toBeNull();
    expect(preview.gesName).toBeNull();
    expect(preview.nonConformityNumber).toBeNull();
    expect(preview.notes).toBeNull();
    expect(preview.positionLabel).toBe("Topo");
  });
});

describe("form control — tipo e situação (redesign)", () => {
  it("rótulos de tipo e situação", () => {
    expect(formControlTypeLabel("ficha")).toBe("Ficha");
    expect(formControlTypeLabel("checklist")).toBe("Checklist");
    expect(formControlTypeLabel("documento")).toBe("Documento");
    expect(formControlStatusLabel("draft")).toBe("Rascunho");
    expect(formControlStatusLabel("published")).toBe("Publicado");
    expect(formControlStatusLabel("archived")).toBe("Arquivado");
  });

  it("tom da situação (published=green, draft=amber, archived=neutral)", () => {
    expect(formControlStatusTone("published")).toBe("green");
    expect(formControlStatusTone("draft")).toBe("amber");
    expect(formControlStatusTone("archived")).toBe("neutral");
  });

  it("schema aplica defaults type=documento / status=published", () => {
    const parsed = formControlInputSchema.parse({
      formType: "PGR",
      frmCode: "FRM-001",
      revision: "00",
      issueDate: "2026-01-15",
      position: "top",
    });
    expect(parsed.type).toBe("documento");
    expect(parsed.status).toBe("published");
  });

  it("schema rejeita tipo/situação fora do enum", () => {
    const bad = formControlInputSchema.safeParse({
      formType: "PGR",
      frmCode: "FRM-001",
      revision: "00",
      issueDate: "2026-01-15",
      position: "top",
      type: "planilha",
    });
    expect(bad.success).toBe(false);
  });
});
