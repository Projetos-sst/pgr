jest.mock("@/shared/supabase/admin", () => ({
  getRlsBypassingSupabaseClient: jest.fn(),
}));

import { getRlsBypassingSupabaseClient } from "@/shared/supabase/admin";
import {
  buildStoragePath,
  DOCUMENTS_BUCKET,
  generatedDocumentPath,
  getSignedDownloadUrl,
  isStorageObjectExistsError,
  putDocumentObject,
  putGeneratedDocument,
  StorageObjectExistsError,
  removeDocumentObject,
  SIGNED_DOWNLOAD_URL_TTL_SECONDS,
  slugifyFileName,
} from "@/shared/integrations/storage/documents-storage";

const mockedClient = getRlsBypassingSupabaseClient as jest.MockedFunction<
  typeof getRlsBypassingSupabaseClient
>;

function storageClient(
  uploadError: unknown = null,
  removeError: unknown = null,
  signResult: { url?: string; error?: unknown } = {},
) {
  const upload = jest.fn(async () => ({ error: uploadError }));
  const remove = jest.fn(async () => ({ error: removeError }));
  const createSignedUrl = jest.fn(async () => ({
    data: signResult.error
      ? null
      : { signedUrl: signResult.url ?? "https://signed.example/x" },
    error: signResult.error ?? null,
  }));
  const from = jest.fn(() => ({ upload, remove, createSignedUrl }));
  return { from, upload, remove, createSignedUrl };
}

describe("slugifyFileName", () => {
  it("normaliza acentos, espaços e caixa preservando a extensão", () => {
    expect(slugifyFileName("Laudo Técnico Final.PDF")).toBe("laudo-tecnico-final.pdf");
  });

  it("sem extensão, mantém apenas o slug", () => {
    expect(slugifyFileName("semextensao")).toBe("semextensao");
  });

  it("nome vazio/sem base após limpeza cai no fallback 'arquivo'", () => {
    expect(slugifyFileName("....pdf")).toBe("arquivo.pdf");
  });

  it("trunca a base em 80 caracteres", () => {
    const long = "a".repeat(200) + ".pdf";
    const slug = slugifyFileName(long);
    expect(slug.replace(".pdf", "").length).toBeLessThanOrEqual(80);
    expect(slug.endsWith(".pdf")).toBe(true);
  });
});

describe("buildStoragePath", () => {
  it("particiona por org_id/documentos/group_id/vVERSION-slug", () => {
    expect(buildStoragePath("org_a", "group_1", 2, "Relatório.pdf")).toBe(
      "org_a/documentos/group_1/v2-relatorio.pdf",
    );
  });
});

describe("generatedDocumentPath (path determinístico do job, idempotência)", () => {
  it("usa a extensão do formato gerado", () => {
    expect(generatedDocumentPath("org_a", "d1", "docx")).toBe(
      "org_a/documentos/generated/d1.docx",
    );
    expect(generatedDocumentPath("org_a", "d1", "pdf")).toBe(
      "org_a/documentos/generated/d1.pdf",
    );
  });
});

describe("putGeneratedDocument (upload do arquivo gerado por job)", () => {
  beforeEach(() => mockedClient.mockReset());

  it("grava com upsert no path do formato e com o contentType informado", async () => {
    const client = storageClient();
    mockedClient.mockReturnValue({
      storage: { from: client.from },
    } as unknown as ReturnType<typeof getRlsBypassingSupabaseClient>);
    const docxMime =
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    const file = Buffer.from("PK fake docx");

    const result = await putGeneratedDocument("org_a", "d1", file, {
      format: "docx",
      contentType: docxMime,
    });

    expect(client.from).toHaveBeenCalledWith(DOCUMENTS_BUCKET);
    expect(client.upload).toHaveBeenCalledWith(
      "org_a/documentos/generated/d1.docx",
      file,
      {
        contentType: docxMime,
        upsert: true,
      },
    );
    expect(result).toEqual({
      storagePath: "org_a/documentos/generated/d1.docx",
      sizeBytes: file.byteLength,
    });
  });

  it("erro do provedor → lança sem path parcial", async () => {
    const client = storageClient({ message: "bucket unreachable" });
    mockedClient.mockReturnValue({
      storage: { from: client.from },
    } as unknown as ReturnType<typeof getRlsBypassingSupabaseClient>);

    await expect(
      putGeneratedDocument("org_a", "d1", Buffer.from("x"), {
        format: "docx",
        contentType: "application/octet-stream",
      }),
    ).rejects.toThrow(/generated document upload failed: bucket unreachable/);
  });
});

describe("putDocumentObject (ordem upload→insert; aqui só o upload)", () => {
  beforeEach(() => mockedClient.mockReset());

  it("grava no path particionado e devolve storagePath + sizeBytes", async () => {
    const client = storageClient();
    mockedClient.mockReturnValue({
      storage: { from: client.from },
    } as unknown as ReturnType<typeof getRlsBypassingSupabaseClient>);

    const file = new File(["conteudo"], "laudo.pdf", { type: "application/pdf" });
    const result = await putDocumentObject("org_a", "group_1", 1, file);

    expect(client.from).toHaveBeenCalledWith(DOCUMENTS_BUCKET);
    expect(client.upload).toHaveBeenCalledWith(
      "org_a/documentos/group_1/v1-laudo.pdf",
      file,
      { contentType: "application/pdf", upsert: false },
    );
    expect(result).toEqual({
      storagePath: "org_a/documentos/group_1/v1-laudo.pdf",
      sizeBytes: file.size,
    });
  });

  it("erro do provedor no upload → lança (chamador compensa/propaga)", async () => {
    const client = storageClient({ message: "bucket unreachable" });
    mockedClient.mockReturnValue({
      storage: { from: client.from },
    } as unknown as ReturnType<typeof getRlsBypassingSupabaseClient>);

    const file = new File(["x"], "a.pdf", { type: "application/pdf" });
    await expect(putDocumentObject("org_a", "group_1", 1, file)).rejects.toThrow(
      /bucket unreachable/,
    );
  });

  it("path já ocupado (corrida de mesmo nome, #56) → StorageObjectExistsError", async () => {
    const client = storageClient({
      message: "The resource already exists",
      status: 400,
      statusCode: "409",
    });
    mockedClient.mockReturnValue({
      storage: { from: client.from },
    } as unknown as ReturnType<typeof getRlsBypassingSupabaseClient>);

    const file = new File(["x"], "a.pdf", { type: "application/pdf" });
    const attempt = putDocumentObject("org_a", "group_1", 2, file);
    await expect(attempt).rejects.toBeInstanceOf(StorageObjectExistsError);
    await expect(attempt).rejects.toMatchObject({
      storagePath: "org_a/documentos/group_1/v2-a.pdf",
    });
  });
});

describe("isStorageObjectExistsError", () => {
  it("reconhece status 409, statusCode '409' e a mensagem do provedor", () => {
    expect(isStorageObjectExistsError({ status: 409 })).toBe(true);
    expect(isStorageObjectExistsError({ status: 400, statusCode: "409" })).toBe(true);
    expect(isStorageObjectExistsError({ message: "The resource already exists" })).toBe(
      true,
    );
  });

  it("não confunde outros erros do provedor com conflito", () => {
    expect(isStorageObjectExistsError({ message: "bucket unreachable" })).toBe(false);
    expect(isStorageObjectExistsError({ status: 500, statusCode: "500" })).toBe(false);
  });
});

describe("removeDocumentObject (compensação de órfão / limpeza pós-exclusão)", () => {
  beforeEach(() => mockedClient.mockReset());

  it("remove o objeto pelo path", async () => {
    const client = storageClient();
    mockedClient.mockReturnValue({
      storage: { from: client.from },
    } as unknown as ReturnType<typeof getRlsBypassingSupabaseClient>);

    await removeDocumentObject("org_a/documentos/group_1/v1-laudo.pdf");

    expect(client.from).toHaveBeenCalledWith(DOCUMENTS_BUCKET);
    expect(client.remove).toHaveBeenCalledWith(["org_a/documentos/group_1/v1-laudo.pdf"]);
  });

  it("erro do provedor na remoção → lança", async () => {
    const client = storageClient(null, { message: "not found" });
    mockedClient.mockReturnValue({
      storage: { from: client.from },
    } as unknown as ReturnType<typeof getRlsBypassingSupabaseClient>);

    await expect(removeDocumentObject("x")).rejects.toThrow(/not found/);
  });
});

describe("getSignedDownloadUrl (issue #35 — download por URL assinada)", () => {
  beforeEach(() => mockedClient.mockReset());

  it("usa o TTL padrão (60s) quando nenhum é informado", async () => {
    const client = storageClient(null, null, { url: "https://signed.example/laudo.pdf" });
    mockedClient.mockReturnValue({
      storage: { from: client.from },
    } as unknown as ReturnType<typeof getRlsBypassingSupabaseClient>);

    const url = await getSignedDownloadUrl("org_a/documentos/g1/v1-laudo.pdf");

    expect(url).toBe("https://signed.example/laudo.pdf");
    expect(client.from).toHaveBeenCalledWith(DOCUMENTS_BUCKET);
    expect(client.createSignedUrl).toHaveBeenCalledWith(
      "org_a/documentos/g1/v1-laudo.pdf",
      SIGNED_DOWNLOAD_URL_TTL_SECONDS,
      { download: true },
    );
    expect(SIGNED_DOWNLOAD_URL_TTL_SECONDS).toBe(60);
  });

  it("aceita TTL customizado e nome de download", async () => {
    const client = storageClient();
    mockedClient.mockReturnValue({
      storage: { from: client.from },
    } as unknown as ReturnType<typeof getRlsBypassingSupabaseClient>);

    await getSignedDownloadUrl("org_a/documentos/g1/v1-laudo.pdf", {
      ttlSeconds: 120,
      downloadName: "Laudo Ergonômico.pdf",
    });

    expect(client.createSignedUrl).toHaveBeenCalledWith(
      "org_a/documentos/g1/v1-laudo.pdf",
      120,
      { download: "Laudo Ergonômico.pdf" },
    );
  });

  it("erro do provedor ao assinar → lança (nunca devolve URL parcial/inválida)", async () => {
    const client = storageClient(null, null, { error: { message: "object not found" } });
    mockedClient.mockReturnValue({
      storage: { from: client.from },
    } as unknown as ReturnType<typeof getRlsBypassingSupabaseClient>);

    await expect(
      getSignedDownloadUrl("org_a/documentos/g1/v1-laudo.pdf"),
    ).rejects.toThrow(/object not found/);
  });
});
