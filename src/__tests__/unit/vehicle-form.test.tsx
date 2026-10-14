import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { VehicleForm } from "@/app/(protected)/vehicles/_components/vehicle-form";
import {
  updateVehicleAction,
  uploadVehiclePhotoAction,
} from "@/shared/server/actions/inspections/vehicles";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
}));
jest.mock("@/shared/server/actions/inspections/vehicles", () => ({
  createVehicleAction: jest.fn(),
  updateVehicleAction: jest.fn(),
  uploadVehiclePhotoAction: jest.fn(),
}));

const photoPath = "org_a/vehicles/11111111-1111-4111-8111-111111111111/foto.png";
const initial = {
  plate: "ABC1234",
  renavam: null,
  brand: null,
  model: null,
  type: null,
  year: null,
  color: null,
  owner: null,
  companyId: null,
  workUnitId: null,
  inspectionPlanId: null,
  inspectionFrequency: null,
  initialKm: 0,
  notes: null,
  photoPath,
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(updateVehicleAction).mockResolvedValue({ ok: true, data: {} } as never);
});

function openForm() {
  return render(
    <VehicleForm
      id="vehicle-a"
      initial={initial}
      companies={[]}
      workUnits={[]}
      inspectionPlans={[]}
    />,
  );
}

test("editar outro campo preserva a foto existente", async () => {
  openForm();
  fireEvent.click(screen.getByRole("button", { name: "Salvar veículo" }));
  await waitFor(() =>
    expect(updateVehicleAction).toHaveBeenCalledWith(
      "vehicle-a",
      expect.objectContaining({ photoPath }),
    ),
  );
});

test("remover a foto envia o campo vazio para limpar o vínculo ao salvar", async () => {
  openForm();
  fireEvent.click(screen.getByRole("button", { name: "Remover foto" }));
  fireEvent.click(screen.getByRole("button", { name: "Salvar veículo" }));
  await waitFor(() =>
    expect(updateVehicleAction).toHaveBeenCalledWith(
      "vehicle-a",
      expect.objectContaining({ photoPath: "" }),
    ),
  );
});

test("upload bem-sucedido exibe o preview e salva o novo caminho", async () => {
  jest.mocked(uploadVehiclePhotoAction).mockResolvedValue({
    ok: true,
    data: { path: "org_a/vehicles/new/foto.png", url: "https://example.test/foto.png" },
  });
  openForm();
  fireEvent.change(screen.getByLabelText("Foto do veículo"), {
    target: { files: [new File(["image"], "foto.png", { type: "image/png" })] },
  });
  await screen.findByRole("img", { name: "Foto do veículo" });
  fireEvent.click(screen.getByRole("button", { name: "Salvar veículo" }));
  await waitFor(() =>
    expect(updateVehicleAction).toHaveBeenCalledWith(
      "vehicle-a",
      expect.objectContaining({ photoPath: "org_a/vehicles/new/foto.png" }),
    ),
  );
});

test("falha de upload mantém a foto anterior e libera o formulário", async () => {
  jest
    .mocked(uploadVehiclePhotoAction)
    .mockRejectedValue(new Error("storage unavailable"));
  openForm();
  fireEvent.change(screen.getByLabelText("Foto do veículo"), {
    target: { files: [new File(["image"], "foto.png", { type: "image/png" })] },
  });
  await screen.findByText("Falha ao enviar a foto. Tente novamente.");
  fireEvent.click(screen.getByRole("button", { name: "Salvar veículo" }));
  await waitFor(() =>
    expect(updateVehicleAction).toHaveBeenCalledWith(
      "vehicle-a",
      expect.objectContaining({ photoPath }),
    ),
  );
});
