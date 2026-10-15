/**
 * @jest-environment node
 */
const files = {
  create: jest.fn(),
  copy: jest.fn(),
  export: jest.fn(),
  delete: jest.fn(),
};
const documents = { batchUpdate: jest.fn(), get: jest.fn() };
const GoogleAuth = jest.fn();

jest.mock("@googleapis/drive", () => ({
  auth: {
    GoogleAuth: function (this: unknown, ...a: unknown[]) {
      GoogleAuth(...a);
    },
  },
  drive: () => ({ files }),
}));
jest.mock("@googleapis/docs", () => ({ docs: () => ({ documents }) }));

import {
  getGoogleDocsConfig,
  parseServiceAccountJson,
} from "@/shared/integrations/google/config";
import {
  convertDocxWithGoogle,
  createGoogleDocsClient,
  fillGoogleDocTemplate,
  flattenToMarkers,
  GOOGLE_DOC_MIME,
} from "@/shared/integrations/google/drive-docs";

const credentials = { client_email: "sa@x.iam.gserviceaccount.com", private_key: "KEY" };
const config = { credentials, subject: "docs@empresa.com", folderId: "folder-1" };
const noWait = { sleep: async () => undefined };

beforeEach(() => {
  for (const fn of [...Object.values(files), ...Object.values(documents), GoogleAuth]) {
    fn.mockReset();
  }
});

describe("config da Service Account", () => {
  const env = process.env;
  afterEach(() => {
    process.env = env;
  });

  it("aceita o JSON cru ou em base64", () => {
    const raw = JSON.stringify(credentials);
    expect(parseServiceAccountJson(raw)).toEqual(credentials);
    expect(parseServiceAccountJson(Buffer.from(raw).toString("base64"))).toEqual(
      credentials,
    );
    expect(() => parseServiceAccountJson("{}")).toThrow(/client_email/);
  });

  it("sem GOOGLE_SERVICE_ACCOUNT_JSON a integração fica desligada", () => {
    process.env = { ...env, GOOGLE_SERVICE_ACCOUNT_JSON: "" };
    expect(getGoogleDocsConfig()).toBeNull();
    process.env = {
      ...env,
      GOOGLE_SERVICE_ACCOUNT_JSON: JSON.stringify(credentials),
      GOOGLE_SERVICE_ACCOUNT_USER_SUBJECT: "docs@empresa.com",
      PGR_DOCX_DRIVE_FOLDER_ID: "folder-1",
    };
    expect(getGoogleDocsConfig()).toEqual(config);
  });
});

describe("cliente Drive/Docs", () => {
  it("autentica a Service Account personificando o usuário", () => {
    createGoogleDocsClient(config);
    expect(GoogleAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        credentials,
        clientOptions: { subject: "docs@empresa.com" },
      }),
    );
  });

  it("DOCX → PDF: sobe convertendo, exporta e apaga o temporário", async () => {
    files.create.mockResolvedValue({ data: { id: "tmp-1" } });
    files.export.mockResolvedValue({ data: new TextEncoder().encode("%PDF").buffer });
    files.delete.mockResolvedValue({});

    const pdf = await convertDocxWithGoogle(
      createGoogleDocsClient(config, noWait),
      Buffer.from("docx"),
      "pgr.docx",
    );

    expect(pdf.toString()).toBe("%PDF");
    expect(files.create).toHaveBeenCalledWith(
      expect.objectContaining({
        requestBody: {
          name: "pgr.docx",
          mimeType: GOOGLE_DOC_MIME,
          parents: ["folder-1"],
        },
      }),
    );
    expect(files.export).toHaveBeenCalledWith(
      { fileId: "tmp-1", mimeType: "application/pdf" },
      { responseType: "arraybuffer" },
    );
    expect(files.delete).toHaveBeenCalledWith({
      fileId: "tmp-1",
      supportsAllDrives: true,
    });
  });

  it("apaga o temporário mesmo quando a exportação falha", async () => {
    files.create.mockResolvedValue({ data: { id: "tmp-2" } });
    files.export.mockRejectedValue(
      Object.assign(new Error("boom"), { response: { status: 500 } }),
    );
    files.delete.mockResolvedValue({});

    await expect(
      convertDocxWithGoogle(
        createGoogleDocsClient(config, noWait),
        Buffer.from("x"),
        "a.docx",
      ),
    ).rejects.toThrow("boom");
    expect(files.delete).toHaveBeenCalledWith({
      fileId: "tmp-2",
      supportsAllDrives: true,
    });
  });

  it("repete chamada com 429 (quota) antes de desistir", async () => {
    files.create
      .mockRejectedValueOnce(
        Object.assign(new Error("quota"), { response: { status: 429 } }),
      )
      .mockResolvedValue({ data: { id: "tmp-3" } });
    files.export.mockResolvedValue({ data: new ArrayBuffer(0) });
    files.delete.mockResolvedValue({});

    await convertDocxWithGoogle(
      createGoogleDocsClient(config, noWait),
      Buffer.from("x"),
      "a",
    );
    expect(files.create).toHaveBeenCalledTimes(2);
  });

  it("fluxo Salesbud: copia o modelo, troca marcadores, confere sobras e exporta", async () => {
    files.copy.mockResolvedValue({ data: { id: "copy-1" } });
    documents.batchUpdate.mockResolvedValue({
      data: {
        replies: [{ replaceAllText: { occurrencesChanged: 2 } }, { replaceAllText: {} }],
      },
    });
    documents.get.mockResolvedValue({
      data: {
        body: {
          content: [
            { paragraph: { elements: [{ textRun: { content: "Empresa X\n" } }] } },
            {
              table: {
                tableRows: [
                  {
                    tableCells: [
                      {
                        content: [
                          {
                            paragraph: {
                              elements: [{ textRun: { content: "{{sobrou}}" } }],
                            },
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            },
          ],
        },
      },
    });
    files.export.mockResolvedValue({ data: new TextEncoder().encode("%PDF").buffer });
    files.delete.mockResolvedValue({});

    const result = await fillGoogleDocTemplate(createGoogleDocsClient(config, noWait), {
      templateId: "tpl-1",
      name: "PGR",
      replacements: { "{{company.razaoSocial}}": "Empresa X", "{{vazio}}": "" },
    });

    expect(files.copy).toHaveBeenCalledWith(
      expect.objectContaining({ fileId: "tpl-1", supportsAllDrives: true }),
    );
    expect(documents.batchUpdate).toHaveBeenCalledWith({
      documentId: "copy-1",
      requestBody: {
        requests: [
          {
            replaceAllText: {
              containsText: { text: "{{company.razaoSocial}}", matchCase: true },
              replaceText: "Empresa X",
            },
          },
          {
            replaceAllText: {
              containsText: { text: "{{vazio}}", matchCase: true },
              replaceText: "",
            },
          },
        ],
      },
    });
    expect(result.occurrencesChanged).toBe(2);
    expect(result.leftoverMarkers).toEqual(["{{sobrou}}"]);
    expect(result.buffer.toString()).toBe("%PDF");
    expect(files.delete).toHaveBeenCalledWith({
      fileId: "copy-1",
      supportsAllDrives: true,
    });
  });
});

describe("flattenToMarkers", () => {
  it("achata objetos em marcadores planos, sem listas", () => {
    expect(
      flattenToMarkers({
        company: { razaoSocial: "X", riskGrade: 3 },
        emittedAt: "hoje",
        ges: [{ title: "GES" }],
        flag: true,
      }),
    ).toEqual({
      "{{company.razaoSocial}}": "X",
      "{{company.riskGrade}}": "3",
      "{{emittedAt}}": "hoje",
    });
  });
});
