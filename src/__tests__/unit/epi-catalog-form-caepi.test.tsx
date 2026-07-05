/**
 * Wiring do CAEPI no formulário de catálogo (US1/012): o autofill de
 * fabricante/norma/validade acontece via `onFound` (valid E expired — o hook,
 * já coberto na fatia 011, nunca dispara em not_found) e nenhum estado do CA
 * bloqueia o salvamento.
 */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

import type { CaFound } from "@/shared/integrations/caepi/client/use-caepi-validation";

const push = jest.fn();
const refresh = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

jest.mock("@/shared/server/actions/pgr/categories", () => ({
  listCategoriesAction: jest.fn(async () => ({ ok: true, data: { rows: [], total: 0 } })),
}));

const createEpiCatalogAction = jest.fn(
  async (_input: { ca: string }) => ({ ok: true, data: { id: "epi-1" } }) as const,
);
jest.mock("@/shared/server/actions/pgr/epi-catalog", () => ({
  createEpiCatalogAction: (input: { ca: string }) => createEpiCatalogAction(input),
  updateEpiCatalogAction: jest.fn(),
}));

// Captura o callback `onFound` que o form entrega ao CaField, para o teste
// simular os desfechos do lookup sem rede (o hook real é coberto na 011).
const hookState: { onFound?: (data: CaFound) => void } = {};
jest.mock("@/shared/integrations/caepi/client/use-caepi-validation", () => ({
  useCaepiValidation: (onFound: (data: CaFound) => void) => {
    hookState.onFound = onFound;
    return { status: "idle", data: undefined, lookup: jest.fn() };
  },
}));

import { EpiCatalogForm } from "@/app/(protected)/epi-catalog/_components/epi-catalog-form";

const FOUND: CaFound = {
  status: "valid",
  ca: "31469",
  manufacturer: "3M do Brasil Ltda",
  norm: "ABNT NBR 13698:2011",
  validUntil: "2027-01-15",
};

function fieldValue(label: string): string {
  return (screen.getByLabelText(label) as HTMLInputElement).value;
}

describe("EpiCatalogForm × CAEPI", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    hookState.onFound = undefined;
  });

  it("onFound (valid) autopreenche fabricante, norma e validade", () => {
    render(<EpiCatalogForm />);

    act(() => hookState.onFound!(FOUND));

    expect(fieldValue("Fabricante")).toBe("3M do Brasil Ltda");
    expect(fieldValue("Norma")).toBe("ABNT NBR 13698:2011");
    expect(fieldValue("Validade do CA")).toBe("2027-01-15");
  });

  it("onFound (expired) também autopreenche (dados para conferência)", () => {
    render(<EpiCatalogForm />);

    act(() => hookState.onFound!({ ...FOUND, status: "expired" }));

    expect(fieldValue("Fabricante")).toBe("3M do Brasil Ltda");
    expect(fieldValue("Validade do CA")).toBe("2027-01-15");
  });

  it("not_found (onFound nunca dispara) mantém os campos vazios e editáveis", () => {
    render(<EpiCatalogForm />);

    expect(fieldValue("Fabricante")).toBe("");
    expect(fieldValue("Norma")).toBe("");
    expect(screen.getByLabelText("Fabricante")).not.toBeDisabled();
  });

  it("campos autopreenchidos seguem editáveis (o form é dono do valor)", () => {
    render(<EpiCatalogForm />);

    act(() => hookState.onFound!(FOUND));
    fireEvent.change(screen.getByLabelText("Fabricante"), {
      target: { value: "Outro Fabricante" },
    });

    expect(fieldValue("Fabricante")).toBe("Outro Fabricante");
  });

  it("submeter com CA vazio não bloqueia o salvamento", async () => {
    const { container } = render(<EpiCatalogForm />);

    fireEvent.submit(container.querySelector("form")!);

    await waitFor(() => expect(createEpiCatalogAction).toHaveBeenCalled());
    expect(createEpiCatalogAction.mock.calls[0][0].ca).toBe("");
    await waitFor(() => expect(push).toHaveBeenCalledWith("/epi-catalog"));
  });

  it("submeter com CA sem correspondência (digitado à mão) também salva", async () => {
    const { container } = render(<EpiCatalogForm />);

    fireEvent.change(screen.getByLabelText("CA"), { target: { value: "99999" } });
    fireEvent.submit(container.querySelector("form")!);

    await waitFor(() => expect(createEpiCatalogAction).toHaveBeenCalled());
    expect(createEpiCatalogAction.mock.calls[0][0].ca).toBe("99999");
  });
});
