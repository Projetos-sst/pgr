import { buildEsocialXml, esocialBuilders } from "@/shared/domains/esocial/builders";
import {
  canSendEvent,
  canTransitionEventStatus,
  eventStatusLabel,
  eventTypeLabel,
  EVENT_TYPES,
  listFiltersSchema,
  toEventListItem,
} from "@/shared/domains/esocial/events";
import { ESOCIAL_AMBIENTE, xmlEscape } from "@/shared/domains/esocial/xml";

const validInput: Record<string, unknown> = {
  "S-2190": { cpf: "12345678901", dataAdmissao: "2026-01-10" },
  "S-2200": {
    cpf: "12345678901",
    nome: "João da Silva",
    dataNascimento: "1990-05-05",
    dataAdmissao: "2026-01-10",
  },
  "S-2210": { cpf: "12345678901", dataAcidente: "2026-02-01", descricao: "Corte" },
  "S-2220": { cpf: "12345678901", dataAso: "2026-02-01" },
  "S-2221": {
    cpf: "12345678901",
    dataExame: "2026-02-01",
    cnpjLaboratorio: "11222333000181",
    codExame: "0001",
  },
  "S-2240": {
    cpf: "12345678901",
    dataInicio: "2026-01-10",
    codigoAgenteNocivo: "01.01.001",
  },
  "S-2300": {
    cpf: "12345678901",
    nome: "Maria",
    dataNascimento: "1985-01-01",
  },
};

describe("builders eSocial", () => {
  it("cada tipo gera XML com ambientePadrao=Producao para entrada válida", () => {
    for (const type of EVENT_TYPES) {
      const xml = buildEsocialXml(type, validInput[type]);
      expect(xml).toContain("<eSocial");
      expect(xml).toContain(`ambientePadrao="${ESOCIAL_AMBIENTE}"`);
      expect(xml).toContain("12345678901");
    }
  });

  it("S-2240 inclui código do agente nocivo", () => {
    const xml = buildEsocialXml("S-2240", validInput["S-2240"]);
    expect(xml).toContain("<codAgNoc>01.01.001</codAgNoc>");
  });

  it("zod rejeita CPF inválido e campos faltantes", () => {
    expect(() =>
      buildEsocialXml("S-2190", { cpf: "123", dataAdmissao: "2026-01-10" }),
    ).toThrow();
    expect(() => buildEsocialXml("S-2200", { cpf: "12345678901" })).toThrow();
    expect(() =>
      esocialBuilders["S-2221"].build({
        cpf: "12345678901",
        dataExame: "2026-02-01",
        cnpjLaboratorio: "123",
        codExame: "x",
      }),
    ).toThrow();
  });

  it("escapa caracteres reservados", () => {
    expect(xmlEscape("a<b>&\"'")).toBe("a&lt;b&gt;&amp;&quot;&apos;");
    const xml = buildEsocialXml("S-2210", {
      cpf: "12345678901",
      dataAcidente: "2026-02-01",
      descricao: "Corte & <lesão>",
    });
    expect(xml).toContain("Corte &amp; &lt;lesão&gt;");
  });
});

describe("regras de status e filtros", () => {
  it("só pending é enviável", () => {
    expect(canSendEvent("pending")).toBe(true);
    expect(canSendEvent("sent")).toBe(false);
    expect(canSendEvent("accepted")).toBe(false);
  });

  it("transições de status", () => {
    expect(canTransitionEventStatus("draft", "pending")).toBe(true);
    expect(canTransitionEventStatus("pending", "sent")).toBe(true);
    expect(canTransitionEventStatus("sent", "accepted")).toBe(true);
    expect(canTransitionEventStatus("accepted", "draft")).toBe(false);
  });

  it("filtros zod aceitam datas e status válidos", () => {
    expect(
      listFiltersSchema.parse({ status: "pending", dateFrom: "2026-01-01" }).status,
    ).toBe("pending");
    expect(() => listFiltersSchema.parse({ status: "xyz" })).toThrow();
  });
});

describe("labels e projeção", () => {
  it("rótulos", () => {
    expect(eventTypeLabel("S-2240")).toContain("Agentes Nocivos");
    expect(eventStatusLabel("accepted")).toBe("Aceito");
  });

  it("projeta linha", () => {
    const item = toEventListItem({
      id: "e1",
      eventType: "S-2210",
      status: "pending",
      referenceId: null,
      batchId: null,
      createdAt: new Date("2026-02-01T12:00:00Z"),
    });
    expect(item.statusLabel).toBe("Pendente");
    expect(item.createdAt.startsWith("2026-02-01")).toBe(true);
  });
});
