/**
 * Documentos complementares da NR-18 (item 18.4.3) — issue #48.
 *
 * **Sem tabela nova e sem migration**: o GED já cobre arquivo, versão, vínculo
 * (`related_entity_type = 'pgr'`) e tipo (`doc_type`). Aqui vive apenas o
 * *vocabulário* — a lista fechada dos tipos exigidos e os rótulos em pt-BR — e a
 * derivação do checklist a partir dos documentos já anexados.
 *
 * O checklist é **informativo**: mostra o que existe e o que falta. Ele não bloqueia
 * geração de PDF, assinatura, publicação nem arquivamento — nenhum requisito pede
 * gate, e inventar um travaria o trabalho de quem usa o sistema.
 */

/** Chave estável (vai para o código e para a URL); o rótulo é o que vira `doc_type`. */
export const NR18_DOCUMENT_TYPES = [
  {
    key: "living_area_project",
    label: "Projeto da área de vivência",
    description:
      "Projeto das instalações da área de vivência do canteiro (NR-18, item 18.4.3).",
    /** SPIQ é "quando aplicável" pela própria norma; os demais são esperados. */
    conditional: false,
  },
  {
    key: "temporary_electrical_project",
    label: "Projeto elétrico das instalações temporárias",
    description: "Projeto elétrico das instalações provisórias do canteiro de obra.",
    conditional: false,
  },
  {
    key: "collective_protection_project",
    label: "Projetos de proteção coletiva",
    description:
      "Projetos dos sistemas de proteção coletiva previstos para a obra (guarda-corpos, plataformas, redes).",
    conditional: false,
  },
  {
    key: "spiq_project",
    label: "Projeto de SPIQ",
    description:
      "Sistema de Proteção contra Incêndio e Pânico — exigido quando aplicável à obra.",
    conditional: true,
  },
] as const;

export type Nr18DocumentTypeKey = (typeof NR18_DOCUMENT_TYPES)[number]["key"];
export type Nr18DocumentType = (typeof NR18_DOCUMENT_TYPES)[number];

const BY_KEY = new Map<string, Nr18DocumentType>(
  NR18_DOCUMENT_TYPES.map((t) => [t.key, t]),
);

export function nr18DocumentType(key: string): Nr18DocumentType | null {
  return BY_KEY.get(key) ?? null;
}

/** Rótulos usados como `doc_type` no GED — é por eles que o checklist casa. */
export const NR18_DOC_TYPE_LABELS: string[] = NR18_DOCUMENT_TYPES.map((t) => t.label);

const BY_LABEL = new Map<string, Nr18DocumentType>(
  NR18_DOCUMENT_TYPES.map((t) => [t.label.toLocaleLowerCase("pt-BR"), t]),
);

/**
 * Casa o `doc_type` gravado no documento com um tipo da NR-18. A comparação ignora
 * caixa e espaços das pontas — o campo é texto livre no banco, e um "Projeto de SPIQ "
 * digitado com espaço não pode deixar o requisito aparecendo como faltante. Fora
 * disso, **não** há adivinhação: tipo diferente não satisfaz requisito nenhum.
 */
export function matchNr18DocumentType(docType: string): Nr18DocumentType | null {
  return BY_LABEL.get(docType.trim().toLocaleLowerCase("pt-BR")) ?? null;
}

/** Documento lógico (versão vigente) que o checklist enxerga. */
export type Nr18ChecklistDocument = {
  id: string;
  documentGroupId: string;
  name: string;
  docType: string;
  version: number;
  createdAt: string;
};

export type Nr18ChecklistItem = {
  key: Nr18DocumentTypeKey;
  label: string;
  description: string;
  conditional: boolean;
  /** `true` quando existe pelo menos um documento lógico vigente deste tipo. */
  attached: boolean;
  /** Documentos lógicos vigentes do tipo (1 linha por grupo, não por versão). */
  documents: Nr18ChecklistDocument[];
};

export type Nr18ChecklistSummary = {
  items: Nr18ChecklistItem[];
  attachedCount: number;
  missingCount: number;
  /** Total de tipos avaliados (inclui o SPIQ, que é "quando aplicável"). */
  totalCount: number;
};

/**
 * Deriva o checklist a partir dos documentos **vigentes** vinculados ao PGR.
 *
 * Versionamento (#56): a lista recebida já traz uma linha por documento lógico
 * (versão corrente). Criar a v2 de um projeto mantém o requisito **ANEXADO** — não
 * conta como anexo novo; excluir o grupo devolve o requisito a **FALTANDO**.
 */
export function buildNr18Checklist(
  documents: readonly Nr18ChecklistDocument[],
): Nr18ChecklistSummary {
  const byType = new Map<Nr18DocumentTypeKey, Nr18ChecklistDocument[]>();
  for (const doc of documents) {
    const type = matchNr18DocumentType(doc.docType);
    if (!type) continue;
    const list = byType.get(type.key) ?? [];
    list.push(doc);
    byType.set(type.key, list);
  }

  const items: Nr18ChecklistItem[] = NR18_DOCUMENT_TYPES.map((type) => {
    const docs = (byType.get(type.key) ?? []).sort((a, b) =>
      a.name.localeCompare(b.name, "pt-BR"),
    );
    return {
      key: type.key,
      label: type.label,
      description: type.description,
      conditional: type.conditional,
      attached: docs.length > 0,
      documents: docs,
    };
  });

  const attachedCount = items.filter((i) => i.attached).length;
  return {
    items,
    attachedCount,
    missingCount: items.length - attachedCount,
    totalCount: items.length,
  };
}

export const NR18_ATTACHED_LABEL = "Anexado";
export const NR18_MISSING_LABEL = "Faltando";

/** Rótulo da situação; o SPIQ ausente aparece como "quando aplicável", não como falha. */
export function nr18StatusLabel(item: Nr18ChecklistItem): string {
  if (item.attached) return NR18_ATTACHED_LABEL;
  return item.conditional
    ? `${NR18_MISSING_LABEL} — quando aplicável`
    : NR18_MISSING_LABEL;
}

/** Tom do `StatusBadge`: anexado é verde; faltante é âmbar; condicional é neutro. */
export function nr18StatusTone(item: Nr18ChecklistItem): "green" | "amber" | "neutral" {
  if (item.attached) return "green";
  return item.conditional ? "neutral" : "amber";
}

/**
 * Só faz sentido cobrar documentos de canteiro quando a unidade É um canteiro. O
 * valor vem de `work_units.type` (`site` = "Obra / Canteiro"); unidade administrativa
 * ou frente de trabalho não mostra checklist nenhum, e nada do PGR comum é bloqueado.
 */
export function isNr18ApplicableUnitType(
  workUnitType: string | null | undefined,
): boolean {
  return workUnitType === "site";
}
