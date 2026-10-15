jest.mock("@/shared/supabase/admin", () => ({
  getRlsBypassingSupabaseClient: jest.fn(),
}));

import { getRlsBypassingSupabaseClient } from "@/shared/supabase/admin";
import {
  buildEmployeePhotoPath,
  EMPLOYEE_PHOTOS_BUCKET,
  getSignedEmployeePhotoUrl,
  putEmployeePhoto,
} from "@/shared/integrations/storage/employee-photo-storage";

const mockedClient = getRlsBypassingSupabaseClient as jest.MockedFunction<
  typeof getRlsBypassingSupabaseClient
>;

function storageClient(
  uploadError: unknown = null,
  signResult: { url?: string; error?: unknown } = {},
) {
  const upload = jest.fn(async () => ({ error: uploadError }));
  const createSignedUrl = jest.fn(async () => ({
    data: signResult.error
      ? null
      : { signedUrl: signResult.url ?? "https://signed.example/photo" },
    error: signResult.error ?? null,
  }));
  const from = jest.fn(() => ({ upload, createSignedUrl }));
  return { from, upload, createSignedUrl };
}

describe("buildEmployeePhotoPath", () => {
  it("particiona por org_id/fotos/fileId.extensão", () => {
    expect(buildEmployeePhotoPath("org_a", "file-1", "png")).toBe(
      "org_a/fotos/file-1.png",
    );
  });
});

describe("putEmployeePhoto", () => {
  beforeEach(() => mockedClient.mockReset());

  it("grava no bucket dedicado e devolve storagePath + sizeBytes", async () => {
    const client = storageClient();
    mockedClient.mockReturnValue({
      storage: { from: client.from },
    } as unknown as ReturnType<typeof getRlsBypassingSupabaseClient>);

    const file = new File(["conteudo"], "foto.png", { type: "image/png" });
    const result = await putEmployeePhoto("org_a", file, "png");

    expect(client.from).toHaveBeenCalledWith(EMPLOYEE_PHOTOS_BUCKET);
    expect(client.upload).toHaveBeenCalledTimes(1);
    const [calledPath, , options] = client.upload.mock.calls[0] as unknown as [
      string,
      unknown,
      { contentType: string; upsert: boolean },
    ];
    expect(calledPath).toMatch(/^org_a\/fotos\/[0-9a-f-]+\.png$/);
    expect(options).toEqual({ contentType: "image/png", upsert: false });
    expect(result.storagePath).toBe(calledPath);
    expect(result.sizeBytes).toBe(file.size);
  });

  it("propaga erro do provedor sem vazar detalhe do path", async () => {
    const client = storageClient({ message: "boom" });
    mockedClient.mockReturnValue({
      storage: { from: client.from },
    } as unknown as ReturnType<typeof getRlsBypassingSupabaseClient>);

    const file = new File(["x"], "foto.png", { type: "image/png" });
    await expect(putEmployeePhoto("org_a", file, "png")).rejects.toThrow(
      "employee photo upload failed: boom",
    );
  });
});

describe("getSignedEmployeePhotoUrl", () => {
  beforeEach(() => mockedClient.mockReset());

  it("devolve a URL assinada", async () => {
    const client = storageClient(null, { url: "https://signed.example/x" });
    mockedClient.mockReturnValue({
      storage: { from: client.from },
    } as unknown as ReturnType<typeof getRlsBypassingSupabaseClient>);

    const url = await getSignedEmployeePhotoUrl("org_a/fotos/file-1.png");
    expect(url).toBe("https://signed.example/x");
    expect(client.createSignedUrl).toHaveBeenCalledWith("org_a/fotos/file-1.png", 3600);
  });

  it("lança quando o provedor falha ao assinar", async () => {
    const client = storageClient(null, { error: { message: "not found" } });
    mockedClient.mockReturnValue({
      storage: { from: client.from },
    } as unknown as ReturnType<typeof getRlsBypassingSupabaseClient>);

    await expect(getSignedEmployeePhotoUrl("org_a/fotos/file-1.png")).rejects.toThrow(
      "employee photo sign url failed: not found",
    );
  });
});
