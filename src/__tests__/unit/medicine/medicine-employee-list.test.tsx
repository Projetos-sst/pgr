/**
 * Lista de funcionários do painel da Medicina (presentational). Dados fictícios.
 * Sem exame → badge neutro "Sem exame registrado"; nome leva à ficha; o contrato
 * não traz CPF nem observações.
 */
import { render, screen, within } from "@testing-library/react";

import { MedicineEmployeeList } from "@/app/(protected)/medicine/_components/medicine-employee-list";
import type { MedicineEmployeeItem } from "@/shared/domains/medicine/employees";

const TODAY = "2026-10-21";
const COMPANY_ID = "c1111111-1111-4111-8111-111111111111";

const WITH_EXAM: MedicineEmployeeItem = {
  id: "a1111111-1111-4111-8111-111111111111",
  fullName: "Beltrana Fictícia",
  status: "active",
  jobRoleTitle: "Operadora Fictícia",
  gesName: "GES Teste 01",
  latestExam: {
    examType: "periodic",
    performedAt: "2025-10-01",
    validUntil: "2026-10-01",
    aptitude: "fit",
  },
};
const NO_VALIDITY: MedicineEmployeeItem = {
  id: "a2222222-2222-4222-8222-222222222222",
  fullName: "Cicrano Ficcional",
  status: "on_leave",
  jobRoleTitle: null,
  gesName: null,
  latestExam: {
    examType: "admissional",
    performedAt: "2024-03-05",
    validUntil: null,
    aptitude: "fit_with_restrictions",
  },
};
const WITHOUT_EXAM: MedicineEmployeeItem = {
  id: "a3333333-3333-4333-8333-333333333333",
  fullName: "Fulano Inventado",
  status: "active",
  jobRoleTitle: "Auxiliar Teste",
  gesName: "GES Teste 02",
  latestExam: null,
};

function renderList(rows: MedicineEmployeeItem[], extra: { search?: string } = {}) {
  return render(
    <MedicineEmployeeList
      rows={rows}
      total={rows.length}
      page={1}
      pageSize={20}
      companyId={COMPANY_ID}
      today={TODAY}
      dueWindowDays={30}
      {...extra}
    />,
  );
}

function rowOf(name: string): HTMLElement {
  const row = screen.getByRole("link", { name }).closest('[role="row"]');
  if (!row) throw new Error(`linha de ${name} não encontrada`);
  return row as HTMLElement;
}

describe("MedicineEmployeeList", () => {
  it("linha sem exame mostra 'Sem exame registrado' e link para a ficha", () => {
    renderList([WITH_EXAM, NO_VALIDITY, WITHOUT_EXAM]);
    const row = rowOf("Fulano Inventado");
    expect(within(row).getByText("Sem exame registrado")).toBeInTheDocument();
    expect(within(row).getByRole("link", { name: "Fulano Inventado" })).toHaveAttribute(
      "href",
      `/employees/${WITHOUT_EXAM.id}`,
    );
  });

  it("todo nome leva a /employees/<id>", () => {
    renderList([WITH_EXAM, NO_VALIDITY, WITHOUT_EXAM]);
    for (const r of [WITH_EXAM, NO_VALIDITY, WITHOUT_EXAM]) {
      expect(screen.getByRole("link", { name: r.fullName })).toHaveAttribute(
        "href",
        `/employees/${r.id}`,
      );
    }
  });

  it("linha com exame mostra tipo, datas e badge pela validade informada", () => {
    renderList([WITH_EXAM, NO_VALIDITY]);
    const expired = rowOf("Beltrana Fictícia");
    expect(expired).toHaveTextContent("Periódico");
    expect(expired).toHaveTextContent("01/10/2025");
    expect(expired).toHaveTextContent("01/10/2026");
    expect(within(expired).getByText("Vencido")).toBeInTheDocument();
    expect(within(expired).queryByText("Sem exame registrado")).toBeNull();

    const noValidity = rowOf("Cicrano Ficcional");
    expect(noValidity).toHaveTextContent("Admissional");
    expect(within(noValidity).getByText("Sem validade informada")).toBeInTheDocument();
    expect(within(noValidity).getByText("Apto c/ restrição")).toBeInTheDocument();
    expect(within(noValidity).getByText("Afastado")).toBeInTheDocument();
  });

  it("lista vazia: mensagem de vazio conforme a busca", () => {
    const { unmount } = renderList([]);
    expect(screen.getByText("Nenhum funcionário nesta empresa.")).toBeInTheDocument();
    unmount();
    renderList([], { search: "zzz" });
    expect(
      screen.getByText("Nenhum funcionário encontrado para a busca."),
    ).toBeInTheDocument();
  });
});
