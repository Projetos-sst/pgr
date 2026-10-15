import { uploadVehiclePhoto } from "@/shared/server/inspections/vehicle-photo-core";
import { putVehiclePhoto } from "@/shared/integrations/storage/vehicle-photo-storage";
import { getSignedDownloadUrl } from "@/shared/integrations/storage/documents-storage";

jest.mock("@/shared/db/repositories/vehicles", () => ({ getVehicle: jest.fn() }));
jest.mock("@/shared/integrations/storage/vehicle-photo-storage", () => ({
  putVehiclePhoto: jest.fn(async () => "org_a/vehicles/photo/foto.png"),
}));
jest.mock("@/shared/integrations/storage/documents-storage", () => ({
  getSignedDownloadUrl: jest.fn(async () => "https://storage.test/photo.png"),
}));

beforeEach(() => jest.clearAllMocks());

it("valida o arquivo antes de acessar o storage", async () => {
  for (const file of [
    null,
    new File(["pdf"], "foto.pdf", { type: "application/pdf" }),
    new File([], "foto.png", { type: "image/png" }),
    new File([new Uint8Array(5 * 1024 * 1024 + 1)], "grande.png", { type: "image/png" }),
  ]) {
    const data = new FormData();
    if (file) data.set("file", file);
    await expect(uploadVehiclePhoto("org_a", data)).rejects.toThrow();
  }
  expect(putVehiclePhoto).not.toHaveBeenCalled();
  expect(getSignedDownloadUrl).not.toHaveBeenCalled();
});

it("usa o tenant da sessão e assina a foto enviada", async () => {
  const data = new FormData();
  const file = new File(["imagem"], "foto.png", { type: "image/png" });
  data.set("file", file);
  await expect(uploadVehiclePhoto("org_a", data)).resolves.toEqual({
    path: "org_a/vehicles/photo/foto.png",
    url: "https://storage.test/photo.png",
  });
  expect(putVehiclePhoto).toHaveBeenCalledWith("org_a", expect.any(File), "png");
  expect(getSignedDownloadUrl).toHaveBeenCalledWith("org_a/vehicles/photo/foto.png", {
    ttlSeconds: 3600,
  });
});
