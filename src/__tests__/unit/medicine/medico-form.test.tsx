/**
 * Cadastro de profissional (NOB-121, MED-02): categoria, vínculo, UF do conselho
 * e RQE chegam à Server Action, a edição recarrega os valores salvos e os erros
 * de campo do servidor aparecem no formulário. Dados fictícios.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { MedicoForm } from "@/app/(protected)/medicos/_components/medico-form";
import {
  createMedicoAction,
  updateMedicoAction,
} from "@/shared/server/actions/pgr/medicos";

const mockPush = jest.fn();
const mockRefresh = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}));
jest.mock("@/shared/server/actions/pgr/medicos", () => ({
  createMedicoAction: jest.fn(),
  updateMedicoAction: jest.fn(),
}));

const create = createMedicoAction as jest.Mock;
const update = updateMedicoAction as jest.Mock;
const ID = "b1111111-1111-4111-8111-111111111111";

beforeEach(() => {
  jest.clearAllMocks();
});

function change(label: RegExp, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

describe("MedicoForm", () => {
  it("cadastra psicóloga externa com CRP e UF", async () => {
    create.mockResolvedValue({ ok: true, data: { id: ID } });
    render(<MedicoForm />);
    change(/^Nome/, "Psicóloga Fictícia");
    change(/^Categoria/, "psychologist");
    change(/^Vínculo/, "external");
    change(/Número do registro/, "06/12345");
    change(/UF do conselho/, "MA");
    fireEvent.click(screen.getByRole("button", { name: "Cadastrar profissional" }));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/medicos"));
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Psicóloga Fictícia",
        profession: "psychologist",
        affiliation: "external",
        crm: "06/12345",
        registrationUf: "MA",
        rqe: "",
      }),
    );
  });

  it("na edição, recarrega categoria, vínculo, UF e RQE salvos e atualiza pelo id", async () => {
    update.mockResolvedValue({ ok: true, data: { id: ID } });
    render(
      <MedicoForm
        id={ID}
        initial={{
          name: "Dra. Fictícia",
          crm: "12345",
          profession: "physician",
          registrationUf: "SP",
          rqe: "6789",
          affiliation: "internal",
          specialty: null,
          clinic: null,
          phone: null,
          status: "active",
        }}
      />,
    );
    expect(screen.getByLabelText(/UF do conselho/)).toHaveValue("SP");
    expect(screen.getByLabelText(/RQE/)).toHaveValue("6789");
    fireEvent.click(screen.getByRole("button", { name: "Salvar profissional" }));

    await waitFor(() => expect(update).toHaveBeenCalled());
    expect(update).toHaveBeenCalledWith(
      ID,
      expect.objectContaining({
        profession: "physician",
        registrationUf: "SP",
        rqe: "6789",
      }),
    );
  });

  it("erro de campo do servidor aparece no campo e não navega", async () => {
    create.mockResolvedValue({
      ok: false,
      error: {
        code: "VALIDATION",
        message: "Dados inválidos.",
        fields: { rqe: "RQE só se aplica a médico." },
      },
    });
    render(<MedicoForm />);
    fireEvent.click(screen.getByRole("button", { name: "Cadastrar profissional" }));

    expect(await screen.findByText("RQE só se aplica a médico.")).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });
});
