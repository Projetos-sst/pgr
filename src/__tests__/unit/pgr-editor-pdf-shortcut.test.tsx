import { fireEvent, render, screen } from "@testing-library/react";

import type { Pgr } from "@/shared/domains/pgr/pgr";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: jest.fn() }),
}));
jest.mock("@/shared/server/actions/pgr/pgr", () => ({
  publishPgrAction: jest.fn(),
}));
jest.mock("@/shared/server/actions/documents/pdf-batch", () => ({
  enqueuePgrPdfBatchAction: jest.fn(),
}));
jest.mock("@/app/(protected)/pgr/[id]/_components/pgr-readiness-panel", () => ({
  PgrReadinessPanel: () => null,
}));
jest.mock("@/app/(protected)/pgr/[id]/_components/pgr-basic-info-tab", () => ({
  PgrBasicInfoTab: () => <div>identificação</div>,
}));
jest.mock("@/app/(protected)/pgr/[id]/_components/pgr-ges-tab", () => ({
  PgrGesTab: () => null,
}));
jest.mock("@/app/(protected)/pgr/[id]/_components/pgr-revisions-tab", () => ({
  PgrRevisionsTab: () => null,
}));
jest.mock("@/app/(protected)/pgr/[id]/_components/pgr-consolidated-tab", () => ({
  PgrConsolidatedTab: () => null,
}));
jest.mock("@/app/(protected)/pgr/[id]/_components/pgr-signature-panel", () => ({
  PgrSignaturePanel: () => null,
}));

import { PgrEditorTabs } from "@/app/(protected)/pgr/[id]/_components/pgr-editor-tabs";

const PGR_ID = "11111111-1111-4111-8111-111111111111";

function renderEditor(dates: { issuedAt: string | null; validUntil: string | null }) {
  const pgr: Pgr = {
    id: PGR_ID,
    orgId: "org_a",
    companyId: "22222222-2222-4222-8222-222222222222",
    workUnitId: null,
    responsible: null,
    registrationType: "crea",
    registrationNumber: null,
    publishedAt: null,
    createdBy: null,
    createdAt: new Date("2026-11-01T12:00:00Z"),
    updatedAt: new Date("2026-11-01T12:00:00Z"),
    ...dates,
  };
  return render(
    <PgrEditorTabs
      pgrId={PGR_ID}
      pgr={pgr}
      isPublished={false}
      companyName="Acme"
      workUnitName={null}
      availableGes={[]}
      gesLinks={[]}
      revisions={[]}
      consolidated={null}
      linkedDocuments={[]}
      linkedDocumentsTotal={0}
      technicianDocuments={[]}
      technicianDocumentsTotal={0}
      nr18Checklist={null}
      epiRelation={[]}
    />,
  );
}

describe("Editor do PGR × atalho do PDF (NOB-173)", () => {
  it("com a Identificação incompleta, o atalho explica o que falta em vez de abrir a etapa", () => {
    renderEditor({ issuedAt: null, validUntil: null });

    fireEvent.click(screen.getByRole("button", { name: "Gerar PDF do PGR" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "preencha empresa, data de emissão e validade na etapa 1 (Identificação)",
    );
    expect(screen.queryByRole("link", { name: "Baixar PDF" })).toBeNull();
  });

  it("com a Identificação preenchida, o atalho leva direto ao download do PDF", () => {
    renderEditor({ issuedAt: "2026-11-01", validUntil: "2027-11-01" });

    fireEvent.click(screen.getByRole("button", { name: "Gerar PDF do PGR" }));

    expect(screen.getByRole("link", { name: "Baixar PDF" })).toHaveAttribute(
      "href",
      `/api/v1/pgr/${PGR_ID}/docx?format=pdf`,
    );
    expect(screen.getByText(/prévia na hora/)).toBeInTheDocument();
  });
});
