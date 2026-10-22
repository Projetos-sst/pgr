/**
 * KPIs do painel da Medicina (PLAN §3.1). Números fictícios distintos por cartão
 * para provar que cada um lê o campo certo. Só "Empresas" é link (não há filtro
 * por validade em `/health-exams`); vencidos/a vencer explicam que a base é a
 * validade INFORMADA (sem periodicidade calculada).
 */
import { render, screen } from "@testing-library/react";

import { MedicineOverviewCards } from "@/app/(protected)/medicine/_components/medicine-overview-cards";
import type { ExamValidityCounts } from "@/shared/domains/medicine/overview";

const VALIDITY: ExamValidityCounts = {
  ok: 11,
  dueSoon: 3,
  expired: 4,
  noExpiry: 6,
  withoutExam: 2,
};

function card(eyebrow: string): HTMLElement {
  const el = screen.getByText(eyebrow).closest(".animate-fade-slide-up");
  if (!el) throw new Error(`cartão "${eyebrow}" não encontrado`);
  return el as HTMLElement;
}

function valueOf(eyebrow: string): string | null {
  return card(eyebrow).querySelector(".text-\\[36px\\]")?.textContent ?? null;
}

describe("MedicineOverviewCards", () => {
  it("cada cartão mostra o número do seu campo", () => {
    render(
      <MedicineOverviewCards
        companies={2}
        employees={26}
        validity={VALIDITY}
        dueWindowDays={30}
      />,
    );
    expect(valueOf("EMPRESAS")).toBe("2");
    expect(valueOf("FUNCIONÁRIOS")).toBe("26");
    expect(valueOf("VENCIDOS")).toBe("4");
    expect(valueOf("A VENCER (30 DIAS)")).toBe("3");
    expect(valueOf("SEM EXAME")).toBe("2");
  });

  it("vencidos e a vencer citam a 'validade informada'", () => {
    render(
      <MedicineOverviewCards
        companies={1}
        employees={5}
        validity={VALIDITY}
        dueWindowDays={30}
      />,
    );
    expect(card("VENCIDOS")).toHaveTextContent(/validade informada/i);
    expect(card("A VENCER (30 DIAS)")).toHaveTextContent(/validade informada/i);
    expect(screen.getAllByText(/validade informada/i)).toHaveLength(2);
  });

  it("só 'Empresas' é link (para /companies)", () => {
    render(
      <MedicineOverviewCards
        companies={1}
        employees={5}
        validity={VALIDITY}
        dueWindowDays={30}
      />,
    );
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", "/companies");
    expect(links[0]).toHaveTextContent("EMPRESAS");
  });

  it("o rótulo do 'a vencer' acompanha a janela; empresa selecionada aparece no subtexto", () => {
    render(
      <MedicineOverviewCards
        companies={3}
        employees={8}
        validity={VALIDITY}
        dueWindowDays={45}
        companyName="Empresa Fictícia Ltda"
      />,
    );
    expect(screen.getByText("A VENCER (45 DIAS)")).toBeInTheDocument();
    expect(card("FUNCIONÁRIOS")).toHaveTextContent("Em Empresa Fictícia Ltda");
  });

  it("zeros são exibidos", () => {
    render(
      <MedicineOverviewCards
        companies={0}
        employees={0}
        validity={{ ok: 0, dueSoon: 0, expired: 0, noExpiry: 0, withoutExam: 0 }}
        dueWindowDays={30}
      />,
    );
    for (const eyebrow of [
      "EMPRESAS",
      "FUNCIONÁRIOS",
      "VENCIDOS",
      "A VENCER (30 DIAS)",
      "SEM EXAME",
    ]) {
      expect(valueOf(eyebrow)).toBe("0");
    }
    expect(card("FUNCIONÁRIOS")).toHaveTextContent("Em empresas com Medicina");
  });
});
