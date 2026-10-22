/**
 * Seção "Saúde ocupacional" da ficha do funcionário (PLAN §3.4 / §11.1). Dados
 * 100% fictícios. Os fixtures injetam `notes`/`certificatePath` de propósito: o
 * componente recebe `HealthExamListItem` (que não traz esses campos), mas mesmo
 * que um objeto maior chegue, nada clínico pode vazar para a tela.
 */
import { render, screen, within } from "@testing-library/react";

import { OccupationalHealthSection } from "@/app/(protected)/employees/[id]/_components/occupational-health-section";
import type { HealthExamListItem } from "@/shared/domains/pgr/health-exams";
import type { Paginated } from "@/shared/pagination";
import type { ActionResult } from "@/shared/server/result";

const TODAY = "2026-10-21";
const EMPLOYEE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SECRET_NOTES = "OBSERVACAO-SIGILOSA-FICTICIA";
const SECRET_PATH = "/docs/aso/arquivo-sigiloso-ficticio.pdf";

type ExamWithSecrets = HealthExamListItem & {
  notes: string;
  certificatePath: string;
};

function exam(overrides: Partial<ExamWithSecrets>): ExamWithSecrets {
  return {
    id: "e0000000-0000-4000-8000-000000000000",
    employeeId: EMPLOYEE_ID,
    employeeName: "Fulano Fictício",
    doctorId: null,
    doctorName: null,
    examType: "periodic",
    performedAt: "2026-01-10",
    validUntil: null,
    aptitude: "fit",
    notes: SECRET_NOTES,
    certificatePath: SECRET_PATH,
    ...overrides,
  };
}

const EXPIRED = exam({
  id: "e1111111-1111-4111-8111-111111111111",
  examType: "periodic",
  performedAt: "2025-10-01",
  validUntil: "2026-10-01",
  doctorId: "d1111111-1111-4111-8111-111111111111",
  doctorName: "Dra. Ficcional Teste",
});
const DUE_SOON = exam({
  id: "e2222222-2222-4222-8222-222222222222",
  examType: "return_to_work",
  performedAt: "2026-05-02",
  validUntil: "2026-11-10",
  aptitude: "fit_with_restrictions",
});
const NO_EXPIRY = exam({
  id: "e3333333-3333-4333-8333-333333333333",
  examType: "admissional",
  performedAt: "2024-02-15",
  validUntil: null,
  aptitude: "fit",
});

function okExams(rows: HealthExamListItem[], total = rows.length) {
  return {
    ok: true,
    data: { rows, total, page: 1, pageSize: 5 },
  } as unknown as ActionResult<Paginated<HealthExamListItem>>;
}

function renderSection(
  props: Partial<React.ComponentProps<typeof OccupationalHealthSection>> = {},
) {
  return render(
    <OccupationalHealthSection
      employeeId={EMPLOYEE_ID}
      moduleState="enabled"
      exams={okExams([])}
      today={TODAY}
      {...props}
    />,
  );
}

describe("OccupationalHealthSection", () => {
  it("Medicina desabilitada → nada renderizado (nem título, nem contagem)", () => {
    const { container } = renderSection({
      moduleState: "disabled",
      exams: okExams([EXPIRED, DUE_SOON], 9),
    });
    expect(container).toBeEmptyDOMElement();
  });

  it("erro ao verificar o módulo → alerta de falha, sem CTA de registro e sem 'Nenhum'", () => {
    const { container } = renderSection({
      moduleState: "error",
      exams: okExams([EXPIRED]),
    });
    expect(
      screen.getByRole("heading", { name: "Saúde ocupacional" }),
    ).toBeInTheDocument();
    const alert = screen.getByRole("alert");
    expect(
      within(alert).getByRole("heading", {
        level: 2,
        name: /verificar se a Medicina está habilitada/,
      }),
    ).toBeInTheDocument();
    expect(within(alert).getByRole("link", { name: "Tentar novamente" })).toHaveAttribute(
      "href",
      `/employees/${EMPLOYEE_ID}`,
    );
    expect(screen.queryByRole("link", { name: "Registrar exame" })).toBeNull();
    expect(screen.queryByRole("list")).toBeNull();
    expect(container.textContent).not.toMatch(/nenhum/i);
  });

  it("erro ao ler os exames → alerta com rótulo amigável (sem código cru), nunca o vazio", () => {
    const { container } = renderSection({
      exams: { ok: false, error: { code: "FORBIDDEN", message: "x" } },
    });
    const alert = screen.getByRole("alert");
    expect(within(alert).getByText(/Acesso não permitido/)).toBeInTheDocument();
    expect(alert.textContent).not.toMatch(/FORBIDDEN/);
    expect(
      within(alert).getByRole("heading", { name: "Não foi possível carregar os exames" }),
    ).toBeInTheDocument();
    expect(within(alert).getByRole("link", { name: "Tentar novamente" })).toHaveAttribute(
      "href",
      `/employees/${EMPLOYEE_ID}`,
    );
    expect(screen.queryByRole("list")).toBeNull();
    expect(container.textContent).not.toMatch(/nenhum exame registrado/i);
  });

  it("vazio → mensagem e CTA para /health-exams/new?employeeId=<id>", () => {
    renderSection({ exams: okExams([]) });
    expect(
      screen.getByText("Nenhum exame registrado para este funcionário."),
    ).toBeInTheDocument();
    const links = screen.getAllByRole("link", { name: "Registrar exame" });
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute(
      "href",
      `/health-exams/new?employeeId=${EMPLOYEE_ID}`,
    );
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("lista em <ol> na ordem do servidor, com validade informada e badge com texto", () => {
    renderSection({ exams: okExams([EXPIRED, DUE_SOON, NO_EXPIRY]) });

    const list = screen.getByRole("list", { name: /do mais recente ao mais antigo/ });
    expect(list.tagName).toBe("OL");
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(3);

    // 1) vencido: data informada + badge "Vencido" + médico
    expect(items[0]).toHaveTextContent("Periódico");
    expect(items[0]).toHaveTextContent("01/10/2025");
    expect(items[0]).toHaveTextContent("01/10/2026");
    expect(items[0]).toHaveTextContent("Dra. Ficcional Teste");
    expect(within(items[0]).getByText("Vencido")).toBeInTheDocument();

    // 2) a vencer: badge "A vencer" (validade tem prioridade sobre a aptidão)
    expect(items[1]).toHaveTextContent("Retorno ao Trabalho");
    expect(items[1]).toHaveTextContent("10/11/2026");
    expect(within(items[1]).getByText("A vencer")).toBeInTheDocument();
    expect(items[1]).toHaveTextContent("Apto c/ restrição");

    // 3) sem validade: rótulo "Sem validade informada"; badge mostra a aptidão
    expect(items[2]).toHaveTextContent("Admissional");
    expect(within(items[2]).getByText("Sem validade informada")).toBeInTheDocument();
    expect(items[2]).toHaveTextContent("—"); // sem médico
    const aptoTexts = within(items[2]).getAllByText("Apto");
    expect(aptoTexts.length).toBeGreaterThanOrEqual(1);

    // Abrir cada exame
    expect(within(items[0]).getByRole("link", { name: /Abrir/ })).toHaveAttribute(
      "href",
      `/health-exams/${EXPIRED.id}/edit`,
    );

    // CTA no cabeçalho
    expect(screen.getByRole("link", { name: "Registrar exame" })).toHaveAttribute(
      "href",
      `/health-exams/new?employeeId=${EMPLOYEE_ID}`,
    );
  });

  it("'Ver todos' só aparece quando o total passa das linhas exibidas", () => {
    const { unmount } = renderSection({ exams: okExams([EXPIRED, DUE_SOON], 7) });
    expect(screen.getByRole("link", { name: "Ver todos os 7 exames" })).toHaveAttribute(
      "href",
      `/health-exams?employeeId=${EMPLOYEE_ID}`,
    );
    unmount();

    renderSection({ exams: okExams([EXPIRED, DUE_SOON], 2) });
    expect(screen.queryByRole("link", { name: /Ver todos/ })).toBeNull();
  });

  it("NUNCA renderiza notes nem certificatePath, mesmo se vierem no objeto", () => {
    const { container } = renderSection({
      exams: okExams([EXPIRED, DUE_SOON, NO_EXPIRY], 10),
    });
    const html = container.innerHTML;
    expect(html).not.toContain(SECRET_NOTES);
    expect(html).not.toContain(SECRET_PATH);
    expect(html).not.toContain("arquivo-sigiloso");
    expect(container.textContent).not.toMatch(/observa/i);
  });
});
