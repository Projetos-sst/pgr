/**
 * NOB-112/NOB-156: na declaração de inexistência de riscos a função é escolhida entre as
 * funções vinculadas ao GES (nunca digitada) e vai pelo id da função cadastrada (renomear não
 * invalida), vazia = grupo todo, trocar o GES limpa a função e o erro de campo do servidor
 * aparece em "Função". Dados fictícios.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { RiskAbsenceForm } from "@/app/(protected)/companies/[id]/medical-risks/risk-absence-form";
import { declareRiskAbsenceAction } from "@/shared/server/actions/medicine/risk-absence";

const mockRefresh = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), refresh: mockRefresh }),
}));
jest.mock("@/shared/server/actions/medicine/risk-absence", () => ({
  declareRiskAbsenceAction: jest.fn(),
  listRiskAbsenceAction: jest.fn(),
}));

const declare = declareRiskAbsenceAction as jest.Mock;
const COMPANY = "c1111111-1111-4111-8111-111111111111";
const SOURCE = "s1111111-1111-4111-8111-111111111111";
const GES_ADM = "g1111111-1111-4111-8111-111111111111";
const GES_PROD = "g2222222-2222-4222-8222-222222222222";
const JUSTIFICATION = "Atividade administrativa fictícia, sem agentes no posto.";

const groups = [
  {
    id: GES_ADM,
    label: "Administrativo",
    jobRoles: [{ id: "r1", title: "Auxiliar administrativo" }],
  },
  {
    id: GES_PROD,
    label: "Produção",
    jobRoles: [
      { id: "r2", title: "Operador de empilhadeira" },
      { id: "r3", title: "OPERADOR DE EMPILHADEIRA" },
    ],
  },
];

function renderForm() {
  return render(
    <RiskAbsenceForm
      companyId={COMPANY}
      sources={[{ id: SOURCE, label: "PGR Fictício — 1" }]}
      groups={groups}
    />,
  );
}

const field = (label: RegExp) => screen.getByLabelText(label) as HTMLSelectElement;
const optionValues = (select: HTMLSelectElement) =>
  Array.from(select.options).map((o) => o.value);
const change = (label: RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
const submit = () =>
  fireEvent.click(
    screen.getByRole("button", { name: /Declarar inexistência de riscos/ }),
  );

beforeEach(() => {
  jest.clearAllMocks();
});

describe("RiskAbsenceForm", () => {
  it("função é lista das funções do GES escolhido, não texto livre", () => {
    renderForm();
    expect(field(/^Função/).tagName).toBe("SELECT");
    expect(screen.queryByRole("textbox", { name: /^Função/ })).toBeNull();
    // Sem GES, só "grupo todo" e desabilitada.
    expect(field(/^Função/)).toBeDisabled();
    expect(optionValues(field(/^Função/))).toEqual([""]);

    change(/^GES/, GES_PROD);
    expect(field(/^Função/)).not.toBeDisabled();
    // O valor de cada opção é o id da função; o rótulo, o título.
    expect(optionValues(field(/^Função/))).toEqual(["", "r2", "r3"]);
    expect(Array.from(field(/^Função/).options).map((o) => o.text)).toEqual([
      "Grupo todo (todas as funções do GES)",
      "Operador de empilhadeira",
      "OPERADOR DE EMPILHADEIRA",
    ]);
  });

  it("envia o id da função escolhida, não o título; trocar o GES limpa a função", async () => {
    declare.mockResolvedValue({ ok: true, data: { id: "d1" } });
    renderForm();
    change(/^Versão vigente da fonte/, SOURCE);
    change(/^GES/, GES_PROD);
    change(/^Função/, "r3");
    change(/^GES/, GES_ADM);
    expect(field(/^Função/)).toHaveValue("");
    change(/^Função/, "r1");
    change(/^Justificativa técnica/, JUSTIFICATION);
    submit();

    await waitFor(() => expect(mockRefresh).toHaveBeenCalled());
    expect(declare).toHaveBeenCalledWith(COMPANY, {
      sourceId: SOURCE,
      gesId: GES_ADM,
      jobRoleId: "r1",
      justification: JUSTIFICATION,
    });
  });

  it("sem função escolhida = grupo todo (jobRoleId vazio)", async () => {
    declare.mockResolvedValue({ ok: true, data: { id: "d1" } });
    renderForm();
    change(/^Versão vigente da fonte/, SOURCE);
    change(/^GES/, GES_ADM);
    change(/^Justificativa técnica/, JUSTIFICATION);
    submit();

    await waitFor(() => expect(declare).toHaveBeenCalled());
    expect(declare).toHaveBeenCalledWith(
      COMPANY,
      expect.objectContaining({ gesId: GES_ADM, jobRoleId: "" }),
    );
  });

  it("GES sem funções vinculadas avisa que só cabe o grupo todo", () => {
    render(
      <RiskAbsenceForm
        companyId={COMPANY}
        sources={[{ id: SOURCE, label: "PGR Fictício — 1" }]}
        groups={[{ id: GES_ADM, label: "Administrativo", jobRoles: [] }]}
      />,
    );
    change(/^GES/, GES_ADM);
    expect(screen.getByText(/não tem funções vinculadas/)).toBeInTheDocument();
  });

  it("erro de campo do servidor aparece em Função", async () => {
    const message =
      "Função não encontrada entre as funções cadastradas e vinculadas a este GES. Escolha uma função do GES ou deixe em branco para o grupo todo.";
    declare.mockResolvedValue({
      ok: false,
      error: {
        code: "VALIDATION",
        message: "Dados inválidos.",
        fields: { jobRoleId: message },
      },
    });
    renderForm();
    change(/^GES/, GES_PROD);
    change(/^Função/, "r2");
    submit();

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(mockRefresh).not.toHaveBeenCalled();
  });
});
