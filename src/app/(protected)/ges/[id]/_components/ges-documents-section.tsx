import { DocumentAttachmentsSection } from "../../../documents/_components/document-attachments-section";

/**
 * Anexos do GED vinculados a este GES pela relação polimórfica
 * (`related_entity_type = "ges"`, issue #45).
 */
export function GesDocumentsSection({
  gesId,
  gesName,
}: {
  gesId: string;
  gesName: string;
}) {
  const attachHref =
    `/documents/new?relatedEntityType=ges&relatedEntityId=${gesId}` +
    `&returnTo=${encodeURIComponent(`/ges/${gesId}/edit`)}` +
    `&returnLabel=${encodeURIComponent(gesName)}`;

  return (
    <DocumentAttachmentsSection
      relatedEntityType="ges"
      relatedEntityId={gesId}
      attachHref={attachHref}
      description="Documentos vinculados a este GES — laudos, PPPs, evidências técnicas."
    />
  );
}
