/**
 * Validação ponta a ponta do Gotenberg (fatia #36) — chama `htmlToPdf` contra o
 * container local. OPCIONAL: só roda com o serviço no ar e `GOTENBERG_URL` setada.
 *
 *   docker compose up -d gotenberg
 *   GOTENBERG_URL=http://localhost:3001 npm run test:integration -- pdf/gotenberg
 *
 * Sem a env, a suíte é pulada (não gateia CI enquanto o serviço não roda no pipeline).
 */
import { htmlToPdf } from "@/shared/integrations/pdf/gotenberg";
import { buildPgrHtml } from "@/shared/domains/pgr/pgr-pdf-template";
import type { PgrConsolidated } from "@/shared/domains/pgr/pgr-consolidated";

const RUN = Boolean(process.env.GOTENBERG_URL);
const describeMaybe = RUN ? describe : describe.skip;

function expectPdf(pdf: Buffer): void {
  expect(Buffer.isBuffer(pdf)).toBe(true);
  expect(pdf.byteLength).toBeGreaterThan(0);
  expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
}

describeMaybe("Gotenberg HTML→PDF (serviço local)", () => {
  it("converte HTML em um PDF válido (assinatura %PDF)", async () => {
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
      <title>Smoke</title></head><body><h1>SST Manager — smoke test</h1>
      <p>Documento gerado pelo Gotenberg.</p></body></html>`;
    expectPdf(await htmlToPdf(html));
  }, 30_000);

  it("gera o PDF do PGR (#40) a partir do template real", async () => {
    const data: PgrConsolidated = {
      pgr: {
        id: "pgr-1",
        companyName: "ACME Ltda",
        workUnitName: "Obra Central",
        responsible: "Eng. Fulano",
        registrationType: "crea",
        registrationNumber: "12345",
        issuedAt: "2026-01-10",
        validUntil: "2027-01-10",
      },
      ges: [
        {
          id: "g1",
          name: "Marmoraria",
          risks: [
            {
              id: "r1",
              agentType: "chemical",
              description: "Poeira mineral",
              hazard: null,
              sources: "Corte de rocha",
              propagation: null,
              exposureTime: null,
              possibleInjuries: null,
              noxiousAgentCode: null,
              measurementUnit: null,
              concentrationIntensity: null,
              riskLevel: 12,
              result: "substantial",
              assessment: {
                criterion: "quantitative",
                probability: 4,
                severity: 3,
                riskLevel: 12,
                uncertaintyDegree: 0,
                toleranceLimit: null,
                result: "substantial",
                assessedAt: "2026-06-01",
              },
              measures: [
                {
                  id: "m1",
                  controlLevel: "ppe",
                  applicable: true,
                  justification: null,
                  monitoring: null,
                  actionWhat: "Fornecer respirador PFF2",
                  actionHow: "Distribuição mensal",
                  actionTracking: null,
                  actionMeasurement: null,
                  actionResponsible: "SESMT",
                  actionDeadline: "2026-08-01",
                  state: "planned",
                },
              ],
              epis: [],
            },
          ],
        },
      ],
    };
    const html = buildPgrHtml(data, {
      generatedAt: "2026-07-19",
      formHeader: { code: "FRM-001", revision: "02", date: "2026-07-19" },
    });
    expectPdf(await htmlToPdf(html));
  }, 30_000);
});
