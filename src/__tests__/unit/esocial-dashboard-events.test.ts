import {
  computeConformityPercent,
  esocialReferenceKind,
  eventStatusBucket,
  eventTypeDescription,
  toEventListItem,
} from "@/shared/domains/esocial/events";

describe("eSocial — painel (#218) e eventos (#217)", () => {
  describe("computeConformityPercent", () => {
    it("aceitos sobre eventos COM veredito (ignora pendentes/em trânsito)", () => {
      expect(computeConformityPercent({ accepted: 9, rejected: 1, error: 0 })).toBe(90);
      expect(computeConformityPercent({ accepted: 1, rejected: 1, error: 2 })).toBe(25);
    });

    it("sem veredito → null (não inventa 0% nem 100%)", () => {
      expect(computeConformityPercent({ accepted: 0, rejected: 0, error: 0 })).toBeNull();
    });

    it("tudo aceito → 100%", () => {
      expect(computeConformityPercent({ accepted: 5, rejected: 0, error: 0 })).toBe(100);
    });

    it("tudo rejeitado/erro → 0%", () => {
      expect(computeConformityPercent({ accepted: 0, rejected: 2, error: 3 })).toBe(0);
    });
  });

  describe("eventStatusBucket", () => {
    it("particiona os 6 status sem sobreposição", () => {
      expect(eventStatusBucket("draft")).toBe("pending");
      expect(eventStatusBucket("pending")).toBe("pending");
      expect(eventStatusBucket("sent")).toBe("transmitted");
      expect(eventStatusBucket("accepted")).toBe("transmitted");
      expect(eventStatusBucket("rejected")).toBe("failed");
      expect(eventStatusBucket("error")).toBe("failed");
    });
  });

  describe("eventTypeDescription", () => {
    it("descreve os tipos conhecidos", () => {
      expect(eventTypeDescription("S-2240")).toBe("Condições Ambientais do Trabalho");
      expect(eventTypeDescription("S-2220")).toBe(
        "Monitoramento da Saúde do Trabalhador",
      );
    });
    it("tipo desconhecido volta o próprio valor", () => {
      expect(eventTypeDescription("S-9999")).toBe("S-9999");
    });
  });

  describe("esocialReferenceKind", () => {
    it("S-2240 referencia RISCO, não funcionário", () => {
      expect(esocialReferenceKind("S-2240")).toBe("risk");
    });
    it("eventos de trabalhador referenciam funcionário", () => {
      for (const t of ["S-2190", "S-2200", "S-2210", "S-2220", "S-2221", "S-2300"]) {
        expect(esocialReferenceKind(t)).toBe("employee");
      }
    });
    it("tipo fora do catálogo → none", () => {
      expect(esocialReferenceKind("S-1000")).toBe("none");
    });
  });

  describe("toEventListItem", () => {
    const base = {
      id: "e1",
      status: "sent",
      referenceId: "ref-1",
      batchId: "b1",
      createdAt: new Date("2026-07-10T12:00:00.000Z"),
    };

    it("expõe funcionário, protocolo e data de envio quando existem", () => {
      const r = toEventListItem({
        ...base,
        eventType: "S-2220",
        employeeName: "Marina Sousa",
        sentAt: new Date("2026-07-11T09:30:00.000Z"),
        protocolNumber: "PROT-ABC",
      });
      expect(r.employeeName).toBe("Marina Sousa");
      expect(r.protocolNumber).toBe("PROT-ABC");
      expect(r.sentAt).toBe("2026-07-11T09:30:00.000Z");
      expect(r.description).toBe("Monitoramento da Saúde do Trabalhador");
    });

    it("S-2240 NÃO mostra funcionário mesmo se o join trouxer nome (reference = risco)", () => {
      const r = toEventListItem({
        ...base,
        eventType: "S-2240",
        employeeName: "Nome Que Nao Se Aplica",
      });
      expect(r.employeeName).toBeNull();
    });

    it("evento sem lote → data de envio e protocolo nulos (sem dado inventado)", () => {
      const r = toEventListItem({
        ...base,
        eventType: "S-2210",
        batchId: null,
        sentAt: null,
        protocolNumber: null,
      });
      expect(r.sentAt).toBeNull();
      expect(r.protocolNumber).toBeNull();
    });
  });
});
