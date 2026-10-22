/**
 * Vazio "nenhuma empresa com Medicina habilitada" (PLAN §11.1): só o owner
 * habilita serviços, então só ele recebe o atalho para Empresas; o collaborator
 * é orientado a pedir ao administrador.
 */
import { render, screen } from "@testing-library/react";

import { MedicineEmptyState } from "@/app/(protected)/medicine/_components/medicine-empty-state";

const TITLE = "Nenhuma empresa com Medicina do Trabalho habilitada";

describe("MedicineEmptyState", () => {
  it("owner vê o link para /companies", () => {
    render(<MedicineEmptyState role="owner" />);
    expect(screen.getByRole("heading", { name: TITLE })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ir para Empresas" })).toHaveAttribute(
      "href",
      "/companies",
    );
    expect(screen.queryByText(/peça ao administrador/i)).toBeNull();
  });

  it("collaborator vê 'peça ao administrador' e nenhum link", () => {
    render(<MedicineEmptyState role="collaborator" />);
    expect(screen.getByRole("heading", { name: TITLE })).toBeInTheDocument();
    expect(screen.getByText(/peça ao administrador/i)).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("papel desconhecido cai no menor privilégio (sem link)", () => {
    render(<MedicineEmptyState role="client" />);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText(/peça ao administrador/i)).toBeInTheDocument();
  });
});
