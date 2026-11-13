const mockDownload = jest.fn();
jest.mock("@/shared/supabase/admin", () => ({
  getRlsBypassingSupabaseClient: () => ({
    storage: { from: () => ({ download: mockDownload }) },
  }),
}));

import { downloadDocumentObject } from "@/shared/integrations/storage/documents-storage";

const PATH = "org_a/documentos/group/v1-pgr.docx";

describe("download do binário do GED para a exportação", () => {
  beforeEach(() => {
    mockDownload.mockReset();
  });

  it("devolve os bytes quando o objeto existe", async () => {
    mockDownload.mockResolvedValue({
      data: { arrayBuffer: async () => new Uint8Array([97, 98, 99]).buffer },
      error: null,
    });
    const result = await downloadDocumentObject(PATH);
    expect(result).toEqual({ status: "found", bytes: Buffer.from("abc") });
    expect(mockDownload).toHaveBeenCalledWith(PATH);
  });

  it.each([
    { message: "Object not found", status: 400, statusCode: "404" },
    { message: "x", status: 404 },
    { message: "not_found" },
  ])("objeto inexistente vira ausente: %o", async (error) => {
    mockDownload.mockResolvedValue({ data: null, error });
    expect(await downloadDocumentObject(PATH)).toEqual({ status: "missing" });
  });

  it("erro do provedor não é confundido com arquivo ausente", async () => {
    mockDownload.mockResolvedValue({
      data: null,
      error: { message: "Gateway timeout", status: 504, statusCode: "504" },
    });
    expect(await downloadDocumentObject(PATH)).toEqual({ status: "unavailable" });
  });

  it("resposta sem dado e sem erro é tratada como indisponível", async () => {
    mockDownload.mockResolvedValue({ data: null, error: null });
    expect(await downloadDocumentObject(PATH)).toEqual({ status: "unavailable" });
  });
});
